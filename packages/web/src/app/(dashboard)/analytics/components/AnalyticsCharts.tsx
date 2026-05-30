"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AnalyticsOverviewResult } from "@/modules/analytics/analytics.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatMoney } from "@/shared/utils/money";

interface AnalyticsChartsProps {
  analytics: AnalyticsOverviewResult;
}

const CHART_COLORS = {
  income: "#16a34a",
  expense: "#ef4444",
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

export function AnalyticsCharts({ analytics }: AnalyticsChartsProps) {
  const dailyChartData = useMemo(
    () =>
      analytics.timeSeries.map((item) => ({
        date: formatDateLabel(item.date),
        income: Number(item.incomeTotalInBaseCurrency),
        expense: Number(item.expenseTotalInBaseCurrency),
      })),
    [analytics.timeSeries]
  );

  const categoryChartData = useMemo(
    () =>
      analytics.expenseCategories.slice(0, 6).map((item) => ({
        name: item.name,
        total: Number(item.totalInBaseCurrency),
      })),
    [analytics.expenseCategories]
  );

  const debtChartData = useMemo(
    () =>
      analytics.debtsByPerson.slice(0, 6).map((item) => ({
        personName: item.personName,
        lent: Number(item.lentTotalInBaseCurrency),
        borrowed: Number(item.borrowedTotalInBaseCurrency),
      })),
    [analytics.debtsByPerson]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Доходы и расходы по дням</CardTitle>
          <CardDescription>Только денежный поток. Переводы и долги здесь не смешиваются с расходами.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {dailyChartData.some((item) => item.income > 0 || item.expense > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatChartValue(toNumber(value), analytics.baseCurrency)}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatChartValue(toNumber(value), analytics.baseCurrency),
                    name === "income" ? "Доходы" : "Расходы",
                  ]}
                />
                <Legend formatter={(value) => (value === "income" ? "Доходы" : "Расходы")} />
                <Bar dataKey="income" fill={CHART_COLORS.income} radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill={CHART_COLORS.expense} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="Нет данных для графика доходов и расходов." />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Категории расходов</CardTitle>
            <CardDescription>Показываем крупнейшие расходные категории в выбранном периоде.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {categoryChartData.length > 0 ? (
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
                      <Cell key={entry.name} fill={CHART_COLORS.categories[index % CHART_COLORS.categories.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Нет расходов для выбранных фильтров." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Открытые долги по людям</CardTitle>
            <CardDescription>Текущий срез: отдельно, сколько вы дали в долг и сколько должны вы.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {debtChartData.length > 0 ? (
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
                      name === "lent" ? "Вы дали в долг" : "Вы должны",
                    ]}
                  />
                  <Legend formatter={(value) => (value === "lent" ? "Вы дали в долг" : "Вы должны")} />
                  <Bar dataKey="lent" stackId="debts" fill={CHART_COLORS.debtLent} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="borrowed" stackId="debts" fill={CHART_COLORS.debtBorrowed} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Сейчас нет открытых долгов." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
