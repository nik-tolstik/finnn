import type { TransactionFilters } from "@/modules/transactions/transaction-filter.types";

export type TransactionViewFilters = TransactionFilters;

export interface TransactionFilterMember {
  id: string;
  name: string | null;
  email?: string | null;
  image: string | null;
}

export interface TransactionFilterCategory {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  iconAssetId: string | null;
}

export interface TransactionFilterAccount {
  id: string;
  name: string;
  balance: string;
  currency: string;
  color: string | null;
  icon: string | null;
  ownerId: string | null;
  owner: {
    name: string | null;
    email?: string | null;
  } | null;
}
