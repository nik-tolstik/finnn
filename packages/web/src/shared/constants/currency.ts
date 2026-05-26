export const Currency = {
  BYN: "BYN",
  USD: "USD",
  EUR: "EUR",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export const CURRENCY_OPTIONS = [
  { value: Currency.BYN, label: "BYN (Br)" },
  { value: Currency.USD, label: "USD ($)" },
  { value: Currency.EUR, label: "EUR (€)" },
];

export const DEFAULT_CURRENCY = Currency.BYN;
