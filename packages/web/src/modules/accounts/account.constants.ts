export const ACCOUNT_TYPES = {
  CASH: "cash",
  BANK: "bank",
  CARD: "card",
  INVESTMENT: "investment",
  OTHER: "other",
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];
