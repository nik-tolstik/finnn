import type { Debt, Account, DebtTransaction, User } from "@prisma/client";

export interface DebtWithRelations extends Debt {
  account: Pick<Account, "id" | "name" | "currency" | "color" | "icon"> | null;
}

export interface DebtTransactionWithRelations extends DebtTransaction {
  debt: {
    id: string;
    type: string;
    personName: string;
    currency: string;
  };
  account: {
    id: string;
    name: string;
    currency: string;
    color: string | null;
    icon: string | null;
    ownerId: string | null;
    owner: Pick<User, "id" | "name" | "email" | "image"> | null;
  } | null;
}
