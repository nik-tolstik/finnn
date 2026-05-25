import type { DebtTransaction, Prisma } from "@prisma/client";

import { success } from "@/shared/lib/action-result";
import {
  addAccountBalanceDelta as addBalanceDelta,
  applyBalanceDelta,
  assertNonNegativeBalance,
  getDebtDeletionBalanceDelta,
  getDebtInitialAccountBalanceDelta,
  getDebtTransactionBalanceDelta,
  getDebtTransactionTotalsDelta,
  getPaymentTransactionBalanceDelta,
} from "@/shared/lib/balance-domain";
import { asAccountId, asDebtId, asMoneyAmount, asWorkspaceId } from "@/shared/lib/domain-types";
import { prisma } from "@/shared/lib/prisma";
import type {
  AddToDebtInput,
  CloseDebtInput,
  CreateDebtInput,
  UpdateDebtInput,
  UpdateDebtTransactionInput,
} from "@/shared/lib/validations/debt";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { CategoryType } from "../categories/category.constants";
import { PaymentTransactionType } from "../transactions/transaction.constants";
import { DebtStatus, DebtTransactionType, DebtType } from "./debt.constants";

type PrismaTx = Prisma.TransactionClient;

type AccessibleDebt = Prisma.DebtGetPayload<{
  include: { account: true };
}>;

type AccessibleDebtTransaction = Prisma.DebtTransactionGetPayload<{
  include: {
    debt: {
      include: {
        account: true;
      };
    };
    account: true;
  };
}>;

type DebtTransactionBalanceEffect = Pick<DebtTransaction, "accountId" | "type" | "amount" | "toAmount">;

async function getWorkspaceAccountOrThrow(
  tx: PrismaTx,
  workspaceId: string,
  accountId: string,
  errorMessage = "Счёт не найден"
) {
  const account = await tx.account.findFirst({
    where: {
      id: asAccountId(accountId),
      workspaceId: asWorkspaceId(workspaceId),
    },
  });

  if (!account) {
    throw new Error(errorMessage);
  }

  return account;
}

async function getAccessibleDebtOrThrow(tx: PrismaTx, userId: string, debtId: string): Promise<AccessibleDebt> {
  const debt = await tx.debt.findFirst({
    where: {
      id: asDebtId(debtId),
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: { account: true },
  });

  if (!debt) {
    throw new Error("Долг не найден или доступ запрещён");
  }

  return debt;
}

async function getAccessibleDebtTransactionOrThrow(
  tx: PrismaTx,
  userId: string,
  debtTransactionId: string
): Promise<AccessibleDebtTransaction> {
  const debtTransaction = await tx.debtTransaction.findFirst({
    where: {
      id: debtTransactionId,
      workspace: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      debt: {
        include: {
          account: true,
        },
      },
      account: true,
    },
  });

  if (!debtTransaction) {
    throw new Error("Транзакция долга не найдена или доступ запрещён");
  }

  return debtTransaction;
}

function getDebtStatusFromRemainingAmount(remainingAmount: string) {
  return compareMoney(remainingAmount, "0") <= 0 ? DebtStatus.CLOSED : DebtStatus.OPEN;
}

async function applyInitialAmountDeltaToAccount(tx: PrismaTx, debt: AccessibleDebt, amountDelta: string) {
  if (!debt.accountId || compareMoney(amountDelta, "0") === 0) {
    return;
  }

  const account = await tx.account.findUnique({
    where: { id: debt.accountId },
  });

  if (!account) {
    return;
  }

  const balanceDelta = getDebtInitialAccountBalanceDelta(debt.type, amountDelta);
  const nextBalance = applyBalanceDelta(account.balance, balanceDelta);

  if (compareMoney(nextBalance, "0") < 0) {
    throw new Error(`Недостаточно средств на счёте (${account.balance})`);
  }

  await tx.account.update({
    where: { id: debt.accountId },
    data: { balance: nextBalance },
  });
}

function minMoney(a: string, b: string) {
  return asMoneyAmount(compareMoney(a, b) <= 0 ? a : b);
}

async function getWorkspaceCategoryOrThrow(tx: PrismaTx, workspaceId: string, categoryId: string, type: CategoryType) {
  const category = await tx.category.findFirst({
    where: {
      id: categoryId,
      workspaceId: asWorkspaceId(workspaceId),
      type,
    },
  });

  if (!category) {
    throw new Error("Категория не найдена или не подходит для этой операции");
  }

  return category;
}

function getCategoryTransactionType(debtType: string, isEarlyClose: boolean) {
  if (debtType === DebtType.LENT) {
    return isEarlyClose ? PaymentTransactionType.EXPENSE : PaymentTransactionType.INCOME;
  }

  return isEarlyClose ? PaymentTransactionType.INCOME : PaymentTransactionType.EXPENSE;
}

function getCategoryTypeFromPaymentType(paymentType: PaymentTransactionType) {
  return paymentType === PaymentTransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
}

async function applyAccountBalanceDeltas(
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
      workspaceId: asWorkspaceId(workspaceId),
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
      throw new Error("Счёт не найден");
    }

    const nextBalance = applyBalanceDelta(account.balance, delta);
    assertNonNegativeBalance(nextBalance, `Недостаточно средств на счёте "${account.name}" (${account.balance})`);

    await tx.account.update({
      where: { id: accountId },
      data: { balance: nextBalance },
    });
  }
}

