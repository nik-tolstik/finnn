import type {
  AnalyticsCalendarResponseDto,
  AnalyticsOverviewResponseDto,
  AnalyticsSummaryMetricDto,
  GetAnalyticsCalendarParams,
  GetAnalyticsOverviewParams,
} from "@/shared/api/generated/model";
import { fail } from "@/shared/lib/action-result";

import type { TransactionViewFilters } from "../transactions/components/transactions-filters";
import type { AnalyticsCalendarResult, AnalyticsOverviewResult, AnalyticsSummaryMetric } from "./analytics.types";

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

export function toAnalyticsCalendarParams(filters?: TransactionViewFilters): GetAnalyticsCalendarParams | undefined {
  return toAnalyticsOverviewParams(filters) as GetAnalyticsCalendarParams | undefined;
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

export function toAnalyticsCalendarResult(response: AnalyticsCalendarResponseDto): AnalyticsCalendarResult {
  return response;
}

export function toAnalyticsErrorResult(error: unknown): { error: string } {
  return fail(error, "Не удалось загрузить аналитику");
}
