import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import {
  type DashboardTransactionType,
  DEBT_TRANSACTION_FILTER_VALUE,
  TransactionType,
} from "@/modules/transactions/transaction.constants";
import type { CombinedTransaction, TransactionWithRelations } from "@/modules/transactions/transaction.types";
import type { TransactionListFilters } from "@/modules/transactions/transaction-filter.types";
import { compareMoney } from "@/shared/utils/money";

function includesCaseInsensitive(value: string | null | undefined, searchTerm: string) {
  if (!value) {
    return false;
  }

  return value.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase());
}

function matchesAmountRange(amounts: Array<string | null | undefined>, filters?: TransactionListFilters) {
  if (!filters?.amountFrom && !filters?.amountTo) {
    return true;
  }

  const candidateAmounts = amounts.filter((amount): amount is string => Boolean(amount));

  return candidateAmounts.some((amount) => {
    if (filters.amountFrom && compareMoney(amount, filters.amountFrom) < 0) {
      return false;
    }

    if (filters.amountTo && compareMoney(amount, filters.amountTo) > 0) {
      return false;
    }

    return true;
  });
}

function matchesDateRange(date: Date, filters?: TransactionListFilters) {
  const dateValue = new Date(date).getTime();

  if (filters?.dateFrom) {
    const dateFrom = new Date(`${filters.dateFrom}T00:00:00`);
    if (dateValue < dateFrom.getTime()) {
      return false;
    }
  }

  if (filters?.dateTo) {
    const dateTo = new Date(`${filters.dateTo}T23:59:59.999`);
    if (dateValue > dateTo.getTime()) {
      return false;
    }
  }

  return true;
}

function matchesMultiSelect(selectedValues: string[] | undefined, candidateValues: Array<string | null | undefined>) {
  if (!selectedValues?.length) {
    return true;
  }

  const normalizedCandidateValues = candidateValues.filter((value): value is string => Boolean(value));

  return normalizedCandidateValues.some((value) => selectedValues.includes(value));
}

function matchesTransactionTypes(
  transactionTypes: DashboardTransactionType[] | undefined,
  kind: CombinedTransaction["kind"],
  transactionType?: string
) {
  if (!transactionTypes?.length) {
    return true;
  }

  if (kind === "debtTransaction") {
    return transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
  }

  return Boolean(transactionType) && transactionTypes.includes(transactionType as DashboardTransactionType);
}

function matchesTransactionDescription(transaction: TransactionWithRelations, searchTerm?: string) {
  if (!searchTerm) {
    return true;
  }

  return [
    transaction.description,
    transaction.transferFrom?.toTransaction?.description,
    transaction.transferTo?.fromTransaction?.description,
  ].some((value) => includesCaseInsensitive(value, searchTerm));
}

function matchesRegularTransactionFilters(transaction: TransactionWithRelations, filters?: TransactionListFilters) {
  if (!matchesTransactionTypes(filters?.transactionTypes, "transaction", transaction.type)) {
    return false;
  }

  // Transfers are displayed as one row, but they should match filters applied
  // to either the source or the destination side of the transfer pair.
  if (
    !matchesMultiSelect(filters?.userIds, [
      transaction.account.ownerId,
      transaction.transferFrom?.toTransaction?.account.ownerId,
      transaction.transferTo?.fromTransaction?.account.ownerId,
    ])
  ) {
    return false;
  }

  if (
    !matchesMultiSelect(filters?.accountIds, [
      transaction.account.id,
      transaction.transferFrom?.toTransaction?.account.id,
      transaction.transferTo?.fromTransaction?.account.id,
    ])
  ) {
    return false;
  }

  if (filters?.categoryIds?.length) {
    if (transaction.type === TransactionType.TRANSFER) {
      return false;
    }

    if (!matchesMultiSelect(filters.categoryIds, [transaction.category?.id])) {
      return false;
    }
  }

  if (!matchesTransactionDescription(transaction, filters?.description)) {
    return false;
  }

  if (
    !matchesAmountRange(
      [transaction.amount, transaction.transferFrom?.toAmount, transaction.transferTo?.amount],
      filters
    )
  ) {
    return false;
  }

  if (!matchesDateRange(transaction.date, filters)) {
    return false;
  }

  return true;
}

function matchesDebtTransactionFilters(
  debtTransaction: DebtTransactionWithRelations,
  filters?: TransactionListFilters
) {
  if (!matchesTransactionTypes(filters?.transactionTypes, "debtTransaction")) {
    return false;
  }

  if (!matchesMultiSelect(filters?.userIds, [debtTransaction.account?.ownerId])) {
    return false;
  }

  if (!matchesMultiSelect(filters?.accountIds, [debtTransaction.account?.id])) {
    return false;
  }

  if (filters?.categoryIds?.length || filters?.description) {
    return false;
  }

  if (!matchesAmountRange([debtTransaction.amount, debtTransaction.toAmount], filters)) {
    return false;
  }

  if (!matchesDateRange(debtTransaction.date, filters)) {
    return false;
  }

  return true;
}

export function filterCombinedTransactions(transactions: CombinedTransaction[], filters?: TransactionListFilters) {
  return transactions.filter((transaction) => {
    if (transaction.kind === "debtTransaction") {
      return matchesDebtTransactionFilters(transaction.data, filters);
    }

    return matchesRegularTransactionFilters(transaction.data, filters);
  });
}
