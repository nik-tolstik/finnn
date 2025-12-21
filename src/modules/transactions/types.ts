import { Transaction, Account, Category } from "@prisma/client";

export type TransactionWithRelations = Transaction & {
  account: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
    color: string | null;
  } | null;
};

