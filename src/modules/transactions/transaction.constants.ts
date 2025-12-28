export const TRANSACTION_TYPES = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER: "transfer",
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPES.INCOME]: "Доход",
  [TRANSACTION_TYPES.EXPENSE]: "Расход",
  [TRANSACTION_TYPES.TRANSFER]: "Перевод",
} as const;
