export enum TransactionType {
  INCOME = "income",
  EXPENSE = "expense",
  TRANSFER = "transfer",
}

export const TRANSACTION_TYPE_LABELS = {
  [TransactionType.INCOME]: "Доход",
  [TransactionType.EXPENSE]: "Расход",
  [TransactionType.TRANSFER]: "Перевод",
} as const;