async function reconcileDebtTransactionBalanceEffect(
  tx: PrismaTx,
  debt: Pick<AccessibleDebt, "workspaceId" | "type">,
  previousTransaction?: DebtTransactionBalanceEffect | null,
  nextTransaction?: DebtTransactionBalanceEffect | null
) {
  const balanceDeltasByAccount = new Map<string, string>();

  if (previousTransaction?.accountId) {
    addBalanceDelta(
      balanceDeltasByAccount,
      previousTransaction.accountId,
      getDebtDeletionBalanceDelta(debt.type, previousTransaction)
    );
  }

  if (nextTransaction?.accountId) {
    addBalanceDelta(
      balanceDeltasByAccount,
      nextTransaction.accountId,
      getDebtTransactionBalanceDelta(debt.type, nextTransaction)
    );
  }

  await applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);
}

export async function createDebtApplication(workspaceId: string, input: CreateDebtInput) {
  const validated = {
    ...input,
    workspaceId: asWorkspaceId(workspaceId),
    accountId: input.accountId ? asAccountId(input.accountId) : undefined,
    amount: asMoneyAmount(input.amount),
    currency: input.currency,
  };

  return prisma.$transaction(async (tx) => {
    let currency = validated.currency || "BYN";
    let accountId: string | null = null;

    if (validated.useAccount && validated.accountId) {
      const account = await getWorkspaceAccountOrThrow(tx, validated.workspaceId, validated.accountId);

      currency = account.currency;
      accountId = account.id;

      const nextBalance = applyBalanceDelta(
        account.balance,
        getDebtInitialAccountBalanceDelta(validated.type, validated.amount)
      );
      assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

      await tx.account.update({
        where: { id: account.id },
        data: { balance: nextBalance },
      });
    }

    const createdDebt = await tx.debt.create({
      data: {
        workspaceId: validated.workspaceId,
        type: validated.type,
        personName: validated.personName,
        amount: validated.amount,
        remainingAmount: validated.amount,
        currency,
        accountId,
        date: validated.date,
        status: DebtStatus.OPEN,
      },
    });

    await tx.debtTransaction.create({
      data: {
        workspaceId: validated.workspaceId,
        debtId: createdDebt.id,
        accountId,
        type: DebtTransactionType.CREATED,
        amount: validated.amount,
        date: validated.date,
      },
    });

    return createdDebt;
  });
}

