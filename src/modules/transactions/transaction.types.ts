import type { PaymentTransaction, TransferTransaction } from "@prisma/client";

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

export type PaymentTransactionWithRelations = PaymentTransaction & {
  account: TransactionAccountWithOwner;
  category: {
    id: string;
    name: string;
  } | null;
};

export type TransferTransactionWithRelations = TransferTransaction & {
  fromAccount: TransactionAccountWithOwner;
  toAccount: TransactionAccountWithOwner;
  createdBy: TransactionUser | null;
};

export type CombinedTransaction =
  | { kind: "paymentTransaction"; data: PaymentTransactionWithRelations }
  | { kind: "transferTransaction"; data: TransferTransactionWithRelations }
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations };
