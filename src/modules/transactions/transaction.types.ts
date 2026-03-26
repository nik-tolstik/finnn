import type { Transaction } from "@prisma/client";

import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

export type TransactionWithRelations = Transaction & {
  account: {
    id: string;
    name: string;
    currency: string;
    color: string | null;
    icon: string | null;
    ownerId: string | null;
    owner: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    } | null;
  };
  category: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  transferFrom?: {
    toAmount: string;
    toTransaction: {
      id: string;
      account: {
        id: string;
        name: string;
        currency: string;
        color: string | null;
        icon: string | null;
        ownerId: string | null;
        owner: {
          id: string;
          name: string | null;
          email: string;
          image: string | null;
        } | null;
      };
    };
  } | null;
  transferTo?: {
    amount: string;
    fromTransaction: {
      id: string;
      account: {
        id: string;
        name: string;
        currency: string;
        color: string | null;
        icon: string | null;
        ownerId: string | null;
        owner: {
          id: string;
          name: string | null;
          email: string;
          image: string | null;
        } | null;
      };
    };
  } | null;
};

export type CombinedTransaction =
  | { kind: "transaction"; data: TransactionWithRelations }
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations };
