"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRightLeft,
  CalendarDays,
  HandCoins,
  Loader2,
  PiggyBank,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useState } from "react";

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
  type AnalyticsTone,
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
import { cn } from "@/shared/utils/cn";
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

function EmptyCardState({ message }: { message: string }) {
  return <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

function AnalyticsChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton className="h-[390px] w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-[390px] w-full rounded-xl" />
        <Skeleton className="h-[390px] w-full rounded-xl" />
      </div>
    </div>
  );
}

function getToneClassName(tone?: AnalyticsTone) {
  if (tone === "positive") {
    return "text-green-600";
  }

  if (tone === "negative") {
    return "text-red-600";
  }

  return "text-muted-foreground";
}

function SecondaryMetricCard({
  title,
  description,
  value,
  tone,
  icon,
}: {
  title: string;
  description: string;
  value: string;
  tone?: AnalyticsTone;
  icon: ReactNode;
}) {
  return (
    <Card className="gap-0 py-2 md:py-3">
      <CardHeader className="flex-row items-start justify-between gap-2 px-3 md:gap-3 md:px-6">
        <div className="min-w-0 space-y-1">
          <CardDescription className="text-xs md:text-sm">{title}</CardDescription>
          <CardTitle className={cn("truncate text-base md:text-2xl", tone ? getToneClassName(tone) : undefined)}>
            {value}
          </CardTitle>
        </div>
        <div className="hidden rounded-full border bg-muted/40 p-2 text-muted-foreground sm:block">{icon}</div>
      </CardHeader>
      <CardContent className="px-3 md:px-6">
        <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function CashFlowOverview({
  analytics,
  viewModel,
}: {
  analytics: AnalyticsOverviewResult;
  viewModel: ReturnType<typeof buildAnalyticsOverviewViewModel>;
}) {
  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b pb-4">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardDescription>Чистый денежный поток</CardDescription>
            <CardTitle className="text-3xl md:text-4xl">
              {formatCompactMoney(analytics.summary.netFlow.totalInBaseCurrency, analytics.baseCurrency)}
            </CardTitle>
          </div>
          <div className={cn("text-sm font-medium", getToneClassName(viewModel.netFlowTone))}>
            {viewModel.netFlowDeltaLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 md:grid-cols-3">
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Доходы</p>
            <TrendingUp className="size-4 text-green-600" />
          </div>
          <p className="mt-2 text-xl font-semibold">
            {formatCompactMoney(analytics.summary.income.totalInBaseCurrency, analytics.baseCurrency)}
          </p>
          <p className={cn("mt-1 text-xs font-medium", getToneClassName(viewModel.incomeTone))}>
            {viewModel.incomeDeltaLabel}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Расходы</p>
            <TrendingDown className="size-4 text-red-600" />
          </div>
          <p className="mt-2 text-xl font-semibold">
            {formatCompactMoney(analytics.summary.expense.totalInBaseCurrency, analytics.baseCurrency)}
          </p>
          <p className={cn("mt-1 text-xs font-medium", getToneClassName(viewModel.expenseTone))}>
            {viewModel.expenseDeltaLabel}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Норма сбережения</p>
            <PiggyBank className="size-4 text-muted-foreground" />
          </div>
          <p className={cn("mt-2 text-xl font-semibold", getToneClassName(viewModel.savingRateTone))}>
            {viewModel.savingRateLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Чистый поток от доходов</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LargestMovementsList({ analytics }: { analytics: AnalyticsOverviewResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Крупнейшие движения</CardTitle>
        <CardDescription>Топ-10 по абсолютному денежному эффекту в базовой валюте.</CardDescription>
      </CardHeader>
      <CardContent>
        {analytics.largestMovements.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {analytics.largestMovements.map((movement) => (
              <div
                key={`${movement.kind}-${movement.id}`}
                className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[92px_92px_minmax(0,1fr)_minmax(120px,auto)] md:items-center"
              >
                <div className="text-muted-foreground">
                  {format(new Date(`${movement.date}T00:00:00`), "dd.MM.yyyy")}
                </div>
                <div>
                  <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {movement.kindLabel}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{movement.primaryLabel}</p>
                  <p className="truncate text-muted-foreground">{movement.secondaryLabel}</p>
                </div>
                <div className="flex items-center justify-between gap-3 md:block md:text-right">
                  <span className="text-muted-foreground md:hidden">Сумма</span>
                  <div>
                    <p className="font-semibold">{movement.amountInBaseCurrency}</p>
                    <p className="text-xs text-muted-foreground">{movement.originalAmount}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyCardState message="Нет движений для списка крупнейших операций." />
        )}
      </CardContent>
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
            <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 py-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6">
              <Skeleton className="h-[340px] w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Skeleton className="h-[340px] w-full rounded-xl" />
                <Skeleton className="h-[340px] w-full rounded-xl" />
              </div>
            </div>
          </div>
        ) : analytics && viewModel ? (
          <>
            <CashFlowOverview analytics={analytics} viewModel={viewModel} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <SecondaryMetricCard
                title="Расходы в день"
                description={`${analytics.effectiveRange.dayCount} дней в периоде`}
                value={viewModel.averageExpensePerDayLabel}
                icon={<ReceiptText className="size-4" />}
              />
              <SecondaryMetricCard
                title="Доходы в день"
                description={`${analytics.summary.income.transactionCount} доходных операций`}
                value={viewModel.averageIncomePerDayLabel}
                icon={<CalendarDays className="size-4" />}
              />
              <SecondaryMetricCard
                title="Объём переводов"
                description={`${analytics.summary.transferVolume.transactionCount} переводов`}
                value={formatCompactMoney(analytics.summary.transferVolume.totalInBaseCurrency, analytics.baseCurrency)}
                icon={<ArrowRightLeft className="size-4" />}
              />
              <SecondaryMetricCard
                title="Открытые долги сейчас"
                description={`${analytics.summary.openDebts.debtCount} активных долгов`}
                value={formatCompactMoney(analytics.summary.openDebts.totalInBaseCurrency, analytics.baseCurrency)}
                icon={<HandCoins className="size-4" />}
              />
              <SecondaryMetricCard
                title="Топ категория"
                description={
                  viewModel.topExpenseCategory
                    ? `${viewModel.topExpenseCategory.sharePercent.toFixed(1)}% расходов · ${
                        viewModel.topExpenseCategory.transactionCount
                      } операций`
                    : "Нет расходов в периоде"
                }
                value={viewModel.topExpenseCategory?.name ?? "Нет данных"}
                icon={<Wallet className="size-4" />}
              />
            </div>

            <AnalyticsCharts analytics={analytics} viewModel={viewModel} />

            <LargestMovementsList analytics={analytics} />
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
