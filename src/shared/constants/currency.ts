import { Currency } from "@prisma/client";

export { Currency };

export const CURRENCY_OPTIONS = [
  { value: Currency.BYN, label: "BYN (Br)" },
  { value: Currency.USD, label: "USD ($)" },
  { value: Currency.EUR, label: "EUR (€)" },
] as const;

export const DEFAULT_CURRENCY = Currency.BYN;
