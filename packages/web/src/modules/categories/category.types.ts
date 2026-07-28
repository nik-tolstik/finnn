export type Category = {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  icon: string | null;
  iconAssetId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    paymentTransactions: number;
  };
};

export type CategoryIconAsset = {
  id: string;
  workspaceId: string;
  url: string;
  createdAt: Date;
};

export type CategoryWithCount = Category & {
  _count: {
    paymentTransactions: number;
  };
};
