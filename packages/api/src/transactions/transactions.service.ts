import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Account,
  Category,
  Debt,
  DebtTransaction,
  PaymentTransaction,
  Prisma,
  TransferTransaction,
  User,
} from "@prisma/client";
import Big from "big.js";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import type {
  CombinedTransactionsQueryDto,
  CreatePaymentTransactionDto,
  CreateTransferTransactionDto,
  UpdatePaymentTransactionDto,
  UpdateTransferTransactionDto,
} from "./transactions.dto";

const PAYMENT_INCOME = "income";
const PAYMENT_EXPENSE = "expense";
const TRANSFER_TRANSACTION_FILTER_VALUE = "transfer";
const DEBT_TRANSACTION_FILTER_VALUE = "debt";

const ACCOUNT_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const ACCOUNT_WITH_OWNER_SELECT = {
  id: true,
  name: true,
  currency: true,
  color: true,
  icon: true,
  ownerId: true,
  owner: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.AccountSelect;

const CATEGORY_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const PAYMENT_TRANSACTION_INCLUDE = {
  account: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  category: {
    select: CATEGORY_SELECT,
  },
} satisfies Prisma.PaymentTransactionInclude;

const TRANSFER_TRANSACTION_INCLUDE = {
  fromAccount: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  toAccount: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  createdBy: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.TransferTransactionInclude;

const DEBT_TRANSACTION_INCLUDE = {
  debt: {
    select: {
      id: true,
      workspaceId: true,
      type: true,
      personName: true,
      amount: true,
      remainingAmount: true,
      currency: true,
      date: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  account: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
} satisfies Prisma.DebtTransactionInclude;

type PrismaTx = Prisma.TransactionClient;
type TransactionUser = Pick<User, "id" | "name" | "email" | "image">;
type TransactionAccount = Pick<Account, "id" | "name" | "currency" | "color" | "icon" | "ownerId"> & {
  owner: TransactionUser | null;
};
type TransactionCategory = Pick<Category, "id" | "name">;
type PaymentTransactionWithRelations = PaymentTransaction & {
  account: TransactionAccount;
  category: TransactionCategory | null;
};
type TransferTransactionWithRelations = TransferTransaction & {
  fromAccount: TransactionAccount;
  toAccount: TransactionAccount;
  createdBy: TransactionUser | null;
};
type DebtTransactionWithRelations = DebtTransaction & {
  debt: Pick<
    Debt,
    | "id"
    | "workspaceId"
    | "type"
    | "personName"
    | "amount"
    | "remainingAmount"
    | "currency"
    | "date"
    | "status"
    | "createdAt"
    | "updatedAt"
  >;
  account: TransactionAccount | null;
};
type CombinedTransaction =
  | { kind: "paymentTransaction"; data: PaymentTransactionWithRelations }
  | { kind: "transferTransaction"; data: TransferTransactionWithRelations }
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations };

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

function getPaymentTransactionBalanceDelta(type: string, amount: string): string {
  if (type === PAYMENT_INCOME) return amount;
  if (type === PAYMENT_EXPENSE) return subtractMoney("0", amount);
  return "0";
}

function applyPaymentTransactionBalance(balance: string, type: string, amount: string): string {
  return addMoney(balance, getPaymentTransactionBalanceDelta(type, amount));
}

function revertPaymentTransactionBalance(balance: string, type: string, amount: string): string {
  return addMoney(balance, subtractMoney("0", getPaymentTransactionBalanceDelta(type, amount)));
}

function getTransferTransactionBalanceDeltas(amount: string, toAmount: string) {
  return {
    fromDelta: subtractMoney("0", amount),
    toDelta: toAmount,
  };
}

function hasAmountRangeFilter(filters?: CombinedTransactionsQueryDto) {
  return Boolean(filters?.amountFrom || filters?.amountTo);
}

function buildDateWhere(filters?: CombinedTransactionsQueryDto) {
  const date: Prisma.DateTimeFilter = {};

  if (filters?.dateFrom) {
    date.gte = new Date(`${filters.dateFrom}T00:00:00`);
  }

  if (filters?.dateTo) {
    date.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return Object.keys(date).length > 0 ? date : undefined;
}

function getSelectedPaymentTypes(filters?: CombinedTransactionsQueryDto) {
  return (
    filters?.transactionTypes?.filter(
      (type): type is typeof PAYMENT_INCOME | typeof PAYMENT_EXPENSE =>
        type === PAYMENT_INCOME || type === PAYMENT_EXPENSE
    ) || []
  );
}

function shouldQueryPaymentTransactions(filters?: CombinedTransactionsQueryDto) {
  if (!filters?.transactionTypes?.length) return true;
  return getSelectedPaymentTypes(filters).length > 0;
}

function shouldQueryTransferTransactions(filters?: CombinedTransactionsQueryDto) {
  if (filters?.categoryIds?.length) return false;
  if (!filters?.transactionTypes?.length) return true;
  return filters.transactionTypes.includes(TRANSFER_TRANSACTION_FILTER_VALUE);
}

function shouldQueryDebtTransactions(filters?: CombinedTransactionsQueryDto) {
  if (filters?.categoryIds?.length || filters?.description || filters?.includeDebtTransactions === false) {
    return false;
  }

  if (!filters?.transactionTypes?.length) return true;
  return filters.transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
}

function buildPaymentTransactionWhere(workspaceId: string, filters?: CombinedTransactionsQueryDto) {
  const where: Prisma.PaymentTransactionWhereInput = { workspaceId };
  const date = buildDateWhere(filters);
  const selectedPaymentTypes = getSelectedPaymentTypes(filters);

  if (date) where.date = date;
  if (selectedPaymentTypes.length > 0) where.type = { in: selectedPaymentTypes };
  if (filters?.accountIds?.length) where.accountId = { in: filters.accountIds };
  if (filters?.categoryIds?.length) where.categoryId = { in: filters.categoryIds };
  if (filters?.description) where.description = { contains: filters.description, mode: "insensitive" };
  if (filters?.userIds?.length) {
    where.account = {
      is: {
        ownerId: { in: filters.userIds },
      },
    };
  }

  return where;
}

function buildTransferTransactionWhere(workspaceId: string, filters?: CombinedTransactionsQueryDto) {
  const where: Prisma.TransferTransactionWhereInput = { workspaceId };
  const date = buildDateWhere(filters);

  if (date) where.date = date;
  if (filters?.description) where.description = { contains: filters.description, mode: "insensitive" };
  if (filters?.accountIds?.length) {
    where.OR = [{ fromAccountId: { in: filters.accountIds } }, { toAccountId: { in: filters.accountIds } }];
  }

  if (filters?.userIds?.length) {
    const userFilter: Prisma.TransferTransactionWhereInput[] = [
      {
        fromAccount: {
          is: {
            ownerId: { in: filters.userIds },
          },
        },
      },
      {
        toAccount: {
          is: {
            ownerId: { in: filters.userIds },
          },
        },
      },
    ];

    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: userFilter }];
  }

  return where;
}

function buildDebtTransactionWhere(workspaceId: string, filters?: CombinedTransactionsQueryDto) {
  const where: Prisma.DebtTransactionWhereInput = {
    workspaceId,
    debt: {
      is: {
        workspaceId,
      },
    },
  };
  const date = buildDateWhere(filters);

  if (date) where.date = date;
  if (filters?.accountIds?.length) where.accountId = { in: filters.accountIds };
  if (filters?.userIds?.length) {
    where.account = {
      is: {
        ownerId: { in: filters.userIds },
      },
    };
  }

  return where;
}

function matchesAmountRange(amounts: Array<string | null | undefined>, filters?: CombinedTransactionsQueryDto) {
  if (!filters?.amountFrom && !filters?.amountTo) return true;

  const candidateAmounts = amounts.filter((amount): amount is string => Boolean(amount));

  return candidateAmounts.some((amount) => {
    if (filters.amountFrom && compareMoney(amount, filters.amountFrom) < 0) return false;
    if (filters.amountTo && compareMoney(amount, filters.amountTo) > 0) return false;
    return true;
  });
}

function filterCombinedTransactions(transactions: CombinedTransaction[], filters?: CombinedTransactionsQueryDto) {
  return transactions.filter((transaction) => {
    if (transaction.kind === "paymentTransaction") {
      return matchesAmountRange([transaction.data.amount], filters);
    }

    return matchesAmountRange([transaction.data.amount, transaction.data.toAmount], filters);
  });
}

function sortCombinedTransactionsByDate(transactions: CombinedTransaction[]) {
  return transactions.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

function toAccountDto(account: TransactionAccount) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color,
    icon: account.icon,
    ownerId: account.ownerId,
    owner: account.owner,
  };
}

function toPaymentTransactionDto(transaction: PaymentTransactionWithRelations) {
  return {
    id: transaction.id,
    workspaceId: transaction.workspaceId,
    accountId: transaction.accountId,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description,
    date: toIsoString(transaction.date),
    categoryId: transaction.categoryId,
    createdAt: toIsoString(transaction.createdAt),
    updatedAt: toIsoString(transaction.updatedAt),
    account: toAccountDto(transaction.account),
    category: transaction.category,
  };
}

function toTransferTransactionDto(transaction: TransferTransactionWithRelations) {
  return {
    id: transaction.id,
    workspaceId: transaction.workspaceId,
    fromAccountId: transaction.fromAccountId,
    toAccountId: transaction.toAccountId,
    createdById: transaction.createdById,
    amount: transaction.amount,
    toAmount: transaction.toAmount,
    description: transaction.description,
    date: toIsoString(transaction.date),
    createdAt: toIsoString(transaction.createdAt),
    updatedAt: toIsoString(transaction.updatedAt),
    fromAccount: toAccountDto(transaction.fromAccount),
    toAccount: toAccountDto(transaction.toAccount),
    createdBy: transaction.createdBy,
  };
}

function toDebtTransactionDto(transaction: DebtTransactionWithRelations) {
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
    debt: {
      ...transaction.debt,
      date: toIsoString(transaction.debt.date),
      createdAt: toIsoString(transaction.debt.createdAt),
      updatedAt: toIsoString(transaction.debt.updatedAt),
    },
    account: transaction.account ? toAccountDto(transaction.account) : null,
  };
}

