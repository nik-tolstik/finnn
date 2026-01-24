import { Currency } from "@prisma/client";

export interface CapitalFilters {
  accountIds?: string[];
  excludeDebts?: boolean;
}

export interface CapitalByCurrency {
  USD: string;
  EUR: string;
  BYN: string;
}
