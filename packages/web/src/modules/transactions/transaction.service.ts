"use server";

import type {
  CreatePaymentTransactionDto,
  CreateTransferTransactionDto,
  DebtTransactionDto,
  GetCombinedTransactionsParams,
  PaymentTransactionDto,
  TransactionAccountDto,
  TransactionUserDto,
  TransferTransactionDto,
  UpdatePaymentTransactionDto,
  UpdateTransferTransactionDto,
} from "@/shared/api/generated/model";
import {
  createPaymentTransaction as createApiPaymentTransaction,
  createTransferTransaction as createApiTransferTransaction,
  deletePaymentTransaction as deleteApiPaymentTransaction,
  deleteTransferTransaction as deleteApiTransferTransaction,
  getCombinedTransactions as getApiCombinedTransactions,
  updatePaymentTransaction as updateApiPaymentTransaction,
  updateTransferTransaction as updateApiTransferTransaction,
} from "@/shared/api/generated/transactions/transactions";
import { fail, ok, success } from "@/shared/lib/action-result";
import { getServerApiRequestOptions } from "@/shared/lib/api-session";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import type {
  CreatePaymentTransactionInput,
  CreateTransferTransactionInput,
  UpdatePaymentTransactionInput,
  UpdateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";

import type { DebtTransactionWithRelations } from "../debts/debt.types";
import type {
  CombinedTransaction,
  PaymentTransactionWithRelations,
  TransferTransactionWithRelations,
} from "./transaction.types";
import type { TransactionListFilters } from "./transaction-filter.types";

function toDate(value: string) {
  return new Date(value);
}

function toLegacyUser(user?: TransactionUserDto | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
  };
}

function toLegacyAccount(account: TransactionAccountDto) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color ?? null,
    icon: account.icon ?? null,
    ownerId: account.ownerId ?? null,
    owner: toLegacyUser(account.owner),
  };
}

function toLegacyPaymentTransaction(transaction: PaymentTransactionDto): PaymentTransactionWithRelations {
  return {
    ...transaction,
    description: transaction.description ?? null,
    categoryId: transaction.categoryId ?? null,
    date: toDate(transaction.date),
    createdAt: toDate(transaction.createdAt),
    updatedAt: toDate(transaction.updatedAt),
    account: toLegacyAccount(transaction.account),
    category: transaction.category ?? null,
  };
}

function toLegacyTransferTransaction(transaction: TransferTransactionDto): TransferTransactionWithRelations {
  return {
    ...transaction,
    createdById: transaction.createdById ?? null,
    description: transaction.description ?? null,
    date: toDate(transaction.date),
    createdAt: toDate(transaction.createdAt),
    updatedAt: toDate(transaction.updatedAt),
    fromAccount: toLegacyAccount(transaction.fromAccount),
    toAccount: toLegacyAccount(transaction.toAccount),
    createdBy: toLegacyUser(transaction.createdBy),
  };
}

function toLegacyDebtTransaction(transaction: DebtTransactionDto): DebtTransactionWithRelations {
  return {
    ...transaction,
    accountId: transaction.accountId ?? null,
    toAmount: transaction.toAmount ?? null,
    date: toDate(transaction.date),
    createdAt: toDate(transaction.createdAt),
    debt: {
      ...transaction.debt,
      accountId: transaction.debt.accountId ?? null,
      date: toDate(transaction.debt.date),
      createdAt: toDate(transaction.debt.createdAt),
      updatedAt: toDate(transaction.debt.updatedAt),
    },
    account: transaction.account ? toLegacyAccount(transaction.account) : null,
  } as DebtTransactionWithRelations;
}

function toLegacyCombinedTransaction(
  transaction: Awaited<ReturnType<typeof getApiCombinedTransactions>>["data"][number]
): CombinedTransaction {
  if (transaction.kind === "transferTransaction") {
    return {
      kind: "transferTransaction",
      data: toLegacyTransferTransaction(transaction.data),
    };
  }

  if (transaction.kind === "debtTransaction") {
    return {
      kind: "debtTransaction",
      data: toLegacyDebtTransaction(transaction.data),
    };
  }

  return {
    kind: "paymentTransaction",
    data: toLegacyPaymentTransaction(transaction.data),
  };
}