function toCombinedTransactionDto(transaction: CombinedTransaction) {
  if (transaction.kind === "paymentTransaction") {
    return { kind: transaction.kind, data: toPaymentTransactionDto(transaction.data) };
  }

  if (transaction.kind === "transferTransaction") {
    return { kind: transaction.kind, data: toTransferTransactionDto(transaction.data) };
  }

  return { kind: transaction.kind, data: toDebtTransactionDto(transaction.data) };
}

@Injectable()
export class TransactionsService {
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

  async createPaymentTransaction(
    workspaceId: string,
    input: CreatePaymentTransactionDto,
    currentUser: AuthenticatedUser
  ) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const transaction = await this.prisma.$transaction(async (tx) => {
      const account = await this.getWorkspaceAccountOrThrow(tx, workspaceId, input.accountId);
      const accountCreatedDate = new Date(account.createdAt);
      accountCreatedDate.setHours(0, 0, 0, 0);
      const transactionDate = new Date(input.date);
      transactionDate.setHours(0, 0, 0, 0);

      if (transactionDate < accountCreatedDate) {
        throw new BadRequestException(
          `Дата транзакции не может быть раньше даты создания счета (${accountCreatedDate.toLocaleDateString("ru-RU")})`
        );
      }

      if (input.type === PAYMENT_EXPENSE && compareMoney(input.amount, account.balance) > 0) {
        throw new BadRequestException(`Сумма не может превышать баланс счёта (${account.balance})`);
      }

      let finalCategoryId = input.categoryId;
      if (input.newCategory) {
        const category = await tx.category.create({
          data: {
            workspaceId,
            name: input.newCategory.name,
            type: input.newCategory.type,
          },
        });
        finalCategoryId = category.id;
      }

      const createdTransaction = await tx.paymentTransaction.create({
        data: {
          workspaceId,
          accountId: input.accountId,
          amount: input.amount,
          type: input.type,
          description: input.description,
          date: input.date,
          categoryId: finalCategoryId,
        },
        include: PAYMENT_TRANSACTION_INCLUDE,
      });

      await tx.account.update({
        where: { id: input.accountId },
        data: { balance: applyPaymentTransactionBalance(account.balance, input.type, input.amount) },
      });

      return createdTransaction as PaymentTransactionWithRelations;
    });

