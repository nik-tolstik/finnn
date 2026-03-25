export interface TransactionListFilters {
  skip?: number;
  take?: number;
  includeDebtTransactions?: boolean;
}

export interface DebtListFilters {
  status?: string;
  type?: string;
  personName?: string;
}

export interface AnalyticsDateFilters {
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CapitalQueryFilters {
  accountIds?: string[];
  excludeDebts?: boolean;
}

export const workspacesKeys = {
  list: () => ["workspaces"] as const,
};

export const workspaceKeys = {
  all: (workspaceId: string) => ["workspace", workspaceId] as const,
  summary: (workspaceId: string) => ["workspace", workspaceId, "summary"] as const,
  members: (workspaceId: string) => ["workspace", workspaceId, "members"] as const,
};

export const accountKeys = {
  all: (workspaceId: string) => ["accounts", workspaceId] as const,
  list: (workspaceId: string) => ["accounts", workspaceId] as const,
  archived: (workspaceId: string) => ["accounts", workspaceId, "archived"] as const,
};

export const categoryKeys = {
  all: (workspaceId: string) => ["categories", workspaceId] as const,
  list: (workspaceId: string) => ["categories", workspaceId] as const,
};

export const transactionKeys = {
  all: (workspaceId: string) => ["transactions", workspaceId] as const,
  list: (workspaceId: string, filters: TransactionListFilters) => ["transactions", workspaceId, filters] as const,
};

export const debtKeys = {
  all: (workspaceId: string) => ["debts", workspaceId] as const,
  list: (workspaceId: string, filters: DebtListFilters = {}) => ["debts", workspaceId, filters] as const,
};

export const analyticsKeys = {
  capital: (workspaceId: string, filters: CapitalQueryFilters = {}) => ["capital", workspaceId, filters] as const,
  categoryPrefix: (workspaceId: string) => ["analytics", workspaceId, "category"] as const,
  category: (workspaceId: string, filters: AnalyticsDateFilters & { type: string }) =>
    ["analytics", workspaceId, "category", filters] as const,
  totalPrefix: (workspaceId: string) => ["analytics", workspaceId, "total"] as const,
  total: (workspaceId: string, type: string, filters: AnalyticsDateFilters = {}) =>
    ["analytics", workspaceId, "total", type, filters] as const,
};

export const exchangeRateKeys = {
  today: () => ["exchange-rates-today"] as const,
};
