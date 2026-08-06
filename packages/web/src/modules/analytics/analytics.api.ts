import type {
  AnalyticsOverviewResponseDto,
  AnalyticsSummaryMetricDto,
  GetAnalyticsOverviewParams,
} from "@/shared/api/generated/model";
import { fail } from "@/shared/lib/action-result";
import { addExchangeRateDateDays, getExchangeRateDateKey } from "@/shared/utils/exchange-rate-date";
import { compareMoney, divideMoney, multiplyMoney, roundMoney, subtractMoney } from "@/shared/utils/money";

import type { TransactionViewFilters } from "../transactions/components/transactions-filters";
import type { AnalyticsOverviewResult, AnalyticsSummaryMetric } from "./analytics.types";

export interface DashboardBalanceDateRange {
  today: string;
  previousDay: string;
}

export interface DashboardBalanceSummary {
  baseCurrency: string;
  currentBalance: string;
  previousBalance: string;
  percentageChange: number | null;
}

export function getDashboardBalanceDateRange(referenceDate = new Date()): DashboardBalanceDateRange {
  const today = getExchangeRateDateKey(referenceDate) ?? "";

  return {
    today,
    previousDay: addExchangeRateDateDays(today, -1) ?? today,
  };
}

function getPercentageChange(current: string, previous: string): number | null {
  if (compareMoney(previous, "0") === 0) {
    return compareMoney(current, "0") === 0 ? 0 : null;
  }

  const change = multiplyMoney(divideMoney(subtractMoney(current, previous), previous), "100");
  return Number(roundMoney(change, 1));
}

export function toDashboardBalanceSummary(
  response: Pick<AnalyticsOverviewResponseDto, "baseCurrency" | "capitalTimeSeries">,
  dateRange: DashboardBalanceDateRange
): DashboardBalanceSummary {
  const currentPoint = response.capitalTimeSeries.find((point) => point.date === dateRange.today);
  const previousPoint = response.capitalTimeSeries.find((point) => point.date === dateRange.previousDay);
  const currentBalance = currentPoint?.totalInBaseCurrency ?? "0";
  const previousBalance = previousPoint?.totalInBaseCurrency ?? "0";

  return {
    baseCurrency: response.baseCurrency,
    currentBalance,
    previousBalance,
    percentageChange: getPercentageChange(currentBalance, previousBalance),
  };
}

export function toAnalyticsOverviewParams(filters?: TransactionViewFilters): GetAnalyticsOverviewParams | undefined {
  if (!filters || Object.values(filters).every((value) => value === undefined)) {
    return undefined;
  }

  return {
    amountFrom: filters.amountFrom,
    amountTo: filters.amountTo,
    userIds: filters.userIds,
    transactionTypes: filters.transactionTypes,
    categoryIds: filters.categoryIds,
    accountIds: filters.accountIds,
    description: filters.description,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

function toSummaryMetric(metric: AnalyticsSummaryMetricDto): AnalyticsSummaryMetric {
  return {
    ...metric,
    percentageChange: metric.percentageChange ?? null,
  };
}

export function toAnalyticsOverviewResult(response: AnalyticsOverviewResponseDto): AnalyticsOverviewResult {
  return {
    ...response,
    summary: {
      income: toSummaryMetric(response.summary.income),
      expense: toSummaryMetric(response.summary.expense),
      netFlow: {
        ...response.summary.netFlow,
        percentageChange: response.summary.netFlow.percentageChange ?? null,
      },
      transferVolume: response.summary.transferVolume,
      openDebts: response.summary.openDebts,
    },
    largestMovements: response.largestMovements.map((movement) => ({
      ...movement,
      kind: movement.kind,
    })),
  };
}

export function toAnalyticsErrorResult(error: unknown): { error: string } {
  return fail(error, "Не удалось загрузить аналитику");
}
