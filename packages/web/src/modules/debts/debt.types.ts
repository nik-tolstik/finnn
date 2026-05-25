import type { Account, Debt, DebtTransaction, User } from "@prisma/client";

export interface DebtWithRelations extends Debt {
  account: Pick<Account, "id" | "name" | "currency" | "color" | "icon"> | null;
}

export interface DebtTransactionWithRelations extends DebtTransaction {
  debt: {
    id: string;
    workspaceId: string;
    type: string;
    personName: string;
    amount: string;
    remainingAmount: string;
    currency: string;
    accountId: string | null;
    date: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
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
