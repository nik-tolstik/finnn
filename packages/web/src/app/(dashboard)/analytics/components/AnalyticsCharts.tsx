import type { AnalyticsOverviewViewModel } from "@/modules/analytics/analytics.view-model";
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
  );
}
