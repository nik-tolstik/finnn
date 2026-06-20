"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  DashboardExchangeRatesCards,
  useDashboardExchangeRates,
} from "@/app/(dashboard)/components/dashboard-exchange-rates";
import { getAccounts } from "@/modules/accounts/account.api";
import {
  toAnalyticsCalendarParams,
  toAnalyticsCalendarResult,
  toAnalyticsErrorResult,
  toAnalyticsOverviewParams,
  toAnalyticsOverviewResult,
} from "@/modules/analytics/analytics.api";
import type { AnalyticsCalendarResult, AnalyticsOverviewResult } from "@/modules/analytics/analytics.types";
import {
  ANALYTICS_PERIOD_PRESETS,
  type AnalyticsPeriodPreset,
  applyAnalyticsPeriodPreset,
  buildAnalyticsOverviewViewModel,
  getActiveAnalyticsPeriodPreset,
  getAnalyticsCalendarMonthRange,
} from "@/modules/analytics/analytics.view-model";
import { getCategories } from "@/modules/categories/category.api";
import {
  TransactionsFilterButton,
  TransactionsFilterDrawer,
  type TransactionViewFilters,
  useTransactionFilters,
} from "@/modules/transactions/components/transactions-filters";
import { toDateString, toDateValue } from "@/modules/transactions/components/transactions-filters/utils/date";
import { getWorkspaceMembers } from "@/modules/workspace/workspace.api";
import {
  getAnalyticsCalendar as getApiAnalyticsCalendar,
  getAnalyticsOverview as getApiAnalyticsOverview,
} from "@/shared/api/generated/analytics/analytics";
import { accountKeys, analyticsKeys, categoryKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { DatePicker } from "@/shared/ui/date-picker";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatMoney } from "@/shared/utils/money";

import { AnalyticsCalendar } from "./AnalyticsCalendar";

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

function isCalendarSuccessResponse(data: unknown): data is AnalyticsCalendarResult {
  return Boolean(data && typeof data === "object" && "calendarDays" in data && !("error" in data));
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

function AnalyticsCalendarSkeleton() {
  return <Skeleton className="h-[520px] w-full rounded-xl" />;
}

function omitDateFilters(filters: TransactionViewFilters): TransactionViewFilters {
  const { dateFrom: _dateFrom, dateTo: _dateTo, ...rest } = filters;
  return rest;
}

function getCalendarFiltersForMonth(filters: TransactionViewFilters, monthDate: Date) {
  return {
    ...filters,
    ...getAnalyticsCalendarMonthRange(monthDate),
  };
}

async function getAnalyticsCalendarResult(workspaceId: string, filters: TransactionViewFilters) {
  try {
    const response = await getApiAnalyticsCalendar(workspaceId, toAnalyticsCalendarParams(filters));
    return toAnalyticsCalendarResult(response);
  } catch (error: unknown) {
    return toAnalyticsErrorResult(error);
  }
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

function MobileExchangeRates({ workspaceId }: { workspaceId: string }) {
  const { isLoading, rates, shouldRender } = useDashboardExchangeRates(workspaceId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="rounded-md border bg-background p-3" key={index}>
            <Skeleton className="mb-3 size-5 rounded-full" />
            <Skeleton className="mb-2 h-3 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  return <DashboardExchangeRatesCards className="md:hidden" rates={rates} />;
}

export function AnalyticsContent({ workspaceId }: AnalyticsContentProps) {
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const queryClient = useQueryClient();
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
  const calendarBaseFilters = useMemo(() => omitDateFilters(appliedFilters), [appliedFilters]);
  const previousCalendarMonth = useMemo(() => subMonths(calendarMonth, 1), [calendarMonth]);
  const nextCalendarMonth = useMemo(() => addMonths(calendarMonth, 1), [calendarMonth]);
  const previousCalendarFilters = useMemo(
    () => getCalendarFiltersForMonth(calendarBaseFilters, previousCalendarMonth),
    [calendarBaseFilters, previousCalendarMonth]
  );
  const calendarFilters = useMemo(
    () => getCalendarFiltersForMonth(calendarBaseFilters, calendarMonth),
    [calendarBaseFilters, calendarMonth]
  );
  const nextCalendarFilters = useMemo(
    () => getCalendarFiltersForMonth(calendarBaseFilters, nextCalendarMonth),
    [calendarBaseFilters, nextCalendarMonth]
  );
  const {
    data: calendarData,
    isLoading: isCalendarLoading,
    isFetching: isCalendarFetching,
  } = useQuery({
    queryKey: analyticsKeys.calendar(workspaceId, calendarFilters),
    queryFn: () => getAnalyticsCalendarResult(workspaceId, calendarFilters),
  });

  const analytics = isAnalyticsSuccessResponse(analyticsData) ? analyticsData : null;
  const calendar = isCalendarSuccessResponse(calendarData) ? calendarData : null;
  useEffect(() => {
    if (!calendar) {
      return;
    }

    void queryClient.prefetchQuery({
      queryKey: analyticsKeys.calendar(workspaceId, previousCalendarFilters),
      queryFn: () => getAnalyticsCalendarResult(workspaceId, previousCalendarFilters),
    });
    void queryClient.prefetchQuery({
      queryKey: analyticsKeys.calendar(workspaceId, nextCalendarFilters),
      queryFn: () => getAnalyticsCalendarResult(workspaceId, nextCalendarFilters),
    });
  }, [calendar, nextCalendarFilters, previousCalendarFilters, queryClient, workspaceId]);
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

  const handleDateFilterChange = (key: "dateFrom" | "dateTo", date: Date | undefined) => {
    applyFilters({
      ...appliedFilters,
      [key]: toDateString(date),
    });
  };

  const isInitialLoading = isLoading && !analytics;
  const isCalendarInitialLoading = isCalendarLoading && !calendar;

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
            <div className="hidden items-center gap-2 md:flex">
              <DatePicker
                date={toDateValue(appliedFilters.dateFrom)}
                onSelect={(date) => {
                  handleDateFilterChange("dateFrom", date);
                }}
                placeholder="От"
                className="w-[132px]"
                align="end"
              />
              <DatePicker
                date={toDateValue(appliedFilters.dateTo)}
                onSelect={(date) => {
                  handleDateFilterChange("dateTo", date);
                }}
                placeholder="До"
                className="w-[132px]"
                align="end"
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

        <MobileExchangeRates workspaceId={workspaceId} />

        {isCalendarInitialLoading ? (
          <AnalyticsCalendarSkeleton />
        ) : calendar ? (
          <AnalyticsCalendar
            calendar={calendar}
            monthDate={calendarMonth}
            appliedFilters={calendarBaseFilters}
            onMonthChange={setCalendarMonth}
            workspaceId={workspaceId}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Не удалось загрузить календарь</CardTitle>
              <CardDescription>
                {calendarData && typeof calendarData === "object" && "error" in calendarData
                  ? calendarData.error
                  : "Попробуйте обновить страницу."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

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

      {(isFetching && analytics) || (isCalendarFetching && calendar) ? (
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
