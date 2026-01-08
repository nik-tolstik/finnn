import { Transaction } from "@prisma/client";

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

import { TransactionType } from "./transaction.constants";

export type TemporaryCategory = {
  id: string;
  name: string;
  color: string;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  isTemporary: true;
};