function toCreatePaymentTransactionDto(input: CreatePaymentTransactionInput): CreatePaymentTransactionDto {
  return {
    accountId: input.accountId,
    amount: input.amount,
    type: input.type as CreatePaymentTransactionDto["type"],
    description: input.description,
    date: input.date.toISOString(),
    categoryId: input.categoryId,
    newCategory: input.newCategory,
  };
}

function toCreateTransferTransactionDto(input: CreateTransferTransactionInput): CreateTransferTransactionDto {
  return {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    toAmount: input.toAmount,
    description: input.description,
    date: input.date.toISOString(),
  };
}

function toUpdatePaymentTransactionDto(input: UpdatePaymentTransactionInput): UpdatePaymentTransactionDto {
  return {
    accountId: input.accountId,
    amount: input.amount,
    description: input.description,
    date: input.date?.toISOString(),
    categoryId: input.categoryId,
  };
}

function toUpdateTransferTransactionDto(input: UpdateTransferTransactionInput): UpdateTransferTransactionDto {
  return {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    toAmount: input.toAmount,
    description: input.description,
    date: input.date.toISOString(),
  };
}

function toCombinedTransactionParams(filters?: CombinedTransactionFilters): GetCombinedTransactionsParams | undefined {
  if (!filters) {
    return undefined;
  }

  return {
    skip: filters.skip,
    take: filters.take,
    amountFrom: filters.amountFrom,
    amountTo: filters.amountTo,
    userIds: filters.userIds,
    transactionTypes: filters.transactionTypes,
    categoryIds: filters.categoryIds,
    accountIds: filters.accountIds,
    description: filters.description,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    includeDebtTransactions: filters.includeDebtTransactions,
  };
}

export async function createPaymentTransaction(workspaceId: string, input: CreatePaymentTransactionInput) {
  try {
    const response = await createApiPaymentTransaction(
      workspaceId,
      toCreatePaymentTransactionDto(input),
      await getServerApiRequestOptions()
    );
    revalidateAccountingRoutes();
    return ok(toLegacyPaymentTransaction(response.transaction));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать транзакцию");
  }
}

export async function createTransferTransaction(workspaceId: string, input: CreateTransferTransactionInput) {
  try {
    const response = await createApiTransferTransaction(
      workspaceId,
      toCreateTransferTransactionDto(input),
      await getServerApiRequestOptions()
    );
    revalidateAccountingRoutes();
    return ok(toLegacyTransferTransaction(response.transfer));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать перевод");
  }
}

export async function updatePaymentTransaction(id: string, input: UpdatePaymentTransactionInput) {
  try {
    const response = await updateApiPaymentTransaction(
      id,
      toUpdatePaymentTransactionDto(input),
      await getServerApiRequestOptions()
    );
    revalidateAccountingRoutes();
    return ok(toLegacyPaymentTransaction(response.transaction));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить транзакцию");
  }
}

export async function updateTransferTransaction(id: string, input: UpdateTransferTransactionInput) {
  try {
    await updateApiTransferTransaction(id, toUpdateTransferTransactionDto(input), await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить перевод");
  }
}

export async function deleteTransferTransaction(id: string) {
  try {
    await deleteApiTransferTransaction(id, await getServerApiRequestOptions());
    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить перевод");
  }
}

export async function deletePaymentTransaction(id: string) {
  try {
    await deleteApiPaymentTransaction(id, await getServerApiRequestOptions());
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
    const response = await getApiCombinedTransactions(
      workspaceId,
      toCombinedTransactionParams(filters),
      await getServerApiRequestOptions()
    );

    return {
      data: response.data.map(toLegacyCombinedTransaction),
      total: response.total,
    };
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить транзакции");
  }
}
