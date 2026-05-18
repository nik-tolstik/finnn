"use server";

import type { Prisma } from "@prisma/client";

import { fail, ok, success } from "@/shared/lib/action-result";
import { prisma } from "@/shared/lib/prisma";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  type CreatePaymentTransactionInput,
  type CreateTransferTransactionInput,
  createPaymentTransactionSchema,
  createTransferTransactionSchema,
  type UpdatePaymentTransactionInput,
  type UpdateTransferTransactionInput,
  updatePaymentTransactionSchema,
  updateTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";

import type { DebtTransactionWithRelations } from "../debts/debt.types";
import {
  createPaymentTransactionApplication,
  createTransferTransactionApplication,
  deletePaymentTransactionApplication,
  deleteTransferTransactionApplication,
  updatePaymentTransactionApplication,
  updateTransferTransactionApplication,
} from "./transaction.application";
import {
  DEBT_TRANSACTION_FILTER_VALUE,
  PaymentTransactionType,
  TRANSFER_TRANSACTION_FILTER_VALUE,
} from "./transaction.constants";
import type { CombinedTransaction } from "./transaction.types";
import type { TransactionListFilters } from "./transaction-filter.types";
import { filterCombinedTransactions } from "./utils/combined-transaction-filtering";

const accountWithOwnerSelect = {
  id: true,
  name: true,
  currency: true,
  color: true,
  icon: true,
  ownerId: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} satisfies Prisma.AccountSelect;

const categorySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const paymentTransactionInclude = {
  account: {
    select: accountWithOwnerSelect,
  },
  category: {
    select: categorySelect,
  },
} satisfies Prisma.PaymentTransactionInclude;

const transferTransactionInclude = {
  fromAccount: {
    select: accountWithOwnerSelect,
  },
  toAccount: {
    select: accountWithOwnerSelect,
  },
  createdBy: {
    select: userSelect,
  },
} satisfies Prisma.TransferTransactionInclude;

