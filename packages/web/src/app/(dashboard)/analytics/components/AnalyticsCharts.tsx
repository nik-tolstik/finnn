"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsOverviewResult } from "@/modules/analytics/analytics.types";
import type { AnalyticsOverviewViewModel, AnalyticsTone } from "@/modules/analytics/analytics.view-model";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

interface AnalyticsChartsProps {
  analytics: AnalyticsOverviewResult;
  viewModel: AnalyticsOverviewViewModel;
}

const CHART_COLORS = {
  income: "#16a34a",
  expense: "#ef4444",
  netFlow: "#2563eb",
  debtLent: "#2563eb",
  debtBorrowed: "#f59e0b",
  categories: ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#06b6d4", "#8b5cf6"],
};

function formatDateLabel(value: string) {
  return format(new Date(`${value}T00:00:00`), "dd.MM");
}

function formatChartValue(value: number, currency: string) {
  return formatMoney(String(value), currency);
}

function EmptyChartState({ message }: { message: string }) {
  return <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function getToneClassName(tone: AnalyticsTone) {
  if (tone === "positive") {
    return "text-green-600";
  }

  if (tone === "negative") {
    return "text-red-600";
  }

  return "text-muted-foreground";
}

export function AnalyticsCharts({ analytics, viewModel }: AnalyticsChartsProps) {
  const dailyChartData = useMemo(
    () =>
      viewModel.timeSeries.map((item) => ({
        date: formatDateLabel(item.date),
        income: item.income,
        expense: item.expense,
        cumulativeNetFlow: item.cumulativeNetFlow,
        netFlow: item.income - item.expense,
      })),
    [viewModel.timeSeries]
  );

  const categoryChartData = useMemo(
    () =>
      viewModel.categoryRows.slice(0, 6).map((item) => ({
        name: item.name,
        total: Number(item.total),
      })),
    [viewModel.categoryRows]
  );

  const debtChartData = useMemo(
    () =>
      viewModel.debtRows.slice(0, 6).map((item) => ({
        personName: item.personName,
        lent: item.lent,
        borrowed: item.borrowed,
      })),
    [viewModel.debtRows]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Динамика денежного потока</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyChartData.some((item) => item.income > 0 || item.expense > 0 || item.cumulativeNetFlow !== 0) ? (
            <>
              <div className="space-y-2 md:hidden">
                {dailyChartData
                  .filter((item) => item.income > 0 || item.expense > 0)
                  .slice(-7)
                  .reverse()
                  .map((item) => {
                    const tone = item.netFlow > 0 ? "positive" : item.netFlow < 0 ? "negative" : "neutral";

                    return (
                      <div key={item.date} className="rounded-lg border px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{item.date}</p>
                          <p className={cn("text-sm font-semibold", getToneClassName(tone))}>
                            {formatChartValue(item.netFlow, analytics.baseCurrency)}
                          </p>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Доходы: {formatChartValue(item.income, analytics.baseCurrency)}</span>
                          <span>Расходы: {formatChartValue(item.expense, analytics.baseCurrency)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="hidden h-[320px] md:block">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis
                      yAxisId="money"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatChartValue(toNumber(value), analytics.baseCurrency)}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatChartValue(toNumber(value), analytics.baseCurrency),
                        name === "income" ? "Доходы" : name === "expense" ? "Расходы" : "Накопленный поток",
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "income" ? "Доходы" : value === "expense" ? "Расходы" : "Накопленный поток"
                      }
                    />
                    <Bar yAxisId="money" dataKey="income" fill={CHART_COLORS.income} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="money" dataKey="expense" fill={CHART_COLORS.expense} radius={[6, 6, 0, 0]} />
                    <Line
                      yAxisId="money"
                      type="monotone"
                      dataKey="cumulativeNetFlow"
                      stroke={CHART_COLORS.netFlow}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <EmptyChartState message="Нет данных для графика денежного потока." />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Категории расходов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {categoryChartData.length > 0 ? (
              <>
                <div className="hidden h-[240px] md:block">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatChartValue(toNumber(value), analytics.baseCurrency)}
                      />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} />
                      <Tooltip formatter={(value) => formatChartValue(toNumber(value), analytics.baseCurrency)} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {viewModel.categoryRows.slice(0, 5).map((category, index) => (
                    <div key={category.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium">{category.name}</span>
                        <span className="shrink-0 text-muted-foreground">{category.totalLabel}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${category.barWidthPercent}%`,
                            backgroundColor: CHART_COLORS.categories[index % CHART_COLORS.categories.length],
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{category.transactionCount} операций</span>
                        <span>{category.sharePercent.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState message="Нет расходов для выбранных фильтров." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Открытые долги по людям</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {debtChartData.length > 0 ? (
              <>
                <div className="hidden h-[240px] md:block">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={debtChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="personName" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatChartValue(toNumber(value), analytics.baseCurrency)}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatChartValue(toNumber(value), analytics.baseCurrency),
                          name === "lent" ? "Вам должны" : "Вы должны",
                        ]}
                      />
                      <Legend formatter={(value) => (value === "lent" ? "Вам должны" : "Вы должны")} />
                      <Bar dataKey="lent" stackId="debts" fill={CHART_COLORS.debtLent} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="borrowed" stackId="debts" fill={CHART_COLORS.debtBorrowed} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="divide-y rounded-lg border">
                  {viewModel.debtRows.slice(0, 5).map((debt) => (
                    <div key={debt.personName} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{debt.personName}</p>
                        <p className="text-xs text-muted-foreground">{debt.debtCount} активных долгов</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("font-medium", getToneClassName(debt.netExposureTone))}>
                          {debt.netExposureLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">чистая позиция</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChartState message="Сейчас нет открытых долгов." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
