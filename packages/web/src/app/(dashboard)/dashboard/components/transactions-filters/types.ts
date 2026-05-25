import type { TransactionFilters } from "@/modules/transactions/transaction-filter.types";

export type DashboardTransactionFilters = TransactionFilters;

export interface FilterMember {
  id: string;
  name: string | null;
  email: string;
}

export interface FilterCategory {
  id: string;
  name: string;
  type: string;
}

export interface FilterAccount {
  id: string;
  name: string;
  ownerId: string | null;
  owner: {
    name: string | null;
    email: string;
  } | null;
}
