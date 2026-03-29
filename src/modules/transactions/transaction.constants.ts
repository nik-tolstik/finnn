export enum TransactionType {
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer",
}

export const DEBT_TRANSACTION_FILTER_VALUE = "debt" as const;

export type DashboardTransactionType = TransactionType | typeof DEBT_TRANSACTION_FILTER_VALUE;

export const TRANSACTION_TYPE_LABELS = {
  [TransactionType.INCOME]: "Доход",
  [TransactionType.EXPENSE]: "Расход",
  [TransactionType.TRANSFER]: "Перевод",
} as const;

export const DASHBOARD_TRANSACTION_TYPE_LABELS = {
  ...TRANSACTION_TYPE_LABELS,
  [DEBT_TRANSACTION_FILTER_VALUE]: "Долг",
} as const satisfies Record<DashboardTransactionType, string>;
