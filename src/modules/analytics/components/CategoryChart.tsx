"use client";

import { useQuery } from "@tanstack/react-query";
import { ResponsivePie } from "@nivo/pie";

import { getCategoryStats, getIncomeCategoryStats } from "../analytics.service";
import { formatMoney } from "@/shared/utils/money";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";

interface CategoryChartProps {
  workspaceId: string;
  baseCurrency: string;
  dateFrom: Date;
  dateTo: Date;
  selectedAccountIds: string[] | undefined;
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#a855f7",
  "#10b981",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#78716c",
  "#6b7280",
];

export function CategoryChart({ workspaceId, baseCurrency, dateFrom, dateTo, selectedAccountIds }: CategoryChartProps) {
  const { isMobile } = useBreakpoints();

  const { data: expenseData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["categoryStats", workspaceId, selectedAccountIds, dateFrom, dateTo],
    queryFn: () => getCategoryStats(workspaceId, selectedAccountIds, dateFrom, dateTo),
    staleTime: 5000,
  });

  const { data: incomeData, isLoading: isLoadingIncome } = useQuery({
    queryKey: ["incomeCategoryStats", workspaceId, selectedAccountIds, dateFrom, dateTo],
    queryFn: () => getIncomeCategoryStats(workspaceId, selectedAccountIds, dateFrom, dateTo),
    staleTime: 5000,
  });

  const isLoading = isLoadingExpenses || isLoadingIncome;

  const formatCurrency = (value: number) => {
    return formatMoney(value.toString(), baseCurrency);
  };

  const normalizeColor = (color: string | null | undefined, fallbackIndex: number): string => {
    if (!color) return COLORS[fallbackIndex % COLORS.length];
    if (color.startsWith("#")) return color;
    if (color.startsWith("var(--") || color.startsWith("hsl(var(--")) {
      return COLORS[fallbackIndex % COLORS.length];
    }
    if (color.startsWith("hsl(")) {
      return color;
    }
    return COLORS[fallbackIndex % COLORS.length];
  };

  const expenseChartData =
    expenseData && "data" in expenseData
      ? expenseData.data.map((stat, index) => ({
          id: stat.categoryId,
          label: stat.categoryName,
          value: parseFloat(stat.amount),
          color: normalizeColor(stat.color, index),
        }))
      : [];

  const incomeChartData =
    incomeData && "data" in incomeData
      ? incomeData.data.map((stat, index) => ({
          id: stat.categoryId,
          label: stat.categoryName,
          value: parseFloat(stat.amount),
          color: normalizeColor(stat.color, index),
        }))
      : [];

  const expenseTotal = expenseChartData.reduce((sum, item) => sum + item.value, 0);
  const incomeTotal = incomeChartData.reduce((sum, item) => sum + item.value, 0);

  const renderPieChart = (data: typeof expenseChartData, total: number, title: string) => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">Нет данных</div>
      );
    }

    const getColor = (datum: any) => {
      const item = data.find((d) => d.id === datum.id);
      if (item && item.color) {
        return item.color;
      }
      const index = data.findIndex((d) => d.id === datum.id);
      return COLORS[index % COLORS.length];
    };

    return (
      <div className="w-full flex flex-col">
        <div className="h-[300px] w-full">
          <ResponsivePie
            data={data}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            innerRadius={isMobile ? 0.4 : 0.5}
            padAngle={2}
            cornerRadius={4}
            activeOuterRadiusOffset={8}
            activeInnerRadiusOffset={8}
            colors={getColor}
            borderWidth={2}
            borderColor={{
              from: "color",
              modifiers: [["darker", 0.2]],
            }}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="oklch(0.708 0 0)"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: "color" }}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor={{
              from: "color",
              modifiers: [["darker", 2]],
            }}
            enableArcLabels={false}
            enableArcLinkLabels={false}
            tooltip={({ datum }) => {
              const percent = ((datum.value / total) * 100).toFixed(1);
              return (
                <div className="bg-card border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
                  <p className="text-xs font-medium text-foreground mb-1">{datum.label}</p>
                  <p className="text-sm font-semibold text-foreground mb-1">{formatCurrency(datum.value)}</p>
                  <p className="text-xs text-muted-foreground">{percent}% от общей суммы</p>
                </div>
              );
            }}
            motionConfig="gentle"
            animate={true}
          />
        </div>
        <div className={`mt-4 flex ${isMobile ? "flex-col gap-2" : "flex-row flex-wrap gap-3 justify-center"}`}>
          {data.map((datum) => {
            const percent = ((datum.value / total) * 100).toFixed(1);
            return (
              <div
                key={datum.id}
                className={`flex items-center gap-2 ${isMobile ? "w-full" : ""}`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: datum.color }}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {datum.label} ({percent}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Расходы по категориям</h3>
        <div className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">Загрузка...</div>
          ) : expenseData && "error" in expenseData ? (
            <div className="flex items-center justify-center h-[300px] text-destructive">{expenseData.error}</div>
          ) : (
            renderPieChart(expenseChartData, expenseTotal, "Расходы")
          )}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Доходы по категориям</h3>
        <div className="w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">Загрузка...</div>
          ) : incomeData && "error" in incomeData ? (
            <div className="flex items-center justify-center h-[300px] text-destructive">{incomeData.error}</div>
          ) : (
            renderPieChart(incomeChartData, incomeTotal, "Доходы")
          )}
        </div>
      </div>
    </div>
  );
}
