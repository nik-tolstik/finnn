"use client";

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsOverviewViewModel } from "@/modules/analytics/analytics.view-model";
import { selectAnalyticsCapitalTicks } from "@/modules/analytics/analytics.view-model";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

interface AnalyticsChartsProps {
  viewModel: AnalyticsOverviewViewModel;
}

const CATEGORY_COLORS = {
  income: ["#16a34a", "#22c55e", "#06b6d4", "#2563eb", "#8b5cf6"],
  expense: ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#06b6d4"],
};

function EmptyChartState({ message }: { message: string }) {
  return <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">{message}</div>;
}

function formatShortDate(date: string) {
  return format(new Date(`${date}T00:00:00`), "dd.MM");
}

function formatFullDate(date: string) {
  return format(new Date(`${date}T00:00:00`), "dd.MM.yyyy");
}

function CapitalChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AnalyticsOverviewViewModel["capitalTimeSeries"][number] }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <p className="text-xs text-muted-foreground">{formatFullDate(point.date)}</p>
      <p className="mt-1 font-medium">{point.totalLabel}</p>
    </div>
  );
}

function WorkspaceCapitalChartCard({ viewModel }: AnalyticsChartsProps) {
  const { isMobile } = useBreakpoints();
  const ticks = selectAnalyticsCapitalTicks(viewModel.capitalTimeSeries, isMobile ? 4 : 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Капитал</CardTitle>
      </CardHeader>
      <CardContent>
        {viewModel.capitalTimeSeries.length > 0 ? (
          <div className="h-[320px] w-full select-none [&_.recharts-surface]:select-none [&_.recharts-surface]:outline-none [&_.recharts-surface_*]:select-none [&_.recharts-surface_*]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={viewModel.capitalTimeSeries}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="workspaceCapitalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  tickFormatter={formatShortDate}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  dy={8}
                />
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <RechartsTooltip cursor={{ stroke: "#16a34a", strokeOpacity: 0.2 }} content={<CapitalChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#workspaceCapitalGradient)"
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#16a34a" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState message="Нет счетов для выбранных фильтров." />
        )}
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownCard({
  title,
  rows,
  colors,
  emptyMessage,
}: {
  title: string;
  rows: AnalyticsOverviewViewModel["categoryRows"];
  colors: string[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-6">
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.slice(0, 5).map((category, index) => (
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
                      backgroundColor: colors[index % colors.length],
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
        ) : (
          <EmptyChartState message={emptyMessage} />
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCharts({ viewModel }: AnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      <WorkspaceCapitalChartCard viewModel={viewModel} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CategoryBreakdownCard
          title="Доходы"
          rows={viewModel.incomeCategoryRows}
          colors={CATEGORY_COLORS.income}
          emptyMessage="Нет доходов для выбранных фильтров."
        />
        <CategoryBreakdownCard
          title="Расходы"
          rows={viewModel.categoryRows}
          colors={CATEGORY_COLORS.expense}
          emptyMessage="Нет расходов для выбранных фильтров."
        />
      </div>
    </div>
  );
}