export async function closeDebtApplication(id: string, userId: string, input: CloseDebtInput) {
  const debtId = asDebtId(id);
  const validated = {
    ...input,
    amount: asMoneyAmount(input.amount),
    paymentAmount: input.paymentAmount ? asMoneyAmount(input.paymentAmount) : undefined,
    toAmount: input.toAmount ? asMoneyAmount(input.toAmount) : undefined,
    accountId: input.accountId ? asAccountId(input.accountId) : undefined,
  };

  return prisma.$transaction(async (tx) => {
    const debt = await getAccessibleDebtOrThrow(tx, userId, debtId);

    if (debt.status === DebtStatus.CLOSED) {
      throw new Error("Долг уже закрыт");
    }

    let closeAmount = validated.amount;
    let categoryAmount = asMoneyAmount("0");
    let categoryTransactionType: PaymentTransactionType | null = null;
    const closeDate = new Date();
    let currenciesMatch = true;

    if (validated.useAccount && validated.accountId) {
      const account = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, validated.accountId);
      currenciesMatch = account.currency === debt.currency;

      if (!currenciesMatch && !validated.toAmount) {
        throw new Error("Укажите сумму отправления");
      }

      if (
        !currenciesMatch &&
        (validated.closeEarly ||
          (validated.paymentAmount && compareMoney(validated.paymentAmount, validated.amount) > 0))
      ) {
        throw new Error("Подарок при закрытии долга доступен только в валюте долга");
      }

      if (currenciesMatch && validated.paymentAmount) {
        closeAmount = validated.closeEarly
          ? asMoneyAmount(debt.remainingAmount)
          : minMoney(validated.paymentAmount, debt.remainingAmount);

        if (validated.closeEarly && compareMoney(validated.paymentAmount, debt.remainingAmount) < 0) {
          categoryAmount = subtractMoney(debt.remainingAmount, validated.paymentAmount);
          categoryTransactionType = getCategoryTransactionType(debt.type, true);
        } else if (compareMoney(validated.paymentAmount, debt.remainingAmount) > 0) {
          categoryAmount = subtractMoney(validated.paymentAmount, debt.remainingAmount);
          categoryTransactionType = getCategoryTransactionType(debt.type, false);
        }
      }

      if (compareMoney(closeAmount, debt.remainingAmount) > 0) {
        throw new Error(`Сумма не может превышать остаток долга (${debt.remainingAmount})`);
      }

      let categoryId: string | null = null;

      if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType) {
        if (!validated.categoryId) {
          throw new Error("Выберите категорию");
        }

        const categoryType = getCategoryTypeFromPaymentType(categoryTransactionType);
        const category = await getWorkspaceCategoryOrThrow(tx, debt.workspaceId, validated.categoryId, categoryType);
        categoryId = category.id;
      }

      let balanceDelta = getDebtTransactionBalanceDelta(debt.type, {
        accountId: validated.accountId,
        type: DebtTransactionType.CLOSED,
        amount: closeAmount,
        toAmount: !currenciesMatch ? validated.toAmount || closeAmount : null,
      });

      if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType) {
        balanceDelta = addMoney(
          balanceDelta,
          getPaymentTransactionBalanceDelta(categoryTransactionType, categoryAmount)
        );
      }

      const nextBalance = applyBalanceDelta(account.balance, balanceDelta);
      assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

      await tx.account.update({
        where: { id: validated.accountId },
        data: { balance: nextBalance },
      });

      if (compareMoney(categoryAmount, "0") > 0 && categoryTransactionType && categoryId) {
        await tx.paymentTransaction.create({
          data: {
            workspaceId: debt.workspaceId,
            accountId: validated.accountId,
            amount: categoryAmount,
            type: categoryTransactionType,
            description: `Закрытие долга: ${debt.personName}`,
            date: closeDate,
            categoryId,
          },
        });
      }
    } else if (compareMoney(closeAmount, debt.remainingAmount) > 0) {
      throw new Error(`Сумма не может превышать остаток долга (${debt.remainingAmount})`);
    }

    const newRemainingAmount = subtractMoney(debt.remainingAmount, closeAmount);
    const isClosed = compareMoney(newRemainingAmount, "0") <= 0;

    const nextDebt = await tx.debt.update({
      where: { id: debtId },
      data: {
        remainingAmount: newRemainingAmount,
        status: isClosed ? DebtStatus.CLOSED : DebtStatus.OPEN,
      },
    });

    await tx.debtTransaction.create({
      data: {
        workspaceId: debt.workspaceId,
        debtId: debt.id,
        accountId: validated.useAccount ? validated.accountId || null : null,
        type: DebtTransactionType.CLOSED,
        amount: closeAmount,
        toAmount: !currenciesMatch ? validated.toAmount : null,
        date: closeDate,
      },
    });

    return nextDebt;
  });
}

