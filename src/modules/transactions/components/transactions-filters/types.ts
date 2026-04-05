import type { TransactionFilters } from "@/modules/transactions/transaction-filter.types";

export type TransactionViewFilters = TransactionFilters;

export interface TransactionFilterMember {
  id: string;
  name: string | null;
  email: string;
}

export interface TransactionFilterCategory {
  id: string;
  name: string;
  type: string;
}

export interface TransactionFilterAccount {
  id: string;
  name: string;
  ownerId: string | null;
  owner: {
    name: string | null;
    email: string;
  } | null;
}