const debtTransactionInclude = {
  debt: {
    select: {
      id: true,
      workspaceId: true,
      type: true,
      personName: true,
      amount: true,
      remainingAmount: true,
      currency: true,
      accountId: true,
      date: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  account: {
    select: accountWithOwnerSelect,
  },
} satisfies Prisma.DebtTransactionInclude;

function hasAmountRangeFilter(filters?: CombinedTransactionFilters) {
  return Boolean(filters?.amountFrom || filters?.amountTo);
}

function buildDateWhere(filters?: CombinedTransactionFilters) {
  const date: Prisma.DateTimeFilter = {};

  if (filters?.dateFrom) {
    date.gte = new Date(`${filters.dateFrom}T00:00:00`);
  }

  if (filters?.dateTo) {
    date.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return Object.keys(date).length > 0 ? date : undefined;
}

function getSelectedPaymentTypes(filters?: CombinedTransactionFilters) {
  return (
    filters?.transactionTypes?.filter(
      (type): type is PaymentTransactionType =>
        type === PaymentTransactionType.INCOME || type === PaymentTransactionType.EXPENSE
    ) || []
  );
}

function shouldQueryPaymentTransactions(filters?: CombinedTransactionFilters) {
  if (!filters?.transactionTypes?.length) {
    return true;
  }

  return getSelectedPaymentTypes(filters).length > 0;
}

function shouldQueryTransferTransactions(filters?: CombinedTransactionFilters) {
  if (filters?.categoryIds?.length) {
    return false;
  }

  if (!filters?.transactionTypes?.length) {
    return true;
  }

  return filters.transactionTypes.includes(TRANSFER_TRANSACTION_FILTER_VALUE);
}

function shouldQueryDebtTransactions(filters?: CombinedTransactionFilters) {
  if (filters?.categoryIds?.length || filters?.description || filters?.includeDebtTransactions === false) {
    return false;
  }

  if (!filters?.transactionTypes?.length) {
    return true;
  }

  return filters.transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
}

function buildPaymentTransactionWhere(workspaceId: string, filters?: CombinedTransactionFilters) {
  const where: Prisma.PaymentTransactionWhereInput = { workspaceId };
  const date = buildDateWhere(filters);
  const selectedPaymentTypes = getSelectedPaymentTypes(filters);

  if (date) {
    where.date = date;
  }

  if (selectedPaymentTypes.length > 0) {
    where.type = { in: selectedPaymentTypes };
  }

  if (filters?.accountIds?.length) {
    where.accountId = { in: filters.accountIds };
  }

  if (filters?.categoryIds?.length) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters?.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters?.userIds?.length) {
    where.account = {
      is: {
        ownerId: { in: filters.userIds },
      },
    };
  }

  return where;
}

function buildTransferTransactionWhere(workspaceId: string, filters?: CombinedTransactionFilters) {
  const where: Prisma.TransferTransactionWhereInput = { workspaceId };
  const date = buildDateWhere(filters);

  if (date) {
    where.date = date;
  }

  if (filters?.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

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

function buildDebtTransactionWhere(workspaceId: string, filters?: CombinedTransactionFilters) {
  const where: Prisma.DebtTransactionWhereInput = {
    workspaceId,
    debt: {
      is: {
        workspaceId,
      },
    },
  };
  const date = buildDateWhere(filters);

  if (date) {
    where.date = date;
  }

  if (filters?.accountIds?.length) {
    where.accountId = { in: filters.accountIds };
  }

  if (filters?.userIds?.length) {
    where.account = {
      is: {
        ownerId: { in: filters.userIds },
      },
    };
  }

  return where;
}

function sortCombinedTransactionsByDate(transactions: CombinedTransaction[]) {
  return transactions.sort((a, b) => {
    const dateA = new Date(a.data.date).getTime();
    const dateB = new Date(b.data.date).getTime();
    return dateB - dateA;
  });
}

export async function createPaymentTransaction(workspaceId: string, input: CreatePaymentTransactionInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createPaymentTransactionSchema.parse(input);
    const transaction = await createPaymentTransactionApplication(workspaceId, validated);

    revalidateAccountingRoutes();
    return ok(transaction);
  } catch (error: unknown) {
    return fail(error, "Не удалось создать транзакцию");
  }
}

export async function createTransferTransaction(workspaceId: string, input: CreateTransferTransactionInput) {
  try {
    const userId = await requireUserId();
    await requireWorkspaceAccess(workspaceId);

    const validated = createTransferTransactionSchema.parse(input);
    const transfer = await createTransferTransactionApplication(workspaceId, userId, validated);

    revalidateAccountingRoutes();
    return ok(transfer);
  } catch (error: unknown) {
    return fail(error, "Не удалось создать перевод");
  }
}

export async function updatePaymentTransaction(id: string, input: UpdatePaymentTransactionInput) {
  try {
    const userId = await requireUserId();

    const validated = updatePaymentTransactionSchema.parse(input);
    const updated = await updatePaymentTransactionApplication(id, userId, validated);

    revalidateAccountingRoutes();
    return ok(updated);
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить транзакцию");
  }
}

export async function updateTransferTransaction(id: string, input: UpdateTransferTransactionInput) {
  try {
    const userId = await requireUserId();

    const validated = updateTransferTransactionSchema.parse(input);
    await updateTransferTransactionApplication(id, userId, validated);

    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить перевод");
  }
}

export async function deleteTransferTransaction(id: string) {
  try {
    const userId = await requireUserId();

    await deleteTransferTransactionApplication(id, userId);

    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить перевод");
  }
}

export async function deletePaymentTransaction(id: string) {
  try {
    const userId = await requireUserId();

    await deletePaymentTransactionApplication(id, userId);

    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить транзакцию");
  }
}

export type CombinedTransactionFilters = TransactionListFilters;

export async function getCombinedTransactions(
  workspaceId: string,
  filters?: CombinedTransactionFilters
): Promise<{ data: CombinedTransaction[]; total: number } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

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
          ? prisma.paymentTransaction.findMany({
              where: paymentTransactionWhere,
              include: paymentTransactionInclude,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([]),
        queryTransferTransactions
          ? prisma.transferTransaction.findMany({
              where: transferTransactionWhere,
              include: transferTransactionInclude,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([]),
        queryDebtTransactions
          ? prisma.debtTransaction.findMany({
              where: debtTransactionWhere,
              include: debtTransactionInclude,
              orderBy: { date: "desc" },
              ...(needsAmountPostFilter ? {} : { take: queryLimit }),
            })
          : Promise.resolve([] as DebtTransactionWithRelations[]),
        !needsAmountPostFilter && queryPaymentTransactions
          ? prisma.paymentTransaction.count({ where: paymentTransactionWhere })
          : Promise.resolve(0),
        !needsAmountPostFilter && queryTransferTransactions
          ? prisma.transferTransaction.count({ where: transferTransactionWhere })
          : Promise.resolve(0),
        !needsAmountPostFilter && queryDebtTransactions
          ? prisma.debtTransaction.count({ where: debtTransactionWhere })
          : Promise.resolve(0),
      ]);

    const combined: CombinedTransaction[] = [
      ...paymentTransactions.map((transaction) => ({ kind: "paymentTransaction" as const, data: transaction })),
      ...transferTransactions.map((transaction) => ({ kind: "transferTransaction" as const, data: transaction })),
      ...debtTransactions.map((transaction) => ({ kind: "debtTransaction" as const, data: transaction })),
    ];

    const filteredCombined = needsAmountPostFilter ? filterCombinedTransactions(combined, filters) : combined;
    const sortedCombined = sortCombinedTransactionsByDate(filteredCombined);
    const paginated = sortedCombined.slice(skip, skip + take);
    const total = needsAmountPostFilter ? sortedCombined.length : paymentTotal + transferTotal + debtTotal;

    return { data: paginated, total };
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить транзакции");
  }
}
