"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

import {
  getCategoryAnalytics,
  getTotalAmount,
  type CategoryAnalyticsFilters,
} from "@/modules/analytics/analytics.service";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { DatePicker } from "@/shared/ui/date-picker";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select/select";
import { type SelectOption } from "@/shared/ui/select/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatMoney } from "@/shared/utils/money";

type PeriodType = "week" | "month" | "6months" | "year" | "custom";

interface Period {
  type: PeriodType;
  label: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function AnalyticsContent({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [transactionType, setTransactionType] = useState<TransactionType.INCOME | TransactionType.EXPENSE>(
    TransactionType.EXPENSE
  );
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;

  const period = useMemo<Period>(() => {
    const now = new Date();
    const today = endOfDay(now);

    switch (periodType) {
      case "week":
        return {
          type: "week",
          label: "За последнюю неделю",
          dateFrom: startOfDay(subDays(now, 7)),
          dateTo: today,
        };
      case "month":
        return {
          type: "month",
          label: "За последний месяц",
          dateFrom: startOfDay(subMonths(now, 1)),
          dateTo: today,
        };
      case "6months":
        return {
          type: "6months",
          label: "За последние 6 месяцев",
          dateFrom: startOfDay(subMonths(now, 6)),
          dateTo: today,
        };
      case "year":
        return {
          type: "year",
          label: "За последний год",
          dateFrom: startOfDay(subMonths(now, 12)),
          dateTo: today,
        };
      case "custom":
        return {
          type: "custom",
          label: "Произвольный период",
          dateFrom: customDateFrom ? startOfDay(customDateFrom) : undefined,
          dateTo: customDateTo ? endOfDay(customDateTo) : undefined,
        };
      default:
        return {
          type: "month",
          label: "За последний месяц",
          dateFrom: startOfDay(subMonths(now, 1)),
          dateTo: today,
        };
    }
  }, [periodType, customDateFrom, customDateTo]);

  const filters: CategoryAnalyticsFilters = useMemo(
    () => ({
      type: transactionType,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    }),
    [transactionType, period.dateFrom, period.dateTo]
  );

  const dateFilters = useMemo(
    () => ({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    }),
    [period.dateFrom, period.dateTo]
  );

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["categoryAnalytics", workspaceId, filters],
    queryFn: () => getCategoryAnalytics(workspaceId, filters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const { data: totalIncomeData } = useQuery({
    queryKey: ["totalIncome", workspaceId, dateFilters],
    queryFn: () => getTotalAmount(workspaceId, TransactionType.INCOME, dateFilters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const { data: totalExpenseData } = useQuery({
    queryKey: ["totalExpense", workspaceId, dateFilters],
    queryFn: () => getTotalAmount(workspaceId, TransactionType.EXPENSE, dateFilters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const analytics = analyticsData && "data" in analyticsData ? analyticsData.data : [];
  const totalIncome = totalIncomeData && "data" in totalIncomeData ? totalIncomeData.data : "0";
  const totalExpense = totalExpenseData && "data" in totalExpenseData ? totalExpenseData.data : "0";

  const periodOptions: SelectOption<PeriodType>[] = useMemo(
    () => [
      { value: "week", label: "За последнюю неделю" },
      { value: "month", label: "За последний месяц" },
      { value: "6months", label: "За последние 6 месяцев" },
      { value: "year", label: "За последний год" },
      { value: "custom", label: "Произвольный период" },
    ],
    []
  );

  const handleViewDetails = (categoryId: string | null) => {
    const params = new URLSearchParams();
    params.set("workspaceId", workspaceId);

    if (categoryId) {
      params.set("categoryIds", categoryId);
    }

    if (period.dateFrom) {
      params.set("dateFrom", period.dateFrom.toISOString());
    }

    if (period.dateTo) {
      params.set("dateTo", period.dateTo.toISOString());
    }

    params.set("types", transactionType);

    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h1 className="text-2xl font-bold">Аналитика</h1>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Segmented
              options={[
                { value: TransactionType.EXPENSE, label: "Расходы" },
                { value: TransactionType.INCOME, label: "Доходы" },
              ]}
              value={transactionType}
              onChange={(value) => setTransactionType(value as TransactionType.INCOME | TransactionType.EXPENSE)}
            />

            <div className="flex-1" />

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select
                value={periodType}
                onChange={(value) => setPeriodType(value as PeriodType)}
                options={periodOptions}
                placeholder="Выберите период"
                multiple={false}
              />

              {periodType === "custom" && (
                <>
                  <DatePicker
                    date={customDateFrom}
                    onSelect={setCustomDateFrom}
                    placeholder="От"
                    className="w-full sm:w-[150px]"
                  />
                  <DatePicker
                    date={customDateTo}
                    onSelect={setCustomDateTo}
                    placeholder="До"
                    className="w-full sm:w-[150px]"
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Общий доход</div>
              <div className="text-2xl font-semibold text-success-primary">
                {formatMoney(totalIncome, baseCurrency)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Общий расход</div>
              <div className="text-2xl font-semibold text-error-primary">{formatMoney(totalExpense, baseCurrency)}</div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Категория</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Процент</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : analytics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                analytics.map((item) => (
                  <TableRow
                    key={item.categoryId || "no-category"}
                    onClick={() => handleViewDetails(item.categoryId)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.categoryColor && (
                          <div className="size-3 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                        )}
                        <span>{item.categoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(item.totalAmount, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
