"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.api";
import {
  toAnalyticsErrorResult,
  toAnalyticsOverviewParams,
  toAnalyticsOverviewResult,
} from "@/modules/analytics/analytics.api";
import type { AnalyticsOverviewResult } from "@/modules/analytics/analytics.types";
import {
  ANALYTICS_PERIOD_PRESETS,
  type AnalyticsPeriodPreset,
  applyAnalyticsPeriodPreset,
  buildAnalyticsOverviewViewModel,
  getActiveAnalyticsPeriodPreset,
} from "@/modules/analytics/analytics.view-model";
import { getCategories } from "@/modules/categories/category.api";
import {
  TransactionsFilterButton,
  TransactionsFilterDrawer,
  useTransactionFilters,
} from "@/modules/transactions/components/transactions-filters";
import { getWorkspaceMembers } from "@/modules/workspace/workspace.api";
import { getAnalyticsOverview as getApiAnalyticsOverview } from "@/shared/api/generated/analytics/analytics";
import { accountKeys, analyticsKeys, categoryKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatMoney } from "@/shared/utils/money";

interface AnalyticsContentProps {
  workspaceId: string;
}

const AnalyticsCharts = dynamic(() => import("./AnalyticsCharts").then((mod) => mod.AnalyticsCharts), {
  ssr: false,
  loading: () => <AnalyticsChartsSkeleton />,
});

function isAnalyticsSuccessResponse(data: unknown): data is AnalyticsOverviewResult {
  return Boolean(data && typeof data === "object" && "summary" in data && !("error" in data));
}

function formatRangeLabel(startDate: string, endDate: string) {
  const start = format(new Date(`${startDate}T00:00:00`), "dd.MM.yyyy");
  const end = format(new Date(`${endDate}T00:00:00`), "dd.MM.yyyy");

  return `${start} - ${end}`;
}

function formatCompactMoney(value: string, currency: string) {
  return formatMoney(value, currency);
}

function AnalyticsChartsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[390px] w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-[260px] w-full rounded-xl" />
        <Skeleton className="h-[260px] w-full rounded-xl" />
      </div>
    </div>
  );
}

function SecondaryMetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="gap-0 py-2 md:py-3">
      <CardHeader className="px-3 md:px-6">
        <div className="min-w-0 space-y-1">
          <CardDescription className="text-xs md:text-sm">{title}</CardDescription>
          <CardTitle className="truncate text-base md:text-2xl">{value}</CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

export function AnalyticsContent({ workspaceId }: AnalyticsContentProps) {
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
  const {
    appliedFilters,
    appliedFiltersCount,
    isNavigationPending: isFiltersNavigationPending,
    applyFilters,
    resetFilters,
  } = useTransactionFilters();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
  });

  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
  });

  const { data: membersData } = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
  });

  const {
    data: analyticsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: analyticsKeys.overview(workspaceId, appliedFilters),
    queryFn: async () => {
      try {
        const response = await getApiAnalyticsOverview(workspaceId, toAnalyticsOverviewParams(appliedFilters));
        return toAnalyticsOverviewResult(response);
      } catch (error: unknown) {
        return toAnalyticsErrorResult(error);
      }
    },
    placeholderData: keepPreviousData,
  });

  const analytics = isAnalyticsSuccessResponse(analyticsData) ? analyticsData : null;
  const viewModel = useMemo(() => (analytics ? buildAnalyticsOverviewViewModel(analytics) : null), [analytics]);
  const activePeriodPreset = analytics
    ? getActiveAnalyticsPeriodPreset({
        dateFrom: analytics.effectiveRange.startDate,
        dateTo: analytics.effectiveRange.endDate,
      })
    : null;
  const periodStatusLabel =
    ANALYTICS_PERIOD_PRESETS.find((preset) => preset.value === activePeriodPreset)?.label ?? "Произвольный период";
  const accounts = accountsData?.data || [];
  const categories = categoriesData?.data || [];
  const members = membersData?.data || [];

  const handleApplyFilters = (nextFilters: typeof appliedFilters) => {
    setIsFiltersDrawerOpen(false);
    applyFilters(nextFilters);
  };

  const handleResetFilters = () => {
    setIsFiltersDrawerOpen(false);
    resetFilters();
  };

  const handlePeriodPresetChange = (preset: AnalyticsPeriodPreset) => {
    applyFilters(applyAnalyticsPeriodPreset(appliedFilters, preset));
  };

  const isInitialLoading = isLoading && !analytics;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold md:text-3xl">Финансовый обзор</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Select<AnalyticsPeriodPreset>
                label="Период"
                placeholder="Период"
                value={activePeriodPreset ?? undefined}
                valueLabel={analytics ? periodStatusLabel : undefined}
                multiple={false}
                options={ANALYTICS_PERIOD_PRESETS}
                onChange={handlePeriodPresetChange}
              />
            </div>
            <TransactionsFilterButton
              appliedFiltersCount={appliedFiltersCount}
              disabled={isFiltersNavigationPending}
              onClick={() => {
                setIsFiltersDrawerOpen(true);
              }}
            />
          </div>
        </div>

        {analytics ? (
          <p className="sr-only">
            Период: {formatRangeLabel(analytics.effectiveRange.startDate, analytics.effectiveRange.endDate)}
          </p>
        ) : null}

        {isInitialLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 py-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="space-y-6">
              <Skeleton className="h-[390px] w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Skeleton className="h-[260px] w-full rounded-xl" />
                <Skeleton className="h-[260px] w-full rounded-xl" />
              </div>
            </div>
          </div>
        ) : analytics && viewModel ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SecondaryMetricCard title="Расходы в день" value={viewModel.averageExpensePerDayLabel} />
              <SecondaryMetricCard title="Доходы в день" value={viewModel.averageIncomePerDayLabel} />
              <SecondaryMetricCard
                title="Объём переводов"
                value={formatCompactMoney(analytics.summary.transferVolume.totalInBaseCurrency, analytics.baseCurrency)}
              />
              <SecondaryMetricCard
                title="Открытые долги сейчас"
                value={formatCompactMoney(analytics.summary.openDebts.totalInBaseCurrency, analytics.baseCurrency)}
              />
            </div>

            <AnalyticsCharts viewModel={viewModel} />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Не удалось загрузить аналитику</CardTitle>
              <CardDescription>
                {analyticsData && typeof analyticsData === "object" && "error" in analyticsData
                  ? analyticsData.error
                  : "Попробуйте обновить страницу."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <TransactionsFilterDrawer
        open={isFiltersDrawerOpen}
        onOpenChange={setIsFiltersDrawerOpen}
        appliedFilters={appliedFilters}
        members={members}
        categories={categories}
        accounts={accounts}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {isFetching && analytics ? (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 rounded-full border bg-background/95 p-3 text-muted-foreground shadow-lg backdrop-blur"
        >
          <Loader2 className="size-5 animate-spin" />
          <span className="sr-only">Обновление аналитики</span>
        </div>
      ) : null}
    </div>
  );
}