export async function addToDebtApplication(id: string, userId: string, input: AddToDebtInput) {
  const debtId = asDebtId(id);
  const validated = {
    ...input,
    amount: asMoneyAmount(input.amount),
  };

  return prisma.$transaction(async (tx) => {
    const debt = await getAccessibleDebtOrThrow(tx, userId, debtId);

    if (debt.status === DebtStatus.CLOSED) {
      throw new Error("Нельзя добавить к закрытому долгу");
    }

    if (validated.useAccount && debt.accountId && debt.account) {
      const account = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, debt.accountId);
      const nextBalance = applyBalanceDelta(
        account.balance,
        getDebtInitialAccountBalanceDelta(debt.type, validated.amount)
      );
      assertNonNegativeBalance(nextBalance, `Сумма не может превышать баланс счёта (${account.balance})`);

      await tx.account.update({
        where: { id: debt.accountId },
        data: { balance: nextBalance },
      });
    }

    const nextDebt = await tx.debt.update({
      where: { id: debtId },
      data: {
        amount: addMoney(debt.amount, validated.amount),
        remainingAmount: addMoney(debt.remainingAmount, validated.amount),
      },
    });

    await tx.debtTransaction.create({
      data: {
        workspaceId: debt.workspaceId,
        debtId: debt.id,
        accountId: validated.useAccount && debt.accountId ? debt.accountId : null,
        type: DebtTransactionType.ADDED,
        amount: validated.amount,
        date: new Date(),
      },
    });

    return nextDebt;
  });
}

export async function deleteDebtApplication(id: string, userId: string) {
  const debtId = asDebtId(id);

  await prisma.$transaction(async (tx) => {
    const debt = await getAccessibleDebtOrThrow(tx, userId, debtId);
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

      addBalanceDelta(
        balanceDeltasByAccount,
        transaction.accountId,
        getDebtDeletionBalanceDelta(debt.type, transaction)
      );
    }

    await applyAccountBalanceDeltas(tx, debt.workspaceId, balanceDeltasByAccount);

    await tx.debtTransaction.deleteMany({
      where: { debtId: debt.id },
    });

    await tx.debt.delete({
      where: { id: debtId },
    });
  });
}

export async function updateDebtApplication(debtId: string, userId: string, input: UpdateDebtInput) {
  const id = asDebtId(debtId);
  const validated = {
    ...input,
    amount: asMoneyAmount(input.amount),
  };

  return prisma.$transaction(async (tx) => {
    const debt = await getAccessibleDebtOrThrow(tx, userId, id);

    let initialTransaction = await tx.debtTransaction.findFirst({
      where: {
        debtId: id,
        type: DebtTransactionType.CREATED,
      },
    });

    if (!initialTransaction) {
      initialTransaction = await tx.debtTransaction.findFirst({
        where: { debtId: id },
        orderBy: { date: "asc" },
      });
    }

    const oldInitial = initialTransaction?.amount || debt.amount;
    const amountDelta = subtractMoney(validated.amount, oldInitial);
    const newRemaining = addMoney(debt.remainingAmount, amountDelta);

    if (compareMoney(newRemaining, "0") < 0) {
      throw new Error(
        `Новая изначальная сумма не может быть меньше ${subtractMoney(oldInitial, debt.remainingAmount)} (остаток долга учтён)`
      );
    }

    await applyInitialAmountDeltaToAccount(tx, debt, amountDelta);

    const nextDebt = await tx.debt.update({
      where: { id },
      data: {
        personName: validated.personName,
        date: validated.date,
        amount: addMoney(debt.amount, amountDelta),
        remainingAmount: newRemaining,
        status: getDebtStatusFromRemainingAmount(newRemaining),
      },
    });

    if (initialTransaction) {
      await tx.debtTransaction.update({
        where: { id: initialTransaction.id },
        data: {
          amount: validated.amount,
          date: validated.date,
        },
      });
    } else {
      await tx.debtTransaction.create({
        data: {
          workspaceId: debt.workspaceId,
          debtId,
          accountId: debt.accountId,
          type: DebtTransactionType.CREATED,
          amount: validated.amount,
          date: validated.date,
        },
      });
    }

    return nextDebt;
  });
}

