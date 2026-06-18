import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Account, Debt, DebtTransaction, Prisma, User } from "@prisma/client";
import Big from "big.js";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import type {
  AddToDebtDto,
  CloseDebtDto,
  CreateDebtDto,
  DebtListQueryDto,
  UpdateDebtDto,
  UpdateDebtEntryTransactionDto,
} from "./debts.dto";

const DEBT_LENT = "lent";
const DEBT_OPEN = "open";
const DEBT_CLOSED = "closed";
const DEBT_TRANSACTION_CREATED = "created";
const DEBT_TRANSACTION_CLOSED = "closed";
const DEBT_TRANSACTION_ADDED = "added";
const PAYMENT_INCOME = "income";
const PAYMENT_EXPENSE = "expense";

const ACCOUNT_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const DEBT_ACCOUNT_SELECT = {
  id: true,
  name: true,
  currency: true,
  color: true,
  icon: true,
} satisfies Prisma.AccountSelect;

const DEBT_TRANSACTION_ACCOUNT_SELECT = {
  ...DEBT_ACCOUNT_SELECT,
  ownerId: true,
  owner: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.AccountSelect;

const ACCESSIBLE_DEBT_TRANSACTION_INCLUDE = {
  debt: true,
  account: {
    select: DEBT_TRANSACTION_ACCOUNT_SELECT,
  },
} satisfies Prisma.DebtTransactionInclude;

type PrismaTx = Prisma.TransactionClient;
type DebtListAccount = Pick<Account, "id" | "name" | "currency" | "color" | "icon">;
type DebtTransactionAccount = DebtListAccount & {
  ownerId: string | null;
  owner: Pick<User, "id" | "name" | "email" | "image"> | null;
};
type AccessibleDebt = Debt;
type AccessibleDebtTransaction = DebtTransaction & {
  debt: Debt;
  account: DebtTransactionAccount | null;
};
type DebtTransactionBalanceEffect = Pick<DebtTransaction, "accountId" | "type" | "amount" | "toAmount">;

function toIsoString(value: Date): string {
  return value.toISOString();
}

function addMoney(a: string, b: string): string {
  return new Big(a).plus(b).toString();
}

function subtractMoney(a: string, b: string): string {
  return new Big(a).minus(b).toString();
}

function compareMoney(a: string, b: string): number {
  const bigA = new Big(a);
  const bigB = new Big(b);
  if (bigA.gt(bigB)) return 1;
  if (bigA.lt(bigB)) return -1;
  return 0;
}

function getDebtInitialAccountBalanceDelta(debtType: string, amount: string): string {
  return debtType === DEBT_LENT ? subtractMoney("0", amount) : amount;
}

function getDebtTransactionAccountAmount(
  transaction: Pick<DebtTransactionBalanceEffect, "type" | "amount" | "toAmount">
) {
  return transaction.toAmount || transaction.amount;
}

function getDebtTransactionBalanceDelta(debtType: string, transaction: DebtTransactionBalanceEffect): string {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DEBT_TRANSACTION_CLOSED) {
    return debtType === DEBT_LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return getDebtInitialAccountBalanceDelta(debtType, accountAmount);
}

function getDebtDeletionBalanceDelta(debtType: string, transaction: DebtTransactionBalanceEffect): string {
  return subtractMoney("0", getDebtTransactionBalanceDelta(debtType, transaction));
}

function getDebtTransactionTotalsDelta(transactionType: string, amount: string) {
  if (transactionType === DEBT_TRANSACTION_CLOSED) {
    return {
      amountDelta: "0",
      remainingDelta: subtractMoney("0", amount),
    };
  }

  return {
    amountDelta: amount,
    remainingDelta: amount,
  };
}

function getDebtStatusFromRemainingAmount(remainingAmount: string) {
  return compareMoney(remainingAmount, "0") <= 0 ? DEBT_CLOSED : DEBT_OPEN;
}

function minMoney(a: string, b: string) {
  return compareMoney(a, b) <= 0 ? a : b;
}

function assertNonNegativeBalance(balance: string, message: string) {
  if (compareMoney(balance, "0") < 0) {
    throw new BadRequestException(message);
  }
}

function addAccountBalanceDelta(
  balanceDeltasByAccount: Map<string, string>,
  accountId: string | null | undefined,
  delta: string
) {
  if (!accountId || compareMoney(delta, "0") === 0) {
    return;
  }

  const currentDelta = balanceDeltasByAccount.get(accountId) || "0";
  balanceDeltasByAccount.set(accountId, addMoney(currentDelta, delta));
}

function getPaymentTransactionBalanceDelta(type: string, amount: string): string {
  if (type === PAYMENT_INCOME) return amount;
  if (type === PAYMENT_EXPENSE) return subtractMoney("0", amount);
  return "0";
}

function getCategoryTransactionType(debtType: string, isEarlyClose: boolean) {
  if (debtType === DEBT_LENT) {
    return isEarlyClose ? PAYMENT_EXPENSE : PAYMENT_INCOME;
  }

  return isEarlyClose ? PAYMENT_INCOME : PAYMENT_EXPENSE;
}

function getCategoryTypeFromPaymentType(paymentType: string) {
  return paymentType === PAYMENT_INCOME ? PAYMENT_INCOME : PAYMENT_EXPENSE;
}

function getDebtTransactionToAmount(account: Account, debtCurrency: string, inputToAmount?: string): string | null {
  if (account.currency === debtCurrency) {
    return null;
  }

  if (!inputToAmount) {
    throw new BadRequestException("Укажите сумму в валюте счёта");
  }

  return inputToAmount;
}

function toDebtDto(debt: Debt) {
  return {
    id: debt.id,
    workspaceId: debt.workspaceId,
    type: debt.type,
    personName: debt.personName,
    amount: debt.amount,
    remainingAmount: debt.remainingAmount,
    currency: debt.currency,
    date: toIsoString(debt.date),
    status: debt.status,
    createdAt: toIsoString(debt.createdAt),
    updatedAt: toIsoString(debt.updatedAt),
  };
}

function toDebtTransactionDebtDto(debt: Debt) {
  return {
    id: debt.id,
    workspaceId: debt.workspaceId,
    type: debt.type,
    personName: debt.personName,
    amount: debt.amount,
    remainingAmount: debt.remainingAmount,
    currency: debt.currency,
    date: toIsoString(debt.date),
    status: debt.status,
    createdAt: toIsoString(debt.createdAt),
    updatedAt: toIsoString(debt.updatedAt),
  };
}

function toDebtTransactionDto(transaction: AccessibleDebtTransaction) {
  return {
    id: transaction.id,
    workspaceId: transaction.workspaceId,
    debtId: transaction.debtId,
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    toAmount: transaction.toAmount,
    date: toIsoString(transaction.date),
    createdAt: toIsoString(transaction.createdAt),
    debt: toDebtTransactionDebtDto(transaction.debt),
    account: transaction.account,
  };
}

@Injectable()
export class DebtsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async assertWorkspaceAccess(workspaceId: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccessWithClient(this.prisma, workspaceId, currentUser);
  }

  private async assertWorkspaceAccessWithClient(
    client: PrismaService | PrismaTx,
    workspaceId: string,
    currentUser: AuthenticatedUser
  ) {
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (workspace.ownerId === currentUser.id) {
      return;
    }

    const membership = await client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("Доступ запрещён");
    }
  }

  private async getWorkspaceAccountOrThrow(
    tx: PrismaTx,
    workspaceId: string,
    accountId: string,
    errorMessage = "Счёт не найден"
  ) {
    const account = await tx.account.findFirst({
      where: {
        id: accountId,
        workspaceId,
      },
    });

    if (!account) {
      throw new NotFoundException(errorMessage);
    }

    return account;
  }

  private async getWorkspaceCategoryOrThrow(tx: PrismaTx, workspaceId: string, categoryId: string, type: string) {
    const category = await tx.category.findFirst({
      where: {
        id: categoryId,
        workspaceId,
        type,
      },
    });

    if (!category) {
      throw new BadRequestException("Категория не найдена или не подходит для этой операции");
    }

    return category;
  }

  private async getAccessibleDebtOrThrow(
    tx: PrismaTx,
    debtId: string,
    currentUser: AuthenticatedUser
  ): Promise<AccessibleDebt> {
    const debt = await tx.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new NotFoundException("Долг не найден или доступ запрещён");
    }

    await this.assertWorkspaceAccessWithClient(tx, debt.workspaceId, currentUser);
    return debt;
  }

  private async getAccessibleDebtTransactionOrThrow(
    tx: PrismaTx,
    debtTransactionId: string,
    currentUser: AuthenticatedUser
  ): Promise<AccessibleDebtTransaction> {
    const debtTransaction = await tx.debtTransaction.findUnique({
      where: { id: debtTransactionId },
      include: ACCESSIBLE_DEBT_TRANSACTION_INCLUDE,
    });

    if (!debtTransaction) {
      throw new NotFoundException("Транзакция долга не найдена или доступ запрещён");
    }

    await this.assertWorkspaceAccessWithClient(tx, debtTransaction.workspaceId, currentUser);
    return debtTransaction as AccessibleDebtTransaction;
  }

  private async applyAccountBalanceDeltas(
    tx: PrismaTx,
    workspaceId: string,
    balanceDeltasByAccount: Map<string, string>
  ) {
    const accountIds = [...balanceDeltasByAccount.keys()];

    if (accountIds.length === 0) {
      return;
    }

    const accounts = await tx.account.findMany({
      where: {
        workspaceId,
        id: { in: accountIds },
      },
    });

    const accountsById = new Map(accounts.map((account) => [account.id, account]));

    for (const [accountId, delta] of balanceDeltasByAccount) {
      if (compareMoney(delta, "0") === 0) {
        continue;
      }

      const account = accountsById.get(accountId);

      if (!account) {
        throw new NotFoundException("Счёт не найден");
      }

      const nextBalance = addMoney(account.balance, delta);
      assertNonNegativeBalance(nextBalance, `Недостаточно средств на счёте "${account.name}" (${account.balance})`);

      await tx.account.update({
        where: { id: accountId },
        data: { balance: nextBalance },
      });
    }
  }

  private async reconcileDebtTransactionBalanceEffect(
    tx: PrismaTx,
    debt: Pick<AccessibleDebt, "workspaceId" | "type">,
    previousTransaction?: DebtTransactionBalanceEffect | null,
    nextTransaction?: DebtTransactionBalanceEffect | null
  ) {
    const balanceDeltasByAccount = new Map<string, string>();

    if (previousTransaction?.accountId) {
      addAccountBalanceDelta(
        balanceDeltasByAccount,
        previousTransaction.accountId,
        getDebtDeletionBalanceDelta(debt.type, previousTransaction)
      );
    }

    if (nextTransaction?.accountId) {
      addAccountBalanceDelta(
        balanceDeltasByAccount,
        nextTransaction.accountId,
        getDebtTransactionBalanceDelta(debt.type, nextTransaction)
      );
    }

    await this.applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);
  }

  async listDebts(workspaceId: string, filters: DebtListQueryDto | undefined, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const where: Prisma.DebtWhereInput = { workspaceId };

    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.personName) where.personName = { contains: filters.personName, mode: "insensitive" };

    const [debts, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        orderBy: [{ status: "asc" }, { date: "desc" }],
      }),
      this.prisma.debt.count({ where }),
    ]);

    return { data: debts.map(toDebtDto), total };
  }

  async createDebt(workspaceId: string, input: CreateDebtDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    if (!input.currency) {
      throw new BadRequestException("Выберите валюту долга");
    }

    if (input.useAccount && !input.accountId) {
      throw new BadRequestException("Выберите счёт");
    }

    const debt = await this.prisma.$transaction(async (tx) => {
      const currency = input.currency;
      let accountId: string | null = null;
      let toAmount: string | null = null;

      if (input.useAccount && input.accountId) {
        const account = await this.getWorkspaceAccountOrThrow(tx, workspaceId, input.accountId);

        accountId = account.id;
        toAmount = getDebtTransactionToAmount(account, currency, input.toAmount);

        const nextBalance = addMoney(
          account.balance,
          getDebtInitialAccountBalanceDelta(input.type, toAmount || input.amount)
        );
        assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

        await tx.account.update({
          where: { id: account.id },
          data: { balance: nextBalance },
        });
      }

      const createdDebt = await tx.debt.create({
        data: {
          workspaceId,
          type: input.type,
          personName: input.personName,
          amount: input.amount,
          remainingAmount: input.amount,
          currency,
          date: input.date,
          status: DEBT_OPEN,
        },
      });

      await tx.debtTransaction.create({
        data: {
          workspaceId,
          debtId: createdDebt.id,
          accountId,
          type: DEBT_TRANSACTION_CREATED,
          amount: input.amount,
          toAmount,
          date: input.date,
        },
      });

      return createdDebt;
    });

    return { debt: toDebtDto(debt) };
  }

  async getDebtEditData(debtId: string, currentUser: AuthenticatedUser) {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new NotFoundException("Долг не найден или доступ запрещён");
    }

    await this.assertWorkspaceAccess(debt.workspaceId, currentUser);

    const createdTransaction = await this.prisma.debtTransaction.findFirst({
      where: {
        debtId,
        type: DEBT_TRANSACTION_CREATED,
      },
      include: {
        account: {
          select: DEBT_TRANSACTION_ACCOUNT_SELECT,
        },
      },
    });

    return {
      debt: {
        personName: debt.personName,
        initialAmount: createdTransaction?.amount || debt.amount,
        initialToAmount: createdTransaction?.toAmount ?? null,
        initialDate: toIsoString(createdTransaction?.date || debt.date),
        currency: debt.currency,
        account: createdTransaction?.account ?? null,
      },
    };
  }

  async updateDebt(debtId: string, input: UpdateDebtDto, currentUser: AuthenticatedUser) {
    const debt = await this.prisma.$transaction(async (tx) => {
      const existingDebt = await this.getAccessibleDebtOrThrow(tx, debtId, currentUser);

      let initialTransaction = await tx.debtTransaction.findFirst({
        where: {
          debtId,
          type: DEBT_TRANSACTION_CREATED,
        },
      });

      if (!initialTransaction) {
        initialTransaction = await tx.debtTransaction.findFirst({
          where: { debtId },
          orderBy: { date: "asc" },
        });
      }

      const oldInitial = initialTransaction?.amount || existingDebt.amount;
      const amountDelta = subtractMoney(input.amount, oldInitial);
      const newRemaining = addMoney(existingDebt.remainingAmount, amountDelta);

      if (compareMoney(newRemaining, "0") < 0) {
        throw new BadRequestException(
          `Новая изначальная сумма не может быть меньше ${subtractMoney(
            oldInitial,
            existingDebt.remainingAmount
          )} (остаток долга учтён)`
        );
      }

      const initialTransactionAccount = initialTransaction?.accountId
        ? await this.getWorkspaceAccountOrThrow(tx, existingDebt.workspaceId, initialTransaction.accountId)
        : null;
      const nextInitialToAmount = initialTransactionAccount
        ? getDebtTransactionToAmount(initialTransactionAccount, existingDebt.currency, input.toAmount)
        : null;

      await this.reconcileDebtTransactionBalanceEffect(
        tx,
        existingDebt,
        initialTransaction,
        initialTransaction
          ? {
              accountId: initialTransaction.accountId,
              type: initialTransaction.type,
              amount: input.amount,
              toAmount: nextInitialToAmount,
            }
          : null
      );

      const nextDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          personName: input.personName,
          date: input.date,
          amount: addMoney(existingDebt.amount, amountDelta),
          remainingAmount: newRemaining,
          status: getDebtStatusFromRemainingAmount(newRemaining),
        },
      });

      if (initialTransaction) {
        await tx.debtTransaction.update({
          where: { id: initialTransaction.id },
          data: {
            amount: input.amount,
            toAmount: nextInitialToAmount,
            date: input.date,
          },
        });
      } else {
        await tx.debtTransaction.create({
          data: {
            workspaceId: existingDebt.workspaceId,
            debtId,
            accountId: null,
            type: DEBT_TRANSACTION_CREATED,
            amount: input.amount,
            toAmount: null,
            date: input.date,
          },
        });
      }

      return nextDebt;
    });

    return { debt: toDebtDto(debt) };
  }

  async addToDebt(debtId: string, input: AddToDebtDto, currentUser: AuthenticatedUser) {
    const debt = await this.prisma.$transaction(async (tx) => {
      const existingDebt = await this.getAccessibleDebtOrThrow(tx, debtId, currentUser);

      if (existingDebt.status === DEBT_CLOSED) {
        throw new BadRequestException("Нельзя добавить к закрытому долгу");
      }

      if (input.useAccount && !input.accountId) {
        throw new BadRequestException("Выберите счёт");
      }

      let accountId: string | null = null;
      let toAmount: string | null = null;

      if (input.useAccount && input.accountId) {
        const account = await this.getWorkspaceAccountOrThrow(tx, existingDebt.workspaceId, input.accountId);

        accountId = account.id;
        toAmount = getDebtTransactionToAmount(account, existingDebt.currency, input.toAmount);
        const nextBalance = addMoney(
          account.balance,
          getDebtInitialAccountBalanceDelta(existingDebt.type, toAmount || input.amount)
        );
        assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

        await tx.account.update({
          where: { id: account.id },
          data: { balance: nextBalance },
        });
      }

      const nextDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          amount: addMoney(existingDebt.amount, input.amount),
          remainingAmount: addMoney(existingDebt.remainingAmount, input.amount),
        },
      });

      await tx.debtTransaction.create({
        data: {
          workspaceId: existingDebt.workspaceId,
          debtId: existingDebt.id,
          accountId,
          type: DEBT_TRANSACTION_ADDED,
          amount: input.amount,
          toAmount,
          date: input.date ?? new Date(),
        },
      });

      return nextDebt;
    });

    return { debt: toDebtDto(debt) };
  }

  async closeDebt(debtId: string, input: CloseDebtDto, currentUser: AuthenticatedUser) {
    if (input.useAccount && !input.accountId) {
      throw new BadRequestException("Выберите счёт");
    }

    const debt = await this.prisma.$transaction(async (tx) => {
      const existingDebt = await this.getAccessibleDebtOrThrow(tx, debtId, currentUser);

      if (existingDebt.status === DEBT_CLOSED) {
        throw new BadRequestException("Долг уже закрыт");
      }

      let closeAmount = input.amount;
      let categoryAmount = "0";
      let categoryTransactionType: string | null = null;
      const closeDate = input.date ?? new Date();
      let currenciesMatch = true;

      if (input.useAccount && input.accountId) {
        const account = await this.getWorkspaceAccountOrThrow(tx, existingDebt.workspaceId, input.accountId);
        currenciesMatch = account.currency === existingDebt.currency;

        if (!currenciesMatch && !input.toAmount) {
          throw new BadRequestException("Укажите сумму отправления");
        }

        if (
          !currenciesMatch &&
          (input.closeEarly || (input.paymentAmount && compareMoney(input.paymentAmount, input.amount) > 0))
        ) {
          throw new BadRequestException("Подарок при закрытии долга доступен только в валюте долга");
        }

        if (currenciesMatch && input.paymentAmount) {
          closeAmount = input.closeEarly
            ? existingDebt.remainingAmount
            : minMoney(input.paymentAmount, existingDebt.remainingAmount);

          if (input.closeEarly && compareMoney(input.paymentAmount, existingDebt.remainingAmount) < 0) {
            categoryAmount = subtractMoney(existingDebt.remainingAmount, input.paymentAmount);
            categoryTransactionType = getCategoryTransactionType(existingDebt.type, true);
          } else if (compareMoney(input.paymentAmount, existingDebt.remainingAmount) > 0) {
            categoryAmount = subtractMoney(input.paymentAmount, existingDebt.remainingAmount);
            categoryTransactionType = getCategoryTransactionType(existingDebt.type, false);
          }
        }

        if (compareMoney(closeAmount, existingDebt.remainingAmount) > 0) {
          throw new BadRequestException(`Сумма не может превышать остаток долга (${existingDebt.remainingAmount})`);
        }

        let categoryId: string | null = null;

        if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType) {
          if (!input.categoryId) {
            throw new BadRequestException("Выберите категорию");
          }

          const categoryType = getCategoryTypeFromPaymentType(categoryTransactionType);
          const category = await this.getWorkspaceCategoryOrThrow(
            tx,
            existingDebt.workspaceId,
            input.categoryId,
            categoryType
          );
          categoryId = category.id;
        }

        let balanceDelta = getDebtTransactionBalanceDelta(existingDebt.type, {
          accountId: input.accountId,
          type: DEBT_TRANSACTION_CLOSED,
          amount: closeAmount,
          toAmount: !currenciesMatch ? input.toAmount || closeAmount : null,
        });

        if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType) {
          balanceDelta = addMoney(
            balanceDelta,
            getPaymentTransactionBalanceDelta(categoryTransactionType, categoryAmount)
          );
        }

        const nextBalance = addMoney(account.balance, balanceDelta);
        assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: nextBalance },
        });

        if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType && categoryId) {
          await tx.paymentTransaction.create({
            data: {
              workspaceId: existingDebt.workspaceId,
              accountId: input.accountId,
              amount: categoryAmount,
              type: categoryTransactionType,
              description: `Закрытие долга: ${existingDebt.personName}`,
              date: closeDate,
              categoryId,
            },
          });
        }
      } else if (compareMoney(closeAmount, existingDebt.remainingAmount) > 0) {
        throw new BadRequestException(`Сумма не может превышать остаток долга (${existingDebt.remainingAmount})`);
      }

      const newRemainingAmount = subtractMoney(existingDebt.remainingAmount, closeAmount);
      const isClosed = compareMoney(newRemainingAmount, "0") <= 0;

      const nextDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          remainingAmount: newRemainingAmount,
          status: isClosed ? DEBT_CLOSED : DEBT_OPEN,
        },
      });

      await tx.debtTransaction.create({
        data: {
          workspaceId: existingDebt.workspaceId,
          debtId: existingDebt.id,
          accountId: input.useAccount ? input.accountId || null : null,
          type: DEBT_TRANSACTION_CLOSED,
          amount: closeAmount,
          toAmount: !currenciesMatch ? input.toAmount : null,
          date: closeDate,
        },
      });

      return nextDebt;
    });

    return { debt: toDebtDto(debt) };
  }

  async deleteDebt(debtId: string, currentUser: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const debt = await this.getAccessibleDebtOrThrow(tx, debtId, currentUser);
      const debtTransactions = await tx.debtTransaction.findMany({
        where: { debtId: debt.id },
        select: {
          accountId: true,
          type: true,
          amount: true,
          toAmount: true,
        },
      });

      const balanceDeltasByAccount = new Map<string, string>();

      for (const transaction of debtTransactions) {
        if (!transaction.accountId) {
          continue;
        }

        addAccountBalanceDelta(
          balanceDeltasByAccount,
          transaction.accountId,
          getDebtDeletionBalanceDelta(debt.type, transaction)
        );
      }

      await this.applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);

      await tx.debtTransaction.deleteMany({
        where: { debtId: debt.id },
      });

      await tx.debt.delete({
        where: { id: debtId },
      });
    });
  }

  async updateDebtTransaction(
    debtTransactionId: string,
    input: UpdateDebtEntryTransactionDto,
    currentUser: AuthenticatedUser
  ) {
    const debtTransaction = await this.prisma.$transaction(async (tx) => {
      const existingTransaction = await this.getAccessibleDebtTransactionOrThrow(tx, debtTransactionId, currentUser);
      const debt = existingTransaction.debt;

      if (existingTransaction.type === DEBT_TRANSACTION_CREATED) {
        throw new BadRequestException("Начальную транзакцию нужно редактировать через редактирование долга");
      }

      const currentTotals = getDebtTransactionTotalsDelta(existingTransaction.type, existingTransaction.amount);
      const nextTotals = getDebtTransactionTotalsDelta(existingTransaction.type, input.amount);
      const nextDebtAmount = addMoney(debt.amount, subtractMoney(nextTotals.amountDelta, currentTotals.amountDelta));
      const nextRemainingAmount = addMoney(
        debt.remainingAmount,
        subtractMoney(nextTotals.remainingDelta, currentTotals.remainingDelta)
      );

      if (compareMoney(nextRemainingAmount, "0") < 0) {
        if (existingTransaction.type === DEBT_TRANSACTION_ADDED) {
          throw new BadRequestException(
            `Новая сумма не может быть меньше ${subtractMoney(
              existingTransaction.amount,
              debt.remainingAmount
            )} (остаток долга учтён)`
          );
        }

        throw new BadRequestException(
          `Сумма не может превышать остаток долга (${addMoney(debt.remainingAmount, existingTransaction.amount)})`
        );
      }

      let nextTransactionAccountId = existingTransaction.accountId;
      let nextTransactionToAmount: string | null = existingTransaction.toAmount;

      if (existingTransaction.type === DEBT_TRANSACTION_ADDED) {
        if (input.accountId) {
          const nextAccount = await this.getWorkspaceAccountOrThrow(tx, debt.workspaceId, input.accountId);

          nextTransactionAccountId = nextAccount.id;
          nextTransactionToAmount = getDebtTransactionToAmount(nextAccount, debt.currency, input.toAmount);
        } else {
          nextTransactionAccountId = null;
          nextTransactionToAmount = null;
        }
      } else if (existingTransaction.type === DEBT_TRANSACTION_CLOSED) {
        if (!input.accountId) {
          throw new BadRequestException("Выберите счёт");
        }

        const nextAccount = await this.getWorkspaceAccountOrThrow(tx, debt.workspaceId, input.accountId);
        nextTransactionAccountId = nextAccount.id;
        nextTransactionToAmount = getDebtTransactionToAmount(nextAccount, debt.currency, input.toAmount);
      }

      await this.reconcileDebtTransactionBalanceEffect(
        tx,
        debt,
        existingTransaction,
        existingTransaction.type === DEBT_TRANSACTION_CLOSED || existingTransaction.type === DEBT_TRANSACTION_ADDED
          ? {
              accountId: nextTransactionAccountId,
              type: existingTransaction.type,
              amount: input.amount,
              toAmount: nextTransactionToAmount,
            }
          : {
              accountId: existingTransaction.accountId,
              type: existingTransaction.type,
              amount: input.amount,
              toAmount: null,
            }
      );

      await tx.debt.update({
        where: { id: debt.id },
        data: {
          amount: nextDebtAmount,
          remainingAmount: nextRemainingAmount,
          status: getDebtStatusFromRemainingAmount(nextRemainingAmount),
        },
      });

      const updatedTransaction = await tx.debtTransaction.update({
        where: { id: debtTransactionId },
        data: {
          accountId: nextTransactionAccountId,
          amount: input.amount,
          toAmount: nextTransactionToAmount,
          date: input.date,
        },
        include: ACCESSIBLE_DEBT_TRANSACTION_INCLUDE,
      });

      return updatedTransaction as AccessibleDebtTransaction;
    });

    return { debtTransaction: toDebtTransactionDto(debtTransaction) };
  }

  async deleteDebtTransaction(debtTransactionId: string, currentUser: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const debtTransaction = await this.getAccessibleDebtTransactionOrThrow(tx, debtTransactionId, currentUser);
      const debt = debtTransaction.debt;

      if (debtTransaction.type === DEBT_TRANSACTION_CREATED) {
        throw new BadRequestException("Начальную транзакцию долга нужно удалять вместе с долгом");
      }

      const totals = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
      const nextDebtAmount = addMoney(debt.amount, subtractMoney("0", totals.amountDelta));
      const nextRemainingAmount = addMoney(debt.remainingAmount, subtractMoney("0", totals.remainingDelta));

      if (compareMoney(nextRemainingAmount, "0") < 0) {
        throw new BadRequestException("Нельзя удалить транзакцию: её сумма уже учтена в погашенной части долга");
      }

      await this.reconcileDebtTransactionBalanceEffect(tx, debt, debtTransaction, null);

      await tx.debt.update({
        where: { id: debt.id },
        data: {
          amount: nextDebtAmount,
          remainingAmount: nextRemainingAmount,
          status: getDebtStatusFromRemainingAmount(nextRemainingAmount),
        },
      });

      await tx.debtTransaction.delete({
        where: { id: debtTransactionId },
      });
    });
  }
}
