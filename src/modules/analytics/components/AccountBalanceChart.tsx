"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { BalanceHistoryPoint } from "../types";
import { formatMoney } from "@/shared/utils/money";

interface AccountBalanceChartProps {
  data: BalanceHistoryPoint[];
  currency?: string;
  period?: "day" | "week" | "month" | "year";
}

export function AccountBalanceChart({
  data,
  currency = "USD",
  period = "month",
}: AccountBalanceChartProps) {
  const formatDate = (date: Date) => {
    const d = new Date(date);
    switch (period) {
      case "day":
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      case "week":
        return d.toLocaleDateString("en-US", { weekday: "short" });
      case "month":
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      case "year":
        return d.toLocaleDateString("en-US", { month: "short" });
      default:
        return d.toLocaleDateString("en-US");
    }
  };

  const chartData = data.map((point) => ({
    date: formatDate(point.date),
    balance: Number(point.balance),
    fullDate: point.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis
          tickFormatter={(value) => formatMoney(value, currency).replace(/\s/g, "")}
        />
        <Tooltip
          formatter={(value: number | undefined) =>
            value !== undefined ? formatMoney(value, currency) : ""
          }
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              const fullDate = (payload[0].payload as any).fullDate;
              return new Date(fullDate).toLocaleString("en-US");
            }
            return label;
          }}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