    return { transaction: toPaymentTransactionDto(transaction) };
  }

  async createTransferTransaction(
    workspaceId: string,
    input: CreateTransferTransactionDto,
    currentUser: AuthenticatedUser
  ) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const transfer = await this.prisma.$transaction(async (tx) => {
      const fromAccount = await this.getWorkspaceAccountOrThrow(tx, workspaceId, input.fromAccountId);
      const toAccount = await this.getWorkspaceAccountOrThrow(tx, workspaceId, input.toAccountId);

      if (fromAccount.id === toAccount.id) {
        throw new BadRequestException("Нельзя перевести на тот же счёт");
      }

      if (compareMoney(input.amount, fromAccount.balance) > 0) {
        throw new BadRequestException(`Сумма отправления не может превышать баланс счёта (${fromAccount.balance})`);
      }

      const createdTransfer = await tx.transferTransaction.create({
        data: {
          workspaceId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          createdById: currentUser.id,
          amount: input.amount,
          toAmount: input.toAmount,
          description: input.description,
          date: input.date,
        },
        include: TRANSFER_TRANSACTION_INCLUDE,
      });

      const transferDeltas = getTransferTransactionBalanceDeltas(input.amount, input.toAmount);

      await tx.account.update({
        where: { id: input.fromAccountId },
        data: { balance: addMoney(fromAccount.balance, transferDeltas.fromDelta) },
      });

      await tx.account.update({
        where: { id: input.toAccountId },
        data: { balance: addMoney(toAccount.balance, transferDeltas.toDelta) },
      });

      return createdTransfer as TransferTransactionWithRelations;
    });

    return { transfer: toTransferTransactionDto(transfer) };
  }

  async updatePaymentTransaction(
    transactionId: string,
    input: UpdatePaymentTransactionDto,
    currentUser: AuthenticatedUser
  ) {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const existingTransaction = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { account: true },
      });

      if (!existingTransaction) {
        throw new NotFoundException("Транзакция не найдена или доступ запрещён");
      }

      await this.assertWorkspaceAccessWithClient(tx, existingTransaction.workspaceId, currentUser);

      const oldAccountId = existingTransaction.accountId;
      const newAccountId = input.accountId || oldAccountId;
      const accountChanged = oldAccountId !== newAccountId;
      const oldAmount = existingTransaction.amount;
      const newAmount = input.amount || oldAmount;
      const amountChanged = oldAmount !== newAmount;

      if (accountChanged || amountChanged) {
        const oldAccount = await tx.account.findUnique({
          where: { id: oldAccountId },
        });

        if (!oldAccount) {
          throw new NotFoundException("Старый счёт не найден");
        }

        const revertedOldBalance = revertPaymentTransactionBalance(
          oldAccount.balance,
          existingTransaction.type,
          oldAmount
        );

        if (accountChanged) {
          const newAccount = await this.getWorkspaceAccountOrThrow(
            tx,
            existingTransaction.workspaceId,
            newAccountId,
            "Новый счёт не найден"
          );

          if (existingTransaction.type === PAYMENT_EXPENSE && compareMoney(newAmount, newAccount.balance) > 0) {
            throw new BadRequestException(`Сумма не может превышать баланс счёта (${newAccount.balance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: revertedOldBalance },
          });

          await tx.account.update({
            where: { id: newAccountId },
            data: {
              balance: applyPaymentTransactionBalance(newAccount.balance, existingTransaction.type, newAmount),
            },
          });
        } else {
          if (existingTransaction.type === PAYMENT_EXPENSE && compareMoney(newAmount, revertedOldBalance) > 0) {
            throw new BadRequestException(`Сумма не может превышать баланс счёта (${revertedOldBalance})`);
          }

          await tx.account.update({
            where: { id: oldAccountId },
            data: { balance: applyPaymentTransactionBalance(revertedOldBalance, existingTransaction.type, newAmount) },
          });
        }
      }

      const updateData: Prisma.PaymentTransactionUpdateInput = {};
      if (input.accountId !== undefined) updateData.account = { connect: { id: input.accountId } };
      if (input.amount !== undefined) updateData.amount = input.amount;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.categoryId !== undefined) {
        updateData.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
      }

      const updated = await tx.paymentTransaction.update({
        where: { id: transactionId },
        data: updateData,
        include: PAYMENT_TRANSACTION_INCLUDE,
      });

      return updated as PaymentTransactionWithRelations;
    });

    return { transaction: toPaymentTransactionDto(transaction) };
  }

  async updateTransferTransaction(
    transactionId: string,
    input: UpdateTransferTransactionDto,
    currentUser: AuthenticatedUser
  ) {
    const transfer = await this.prisma.$transaction(async (tx) => {
      const existingTransfer = await tx.transferTransaction.findUnique({
        where: { id: transactionId },
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });

      if (!existingTransfer) {
        throw new NotFoundException("Перевод не найден или доступ запрещён");
      }

      await this.assertWorkspaceAccessWithClient(tx, existingTransfer.workspaceId, currentUser);

      const oldAmount = existingTransfer.amount;
      const oldToAmount = existingTransfer.toAmount;
      const newFromAccountId = input.fromAccountId || existingTransfer.fromAccountId;
      const newToAccountId = input.toAccountId || existingTransfer.toAccountId;
      const newAmount = input.amount || oldAmount;
      const newToAmount = input.toAmount || oldToAmount;

      if (newFromAccountId === newToAccountId) {
        throw new BadRequestException("Нельзя перевести на тот же счёт");
      }

      await this.getWorkspaceAccountOrThrow(
        tx,
        existingTransfer.workspaceId,
        newFromAccountId,
        "Счёт отправителя не найден"
      );
      await this.getWorkspaceAccountOrThrow(tx, existingTransfer.workspaceId, newToAccountId, "Счёт не найден");

      const oldFromAccountCurrent = await tx.account.findUnique({
        where: { id: existingTransfer.fromAccount.id },
        select: { balance: true },
      });
      const oldToAccountCurrent = await tx.account.findUnique({
        where: { id: existingTransfer.toAccount.id },
        select: { balance: true },
      });

      if (!oldFromAccountCurrent || !oldToAccountCurrent) {
        throw new NotFoundException("Счёт не найден");
      }

      const oldDeltas = getTransferTransactionBalanceDeltas(oldAmount, oldToAmount);

      await tx.account.update({
        where: { id: existingTransfer.fromAccount.id },
        data: { balance: subtractMoney(oldFromAccountCurrent.balance, oldDeltas.fromDelta) },
      });

      await tx.account.update({
        where: { id: existingTransfer.toAccount.id },
        data: { balance: subtractMoney(oldToAccountCurrent.balance, oldDeltas.toDelta) },
      });

      const newFromAccountCurrent = await tx.account.findUnique({
        where: { id: newFromAccountId },
        select: { balance: true },
      });
      const newToAccountCurrent = await tx.account.findUnique({
        where: { id: newToAccountId },
        select: { balance: true },
      });

      if (!newFromAccountCurrent || !newToAccountCurrent) {
        throw new NotFoundException("Счёт не найден");
      }

      if (compareMoney(newAmount, newFromAccountCurrent.balance) > 0) {
        throw new BadRequestException(
          `Сумма отправления не может превышать баланс счёта (${newFromAccountCurrent.balance})`
        );
      }

      const updatedTransfer = await tx.transferTransaction.update({
        where: { id: transactionId },
        data: {
          fromAccountId: newFromAccountId,
          toAccountId: newToAccountId,
          amount: newAmount,
          toAmount: newToAmount,
          description: input.description ?? existingTransfer.description,
          date: input.date || existingTransfer.date,
        },
        include: TRANSFER_TRANSACTION_INCLUDE,
      });

      const nextDeltas = getTransferTransactionBalanceDeltas(newAmount, newToAmount);

      await tx.account.update({
        where: { id: newFromAccountId },
        data: { balance: addMoney(newFromAccountCurrent.balance, nextDeltas.fromDelta) },
      });

      await tx.account.update({
        where: { id: newToAccountId },
        data: { balance: addMoney(newToAccountCurrent.balance, nextDeltas.toDelta) },
      });

      return updatedTransfer as TransferTransactionWithRelations;
    });

    return { transfer: toTransferTransactionDto(transfer) };
  }

  async deletePaymentTransaction(transactionId: string, currentUser: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { account: true },
      });

      if (!transaction) {
        throw new NotFoundException("Транзакция не найдена или доступ запрещён");
      }

      await this.assertWorkspaceAccessWithClient(tx, transaction.workspaceId, currentUser);

      await tx.account.update({
        where: { id: transaction.account.id },
        data: {
          balance: revertPaymentTransactionBalance(transaction.account.balance, transaction.type, transaction.amount),
        },
      });

      await tx.paymentTransaction.delete({
        where: { id: transactionId },
      });
    });
  }

  async deleteTransferTransaction(transactionId: string, currentUser: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transferTransaction.findUnique({
        where: { id: transactionId },
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException("Перевод не найден или доступ запрещён");
      }

      await this.assertWorkspaceAccessWithClient(tx, transfer.workspaceId, currentUser);

      const transferDeltas = getTransferTransactionBalanceDeltas(transfer.amount, transfer.toAmount);

      await tx.account.update({
        where: { id: transfer.fromAccount.id },
        data: { balance: subtractMoney(transfer.fromAccount.balance, transferDeltas.fromDelta) },
      });

      await tx.account.update({
        where: { id: transfer.toAccount.id },
        data: { balance: subtractMoney(transfer.toAccount.balance, transferDeltas.toDelta) },
      });

      await tx.transferTransaction.delete({
        where: { id: transactionId },
      });
    });
  }

  async getCombinedTransactions(
    workspaceId: string,
    filters: CombinedTransactionsQueryDto | undefined,
    currentUser: AuthenticatedUser
  ) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const skip = filters?.skip ?? 0;
    const take = filters?.take ?? 50;
    const queryLimit = skip + take;
    const needsAmountPostFilter = hasAmountRangeFilter(filters);

    const queryPaymentTransactions = shouldQueryPaymentTransactions(filters);
    const queryTransferTransactions = shouldQueryTransferTransactions(filters);
    const queryDebtTransactions = shouldQueryDebtTransactions(filters);

    const paymentTransactionWhere = buildPaymentTransactionWhere(workspaceId, filters);
    const transferTransactionWhere = buildTransferTransactionWhere(workspaceId, filters);
    const debtTransactionWhere = buildDebtTransactionWhere(workspaceId, filters);

    const [paymentTransactions, transferTransactions, debtTransactions, paymentTotal, transferTotal, debtTotal] =
      await Promise.all([
        queryPaymentTransactions
          ? this.prisma.paymentTransaction.findMany({
              where: paymentTransactionWhere,
              include: PAYMENT_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([]),
        queryTransferTransactions
          ? this.prisma.transferTransaction.findMany({
              where: transferTransactionWhere,
              include: TRANSFER_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([]),
        queryDebtTransactions
          ? this.prisma.debtTransaction.findMany({
              where: debtTransactionWhere,
              include: DEBT_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([]),
        !needsAmountPostFilter && queryPaymentTransactions
          ? this.prisma.paymentTransaction.count({ where: paymentTransactionWhere })
          : Promise.resolve(0),
        !needsAmountPostFilter && queryTransferTransactions
          ? this.prisma.transferTransaction.count({ where: transferTransactionWhere })
          : Promise.resolve(0),
        !needsAmountPostFilter && queryDebtTransactions
          ? this.prisma.debtTransaction.count({ where: debtTransactionWhere })
          : Promise.resolve(0),
      ]);

    const combined: CombinedTransaction[] = [
      ...(paymentTransactions as PaymentTransactionWithRelations[]).map((transaction) => ({
        kind: "paymentTransaction" as const,
        data: transaction,
      })),
      ...(transferTransactions as TransferTransactionWithRelations[]).map((transaction) => ({
        kind: "transferTransaction" as const,
        data: transaction,
      })),
      ...(debtTransactions as DebtTransactionWithRelations[]).map((transaction) => ({
        kind: "debtTransaction" as const,
        data: transaction,
      })),
    ];

    const filteredCombined = needsAmountPostFilter ? filterCombinedTransactions(combined, filters) : combined;
    const sortedCombined = sortCombinedTransactionsByDate(filteredCombined);
    const paginated = sortedCombined.slice(skip, skip + take);
    const total = needsAmountPostFilter ? sortedCombined.length : paymentTotal + transferTotal + debtTotal;

    return { data: paginated.map(toCombinedTransactionDto), total };
  }
}
