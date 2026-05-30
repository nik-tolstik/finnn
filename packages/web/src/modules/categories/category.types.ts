export type Category = {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  icon: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    paymentTransactions: number;
  };
};

export type CategoryWithCount = Category & {
  _count: {
    paymentTransactions: number;
  };
};
