export type UserReference = {
  id: string;
  name: string | null;
  email?: string | null;
  image: string | null;
};

export type Account = {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  name: string;
  balance: string;
  currency: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  archived: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  owner?: UserReference | null;
};

export type AccountWithBalance = Account;
export type AccountWithOwner = Account & {
  owner?: UserReference | null;
};
export type ArchivedAccount = AccountWithOwner & {
  _count: {
    transactions: number;
    debts: number;
    debtTransactions: number;
  };
};
