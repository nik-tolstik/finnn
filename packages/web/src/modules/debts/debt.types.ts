export interface DebtWithRelations {
  id: string;
  workspaceId: string;
  type: string;
  personName: string;
  amount: string;
  remainingAmount: string;
  currency: string;
  date: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtTransactionWithRelations {
  id: string;
  workspaceId: string;
  debtId: string;
  accountId: string | null;
  paymentTransactionId: string | null;
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
      email?: string | null;
      image: string | null;
    } | null;
  } | null;
}

export interface DebtWriteOffMetadata {
  debtTransactionId: string;
  debtId: string;
  debtType: string;
  personName: string;
  debtCurrency: string;
  amount: string;
  remainingAmount: string;
  status: string;
}

export interface DebtWriteOffPaymentTransaction {
  id: string;
  workspaceId: string;
  accountId: string;
  amount: string;
  type: string;
  description: string | null;
  date: Date;
  categoryId: string | null;
  createdByAi: boolean;
  createdAt: Date;
  updatedAt: Date;
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
      email?: string | null;
      image: string | null;
    } | null;
  };
  category: {
    id: string;
    name: string;
    icon?: string | null;
    iconAssetId?: string | null;
  } | null;
  debtWriteOff: DebtWriteOffMetadata;
}
