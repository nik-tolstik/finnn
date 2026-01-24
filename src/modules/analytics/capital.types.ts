import { Currency } from "@prisma/client";

export interface CapitalFilters {
  accountIds?: string[];
  debtType?: "lent" | "borrowed" | "all";
}

export interface CapitalByCurrency {
  USD: string;
  EUR: string;
  BYN: string;
}
