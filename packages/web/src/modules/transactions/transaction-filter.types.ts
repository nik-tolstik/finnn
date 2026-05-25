import type { DashboardTransactionType } from "./transaction.constants";

export interface TransactionFilters {
  amountFrom?: string;
  amountTo?: string;
  userIds?: string[];
  transactionTypes?: DashboardTransactionType[];
  categoryIds?: string[];
  accountIds?: string[];
  description?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionListFilters extends TransactionFilters {
  skip?: number;
  take?: number;
  includeDebtTransactions?: boolean;
}