export async function updateDebtTransactionApplication(id: string, userId: string, input: UpdateDebtTransactionInput) {
  const validated = {
    ...input,
    amount: asMoneyAmount(input.amount),
    toAmount: input.toAmount ? asMoneyAmount(input.toAmount) : undefined,
    accountId: input.accountId ? asAccountId(input.accountId) : undefined,
  };

  return prisma.$transaction(async (tx) => {
    const debtTransaction = await getAccessibleDebtTransactionOrThrow(tx, userId, id);
    const debt = debtTransaction.debt;

    if (debtTransaction.type === DebtTransactionType.CREATED) {
      throw new Error("Начальную транзакцию нужно редактировать через редактирование долга");
    }

    const currentTotals = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
    const nextTotals = getDebtTransactionTotalsDelta(debtTransaction.type, validated.amount);
    const nextDebtAmount = addMoney(debt.amount, subtractMoney(nextTotals.amountDelta, currentTotals.amountDelta));
    const nextRemainingAmount = addMoney(
      debt.remainingAmount,
      subtractMoney(nextTotals.remainingDelta, currentTotals.remainingDelta)
    );

    if (compareMoney(nextRemainingAmount, "0") < 0) {
      if (debtTransaction.type === DebtTransactionType.ADDED) {
        throw new Error(
          `Новая сумма не может быть меньше ${subtractMoney(debtTransaction.amount, debt.remainingAmount)} (остаток долга учтён)`
        );
      }

      throw new Error(
        `Сумма не может превышать остаток долга (${addMoney(debt.remainingAmount, debtTransaction.amount)})`
      );
    }

    let nextTransactionAccountId = debtTransaction.accountId;
    let nextTransactionToAmount: string | null = debtTransaction.toAmount;

    if (debtTransaction.type === DebtTransactionType.CLOSED) {
      if (!validated.accountId) {
        throw new Error("Выберите счёт");
      }

      const nextAccount = await getWorkspaceAccountOrThrow(tx, debt.workspaceId, validated.accountId);
      const currenciesMatch = nextAccount.currency === debt.currency;

      if (!currenciesMatch && !validated.toAmount) {
        throw new Error("Укажите сумму отправления");
      }

      nextTransactionAccountId = nextAccount.id;
      nextTransactionToAmount = currenciesMatch ? null : validated.toAmount || null;
    }

    await reconcileDebtTransactionBalanceEffect(
      tx,
      debt,
      debtTransaction,
      debtTransaction.type === DebtTransactionType.CLOSED
        ? {
            accountId: nextTransactionAccountId,
            type: debtTransaction.type,
            amount: validated.amount,
            toAmount: nextTransactionToAmount,
          }
        : {
            accountId: debtTransaction.accountId,
            type: debtTransaction.type,
            amount: validated.amount,
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

    return tx.debtTransaction.update({
      where: { id },
      data: {
        accountId: nextTransactionAccountId,
        amount: validated.amount,
        toAmount: nextTransactionToAmount,
        date: validated.date,
      },
    });
  });
}

export async function deleteDebtTransactionApplication(id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const debtTransaction = await getAccessibleDebtTransactionOrThrow(tx, userId, id);
    const debt = debtTransaction.debt;

    if (debtTransaction.type === DebtTransactionType.CREATED) {
      throw new Error("Начальную транзакцию долга нужно удалять вместе с долгом");
    }

    const totals = getDebtTransactionTotalsDelta(debtTransaction.type, debtTransaction.amount);
    const nextDebtAmount = addMoney(debt.amount, subtractMoney("0", totals.amountDelta));
    const nextRemainingAmount = addMoney(debt.remainingAmount, subtractMoney("0", totals.remainingDelta));

    if (compareMoney(nextRemainingAmount, "0") < 0) {
      throw new Error("Нельзя удалить транзакцию: её сумма уже учтена в погашенной части долга");
    }

    await reconcileDebtTransactionBalanceEffect(tx, debt, debtTransaction, null);

    await tx.debt.update({
      where: { id: debt.id },
      data: {
        amount: nextDebtAmount,
        remainingAmount: nextRemainingAmount,
        status: getDebtStatusFromRemainingAmount(nextRemainingAmount),
      },
    });

    await tx.debtTransaction.delete({
      where: { id },
    });

    return success();
  });
}
