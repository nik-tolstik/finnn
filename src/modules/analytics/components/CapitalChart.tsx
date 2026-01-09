"use client";

import { ResponsiveLine } from "@nivo/line";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { formatMoney } from "@/shared/utils/money";

import { getCapitalHistory } from "../analytics.service";

interface CapitalChartProps {
  workspaceId: string;
  baseCurrency: string;
  dateFrom: Date;
  dateTo: Date;
  selectedAccountIds: string[] | undefined;
}

export function CapitalChart({ workspaceId, baseCurrency, dateFrom, dateTo, selectedAccountIds }: CapitalChartProps) {
  const { data: capitalData, isLoading } = useQuery({
    queryKey: ["capitalHistory", workspaceId, selectedAccountIds, dateFrom, dateTo],
    queryFn: () => getCapitalHistory(workspaceId, selectedAccountIds, dateFrom, dateTo),
    staleTime: 5000,
  });

  const chartData =
    capitalData && "data" in capitalData
      ? [
          {
            id: "capital",
            color: "#3b82f6",
            data: capitalData.data.map((point) => ({
              x: format(point.date, "dd.MM", { locale: ru }),
              y: parseFloat(point.capital),
              fullDate: point.date,
            })),
          },
        ]
      : [];

  const formatCurrency = (value: number) => {
    return formatMoney(value.toString(), baseCurrency);
  };

  const formatCurrencyWithoutDecimals = (value: number) => {
    const absNum = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    let formatted: string;
    let magnitude: string;

    if (absNum >= 1_000_000_000) {
      const num = absNum / 1_000_000_000;
      const fixed = num.toFixed(1);
      formatted = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
      magnitude = "b";
    } else if (absNum >= 1_000_000) {
      const num = absNum / 1_000_000;
      const fixed = num.toFixed(1);
      formatted = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
      magnitude = "m";
    } else if (absNum >= 1_000) {
      const num = absNum / 1_000;
      const fixed = num.toFixed(1);
      formatted = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
      magnitude = "k";
    } else {
      formatted = absNum.toFixed(0);
      magnitude = "";
    }

    return `${sign}${formatted}${magnitude}`;
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <div className="h-80 w-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Загрузка...</div>
        ) : capitalData && "error" in capitalData ? (
          <div className="flex items-center justify-center h-full text-destructive">{capitalData.error}</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Нет данных</div>
        ) : (
          <ResponsiveLine
            data={chartData}
            margin={{ top: 10, right: 0, left: 20, bottom: 40 }}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: "auto",
              max: "auto",
              stacked: false,
              reverse: false,
            }}
            curve="monotoneX"
            axisTop={null}
            axisRight={{
              tickSize: 5,
              tickPadding: -40,
              tickRotation: 0,
              tickValues: 5,
              format: (value) => formatCurrencyWithoutDecimals(value),
            }}
            axisLeft={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              tickValues:
                chartData[0]?.data.length > 15
                  ? chartData[0].data
                      .filter((_, i) => i % Math.ceil(chartData[0].data.length / 8) === 0)
                      .map((d) => d.x)
                  : chartData[0]?.data.map((d) => d.x),
              format: (value) => value,
            }}
            pointSize={0}
            pointColor="#3b82f6"
            pointBorderWidth={0}
            pointBorderColor={{ from: "serieColor" }}
            pointLabelYOffset={-12}
            enableArea={false}
            enableGridX={true}
            enableGridY={true}
            gridXValues={undefined}
            gridYValues={undefined}
            colors={["#3b82f6"]}
            lineWidth={3}
            enablePoints={false}
            enablePointLabel={false}
            enableSlices="x"
            sliceTooltip={({ slice }) => {
              const point = slice.points[0];
              const fullDate = point.data.fullDate;
              return (
                <div className="bg-card border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
                  <p className="text-xs text-muted-foreground mb-1">
                    {fullDate ? format(new Date(fullDate), "dd MMMM yyyy", { locale: ru }) : slice.id}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(point.data.y)}</p>
                </div>
              );
            }}
            theme={{
              axis: {
                ticks: {
                  text: {
                    fill: "oklch(0.708 0 0)",
                    fontSize: 12,
                  },
                },
                domain: {
                  line: {
                    stroke: "hsl(var(--border))",
                    strokeWidth: 1,
                  },
                },
              },
              grid: {
                line: {
                  stroke: "hsl(var(--border))",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                  opacity: 0.5,
                },
              },
            }}
            motionConfig="gentle"
            animate={true}
          />
        )}
      </div>
    </div>
  );
}
