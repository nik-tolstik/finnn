export const Currency = {
  BYN: "BYN",
  USD: "USD",
  EUR: "EUR",
  RUB: "RUB",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export const CURRENCY_OPTIONS = [
  { value: Currency.BYN, label: "BYN" },
  { value: Currency.USD, label: "USD" },
  { value: Currency.EUR, label: "EUR" },
  { value: Currency.RUB, label: "RUB" },
];

export const DEFAULT_CURRENCY = Currency.BYN;
