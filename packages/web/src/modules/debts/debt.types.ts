export interface DebtWithRelations {
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
  account: {
    id: string;
    name: string;
    currency: string;
    color: string | null;
    icon: string | null;
  } | null;
}

export interface DebtTransactionWithRelations {
  id: string;
  workspaceId: string;
  debtId: string;
  accountId: string | null;
  type: string;
  amount: string;
  toAmount: string | null;
  date: Date;
  createdAt: Date;
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
    owner: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    } | null;
  } | null;
}
