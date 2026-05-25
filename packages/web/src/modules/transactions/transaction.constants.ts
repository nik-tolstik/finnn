export enum PaymentTransactionType {
  INCOME = "income",
  EXPENSE = "expense",
}

export const TRANSFER_TRANSACTION_FILTER_VALUE = "transfer" as const;
export const DEBT_TRANSACTION_FILTER_VALUE = "debt" as const;

export type DashboardTransactionType =
  | PaymentTransactionType
  | typeof TRANSFER_TRANSACTION_FILTER_VALUE
  | typeof DEBT_TRANSACTION_FILTER_VALUE;

export const PAYMENT_TRANSACTION_TYPE_LABELS = {
  [PaymentTransactionType.INCOME]: "Доход",
  [PaymentTransactionType.EXPENSE]: "Расход",
} as const;

export const DASHBOARD_TRANSACTION_TYPE_LABELS = {
  ...PAYMENT_TRANSACTION_TYPE_LABELS,
  [TRANSFER_TRANSACTION_FILTER_VALUE]: "Перевод",
  [DEBT_TRANSACTION_FILTER_VALUE]: "Долг",
} as const satisfies Record<DashboardTransactionType, string>;
