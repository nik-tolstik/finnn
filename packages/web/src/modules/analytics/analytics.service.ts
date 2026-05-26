"use server";

import { getAnalyticsOverview as getApiAnalyticsOverview } from "@/shared/api/generated/analytics/analytics";
import type {
  AnalyticsOverviewResponseDto,
  AnalyticsSummaryMetricDto,
  GetAnalyticsOverviewParams,
} from "@/shared/api/generated/model";
import { fail } from "@/shared/lib/action-result";
import { getServerApiRequestOptions } from "@/shared/lib/api-session";

import type { TransactionViewFilters } from "../transactions/components/transactions-filters";
import type { AnalyticsOverviewResult, AnalyticsSummaryMetric } from "./analytics.types";

function toAnalyticsOverviewParams(filters?: TransactionViewFilters): GetAnalyticsOverviewParams | undefined {
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

function toAnalyticsOverviewResult(response: AnalyticsOverviewResponseDto): AnalyticsOverviewResult {
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

export async function getAnalyticsOverview(
  workspaceId: string,
  filters: TransactionViewFilters = {}
): Promise<AnalyticsOverviewResult | { error: string }> {
  try {
    const response = await getApiAnalyticsOverview(
      workspaceId,
      toAnalyticsOverviewParams(filters),
      await getServerApiRequestOptions()
    );

    return toAnalyticsOverviewResult(response);
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить аналитику");
  }
}
