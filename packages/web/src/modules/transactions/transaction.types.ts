import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

export type TransactionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type TransactionAccountWithOwner = {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  icon: string | null;
  ownerId: string | null;
  owner: TransactionUser | null;
};

export type PaymentTransactionWithRelations = {
  id: string;
  workspaceId: string;
  accountId: string;
  amount: string;
  type: string;
  description: string | null;
  date: Date;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  account: TransactionAccountWithOwner;
  category: {
    id: string;
    name: string;
  } | null;
};

export type TransferTransactionWithRelations = {
  id: string;
  workspaceId: string;
  fromAccountId: string;
  toAccountId: string;
  createdById: string | null;
  amount: string;
  toAmount: string;
  description: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  fromAccount: TransactionAccountWithOwner;
  toAccount: TransactionAccountWithOwner;
  createdBy: TransactionUser | null;
};

export type CombinedTransaction =
  | { kind: "paymentTransaction"; data: PaymentTransactionWithRelations }
  | { kind: "transferTransaction"; data: TransferTransactionWithRelations }
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations };
