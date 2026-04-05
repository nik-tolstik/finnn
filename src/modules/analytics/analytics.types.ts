import type { CombinedTransaction } from "@/modules/transactions/transaction.types";

export interface AnalyticsDateRange {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  dayCount: number;
  isImplicit: boolean;
}

export interface AnalyticsSummaryMetric {
  totalInBaseCurrency: string;
  previousTotalInBaseCurrency: string;
  percentageChange: number | null;
  transactionCount: number;
}

export interface AnalyticsTimeSeriesPoint {
  date: string;
  incomeTotalInBaseCurrency: string;
  expenseTotalInBaseCurrency: string;
}

export interface AnalyticsExpenseCategory {
  id: string;
  name: string;
  totalInBaseCurrency: string;
  transactionCount: number;
  sharePercent: number;
}

export interface AnalyticsDebtByPerson {
  personName: string;
  lentTotalInBaseCurrency: string;
  borrowedTotalInBaseCurrency: string;
  netExposureInBaseCurrency: string;
  debtCount: number;
}

export interface AnalyticsLargestMovement {
  id: string;
  kind: CombinedTransaction["kind"];
  kindLabel: string;
  date: string;
  primaryLabel: string;
  secondaryLabel: string;
  originalAmount: string;
  amountInBaseCurrency: string;
}

export interface AnalyticsOverviewResult {
  baseCurrency: string;
  effectiveRange: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
    dayCount: number;
    isImplicit: boolean;
  };
  summary: {
    income: AnalyticsSummaryMetric;
    expense: AnalyticsSummaryMetric;
    netFlow: {
      totalInBaseCurrency: string;
      previousTotalInBaseCurrency: string;
      percentageChange: number | null;
    };
    transferVolume: {
      totalInBaseCurrency: string;
      transactionCount: number;
    };
    openDebts: {
      totalInBaseCurrency: string;
      debtCount: number;
    };
  };
  comparison: {
    incomePreviousTotalInBaseCurrency: string;
    expensePreviousTotalInBaseCurrency: string;
    netFlowPreviousTotalInBaseCurrency: string;
  };
  timeSeries: AnalyticsTimeSeriesPoint[];
  expenseCategories: AnalyticsExpenseCategory[];
  debtsByPerson: AnalyticsDebtByPerson[];
  largestMovements: AnalyticsLargestMovement[];
}
