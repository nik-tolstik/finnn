"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRightLeft, HandCoins, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import {
  toAnalyticsErrorResult,
  toAnalyticsOverviewParams,
  toAnalyticsOverviewResult,
} from "@/modules/analytics/analytics.api";
import type { AnalyticsOverviewResult } from "@/modules/analytics/analytics.types";
import { getCategories } from "@/modules/categories/category.service";
import {
  TransactionsFilterButton,
  TransactionsFilterDrawer,
  useTransactionFilters,
} from "@/modules/transactions/components/transactions-filters";
import { getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { getAnalyticsOverview as getApiAnalyticsOverview } from "@/shared/api/generated/analytics/analytics";
import { accountKeys, analyticsKeys, categoryKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
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

function formatPercentageChange(change: number | null) {
  if (change === null) {
    return "Нет базы для сравнения";
  }

  if (change === 0) {
    return "Без изменений";
  }

  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% к прошлому периоду`;
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

function AnalyticsMetricCard({
  title,
  description,
  value,
  delta,
  tone,
  icon,
}: {
  title: string;
  description: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
  icon: ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-full border bg-muted/40 p-2 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
        {delta ? (
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              tone === "positive" && "text-green-600",
              tone === "negative" && "text-red-600",
              tone !== "positive" && tone !== "negative" && "text-muted-foreground"
            )}
          >
            {delta}
          </p>
        ) : null}
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

  const isInitialLoading = isLoading && !analytics;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold md:text-3xl">Аналитика</h1>
              <Badge variant="secondary">MVP</Badge>
            </div>
            {analytics ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Период: {formatRangeLabel(analytics.effectiveRange.startDate, analytics.effectiveRange.endDate)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Открытые долги считаются как текущий срез и не зависят от фильтров транзакций.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Сводка по денежному потоку, переводам и открытым долгам.</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isFetching && analytics ? <span className="text-sm text-muted-foreground">Обновляем…</span> : null}
            <TransactionsFilterButton
              appliedFiltersCount={appliedFiltersCount}
              disabled={isFiltersNavigationPending}
              onClick={() => {
                setIsFiltersDrawerOpen(true);
              }}
            />
          </div>
        </div>

        {isInitialLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <AnalyticsMetricCard
                title="Доходы"
                description={`${analytics.summary.income.transactionCount} транзакций`}
                value={formatCompactMoney(analytics.summary.income.totalInBaseCurrency, analytics.baseCurrency)}
                delta={formatPercentageChange(analytics.summary.income.percentageChange)}
                tone={
                  analytics.summary.income.percentageChange === null
                    ? "neutral"
                    : analytics.summary.income.percentageChange >= 0
                      ? "positive"
                      : "negative"
                }
                icon={<TrendingUp className="size-4" />}
              />
              <AnalyticsMetricCard
                title="Расходы"
                description={`${analytics.summary.expense.transactionCount} транзакций`}
                value={formatCompactMoney(analytics.summary.expense.totalInBaseCurrency, analytics.baseCurrency)}
                delta={formatPercentageChange(analytics.summary.expense.percentageChange)}
                tone={
                  analytics.summary.expense.percentageChange === null
                    ? "neutral"
                    : analytics.summary.expense.percentageChange <= 0
                      ? "positive"
                      : "negative"
                }
                icon={<TrendingDown className="size-4" />}
              />
              <AnalyticsMetricCard
                title="Чистый поток"
                description="Доходы минус расходы"
                value={formatCompactMoney(analytics.summary.netFlow.totalInBaseCurrency, analytics.baseCurrency)}
                delta={formatPercentageChange(analytics.summary.netFlow.percentageChange)}
                tone={
                  analytics.summary.netFlow.percentageChange === null
                    ? "neutral"
                    : analytics.summary.netFlow.percentageChange >= 0
                      ? "positive"
                      : "negative"
                }
                icon={<Wallet className="size-4" />}
              />
              <AnalyticsMetricCard
                title="Объём переводов"
                description={`${analytics.summary.transferVolume.transactionCount} переводов`}
                value={formatCompactMoney(analytics.summary.transferVolume.totalInBaseCurrency, analytics.baseCurrency)}
                icon={<ArrowRightLeft className="size-4" />}
              />
              <AnalyticsMetricCard
                title="Открытые долги сейчас"
                description={`${analytics.summary.openDebts.debtCount} активных долгов`}
                value={formatCompactMoney(analytics.summary.openDebts.totalInBaseCurrency, analytics.baseCurrency)}
                icon={<HandCoins className="size-4" />}
              />
            </div>

            <AnalyticsCharts analytics={analytics} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Разбивка по категориям</CardTitle>
                  <CardDescription>Полная таблица расходов с долей и количеством операций.</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.expenseCategories.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Категория</TableHead>
                          <TableHead>Операций</TableHead>
                          <TableHead>Доля</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.expenseCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>{category.transactionCount}</TableCell>
                            <TableCell>{category.sharePercent.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">
                              {formatCompactMoney(category.totalInBaseCurrency, analytics.baseCurrency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyCardState message="Нет расходных категорий для выбранного периода." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Крупнейшие движения</CardTitle>
                  <CardDescription>Топ-10 по абсолютному денежному эффекту в базовой валюте.</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.largestMovements.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Основное</TableHead>
                          <TableHead>Детали</TableHead>
                          <TableHead className="text-right">Исходная сумма</TableHead>
                          <TableHead className="text-right">В базовой валюте</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.largestMovements.map((movement) => (
                          <TableRow key={`${movement.kind}-${movement.id}`}>
                            <TableCell>{format(new Date(`${movement.date}T00:00:00`), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{movement.kindLabel}</TableCell>
                            <TableCell className="font-medium">{movement.primaryLabel}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-muted-foreground">
                              {movement.secondaryLabel}
                            </TableCell>
                            <TableCell className="text-right">{movement.originalAmount}</TableCell>
                            <TableCell className="text-right">{movement.amountInBaseCurrency}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyCardState message="Нет движений для таблицы крупнейших операций." />
                  )}
                </CardContent>
              </Card>
            </div>
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
    </div>
  );
}
