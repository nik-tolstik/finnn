export interface ResolvedDateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface MoneyBucket {
  currency: string;
  raw: string;
  converted: string;
}

export interface AssistantToolContext {
  workspaceId: string;
  baseCurrency: string;
}
