import Big from "big.js";
import { addDays, endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

import type { TransactionViewFilters } from "@/modules/transactions/components/transactions-filters";
import { toDateString } from "@/modules/transactions/components/transactions-filters/utils/date";
import { formatMoney } from "@/shared/utils/money";

import type { AnalyticsCalendarResult, AnalyticsOverviewResult } from "./analytics.types";

export type AnalyticsTone = "positive" | "negative" | "neutral";
export type AnalyticsPeriodPreset = "7d" | "30d" | "90d" | "thisMonth" | "previousMonth";

export const ANALYTICS_PERIOD_PRESETS: Array<{ value: AnalyticsPeriodPreset; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "thisMonth", label: "Этот месяц" },
  { value: "previousMonth", label: "Прошлый месяц" },
];

export interface AnalyticsPeriodRange {
  dateFrom: string;
  dateTo: string;
}

export interface AnalyticsTimeSeriesViewPoint {
  date: string;
  income: number;
  expense: number;
  cumulativeNetFlow: number;
}

export interface AnalyticsCapitalTimeSeriesViewPoint {
  date: string;
  total: number;
  totalLabel: string;
}

export interface AnalyticsCategoryViewRow {
  id: string;
  name: string;
  total: string;
  totalLabel: string;
  transactionCount: number;
  sharePercent: number;
  barWidthPercent: number;
}

export interface AnalyticsDebtViewRow {
  personName: string;
  lent: number;
  borrowed: number;
  netExposure: string;
  netExposureLabel: string;
  netExposureTone: AnalyticsTone;
  debtCount: number;
}

export interface AnalyticsCalendarCell {
  date: string | null;
  dayNumber: number | null;
  incomeTotal: string;
  incomeLabel: string;
  expenseTotal: string;
  expenseLabel: string;
  hasActivity: boolean;
  netTotal: string;
  netLabel: string;
  transactionCount: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

export interface AnalyticsOverviewViewModel {
  savingRatePercent: number | null;
  savingRateLabel: string;
  savingRateTone: AnalyticsTone;
  averageIncomePerDayLabel: string;
  averageExpensePerDayLabel: string;
  incomeTone: AnalyticsTone;
  expenseTone: AnalyticsTone;
  netFlowTone: AnalyticsTone;
  incomeDeltaLabel: string;
  expenseDeltaLabel: string;
  netFlowDeltaLabel: string;
  topExpenseCategory: AnalyticsCategoryViewRow | null;
  timeSeries: AnalyticsTimeSeriesViewPoint[];
  capitalTimeSeries: AnalyticsCapitalTimeSeriesViewPoint[];
  incomeCategoryRows: AnalyticsCategoryViewRow[];
  categoryRows: AnalyticsCategoryViewRow[];
  debtRows: AnalyticsDebtViewRow[];
}

function toBig(value: string | number | null | undefined) {
  return new Big(value ?? 0);
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function getAnalyticsTrendTone(
  percentageChange: number | null,
  favorableDirection: "up" | "down" = "up"
): AnalyticsTone {
  if (percentageChange === null || percentageChange === 0) {
    return "neutral";
  }

  if (favorableDirection === "up") {
    return percentageChange > 0 ? "positive" : "negative";
  }

  return percentageChange < 0 ? "positive" : "negative";
}

export function formatAnalyticsDelta(percentageChange: number | null) {
  if (percentageChange === null) {
    return "Нет базы";
  }

  if (percentageChange === 0) {
    return "Без изменений";
  }

  return `${formatSignedPercent(percentageChange)} к прошлому периоду`;
}

export function getAnalyticsPeriodPresetRange(
  preset: AnalyticsPeriodPreset,
  referenceDate = new Date()
): AnalyticsPeriodRange {
  const today = startOfDay(referenceDate);

  if (preset === "thisMonth") {
    return {
      dateFrom: toDateString(startOfMonth(today)) ?? "",
      dateTo: toDateString(today) ?? "",
    };
  }

  if (preset === "previousMonth") {
    const previousMonth = subMonths(today, 1);

    return {
      dateFrom: toDateString(startOfMonth(previousMonth)) ?? "",
      dateTo: toDateString(endOfMonth(previousMonth)) ?? "",
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;

  return {
    dateFrom: toDateString(subDays(today, days - 1)) ?? "",
    dateTo: toDateString(today) ?? "",
  };
}

export function applyAnalyticsPeriodPreset(
  filters: TransactionViewFilters,
  preset: AnalyticsPeriodPreset,
  referenceDate = new Date()
): TransactionViewFilters {
  return {
    ...filters,
    ...getAnalyticsPeriodPresetRange(preset, referenceDate),
  };
}

export function getAnalyticsCalendarMonthRange(monthDate: Date): AnalyticsPeriodRange {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  return {
    dateFrom: toDateString(monthStart) ?? "",
    dateTo: toDateString(monthEnd) ?? "",
  };
}

export function getAnalyticsCalendarMonthKey(monthDate: Date) {
  return toDateString(startOfMonth(monthDate)) ?? "";
}

export function getActiveAnalyticsPeriodPreset(
  range: AnalyticsPeriodRange,
  referenceDate = new Date()
): AnalyticsPeriodPreset | null {
  const preset = ANALYTICS_PERIOD_PRESETS.find((option) => {
    const presetRange = getAnalyticsPeriodPresetRange(option.value, referenceDate);
    return presetRange.dateFrom === range.dateFrom && presetRange.dateTo === range.dateTo;
  });

  return preset?.value ?? null;
}

export function buildAnalyticsCalendarCells({
  calendar,
  monthDate,
  selectedDate,
  today = new Date(),
}: {
  calendar: AnalyticsCalendarResult;
  monthDate: Date;
  selectedDate?: string | null;
  today?: Date | null;
}): AnalyticsCalendarCell[] {
  const monthStart = startOfMonth(monthDate);
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = subDays(monthStart, firstWeekday);
  const gridDayCount = 42;
  const daysByDate = new Map(calendar.calendarDays.map((day) => [day.date, day]));
  const todayString = today ? toDateString(today) : null;

  return Array.from({ length: gridDayCount }, (_value, index) => {
    const date = addDays(gridStart, index);
    const dateString = toDateString(date) ?? "";
    const isCurrentMonth = date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear();
    const day = daysByDate.get(dateString) ?? {
      date: dateString,
      incomeTotalInBaseCurrency: "0",
      expenseTotalInBaseCurrency: "0",
      netTotalInBaseCurrency: "0",
      transactionCount: 0,
    };
    const incomeAmount = toBig(day.incomeTotalInBaseCurrency);
    const expenseAmount = toBig(day.expenseTotalInBaseCurrency);
    const activityAmount = incomeAmount.abs().plus(expenseAmount.abs());

    return {
      date: dateString,
      dayNumber: date.getDate(),
      incomeTotal: day.incomeTotalInBaseCurrency,
      incomeLabel: formatMoney(day.incomeTotalInBaseCurrency, calendar.baseCurrency),
      expenseTotal: day.expenseTotalInBaseCurrency,
      expenseLabel: formatMoney(day.expenseTotalInBaseCurrency, calendar.baseCurrency),
      hasActivity: day.transactionCount > 0 || !activityAmount.eq(0),
      netTotal: day.netTotalInBaseCurrency,
      netLabel: formatMoney(day.netTotalInBaseCurrency, calendar.baseCurrency),
      transactionCount: day.transactionCount,
      isCurrentMonth,
      isSelected: selectedDate === dateString,
      isToday: todayString === dateString,
    };
  });
}

export function selectAnalyticsCapitalTicks(
  points: Pick<AnalyticsCapitalTimeSeriesViewPoint, "date">[],
  maxTicks: number
) {
  if (points.length === 0) {
    return [];
  }

  const normalizedMaxTicks = Math.max(2, Math.floor(maxTicks));

  if (points.length <= normalizedMaxTicks) {
    return points.map((point) => point.date);
  }

  const lastIndex = points.length - 1;
  const middleTickCount = normalizedMaxTicks - 2;
  const indexes = new Set([0, lastIndex]);

  for (let index = 1; index <= middleTickCount; index += 1) {
    indexes.add(Math.round((index * lastIndex) / (middleTickCount + 1)));
  }

  return Array.from(indexes)
    .sort((left, right) => left - right)
    .map((index) => points[index].date);
}

export function buildAnalyticsOverviewViewModel(analytics: AnalyticsOverviewResult): AnalyticsOverviewViewModel {
  const dayCount = Math.max(analytics.effectiveRange.dayCount, 1);
  const incomeTotal = toBig(analytics.summary.income.totalInBaseCurrency);
  const expenseTotal = toBig(analytics.summary.expense.totalInBaseCurrency);
  const netFlowTotal = toBig(analytics.summary.netFlow.totalInBaseCurrency);
  const savingRatePercent = incomeTotal.eq(0) ? null : Number(netFlowTotal.div(incomeTotal).times(100).toFixed(1));
  let cumulativeNetFlow = new Big(0);

  const incomeCategoryRows = analytics.incomeCategories.map((category) => ({
    id: category.id,
    name: category.name,
    total: category.totalInBaseCurrency,
    totalLabel: formatMoney(category.totalInBaseCurrency, analytics.baseCurrency),
    transactionCount: category.transactionCount,
    sharePercent: category.sharePercent,
    barWidthPercent: Math.max(4, Math.min(100, category.sharePercent)),
  }));

  const categoryRows = analytics.expenseCategories.map((category) => ({
    id: category.id,
    name: category.name,
    total: category.totalInBaseCurrency,
    totalLabel: formatMoney(category.totalInBaseCurrency, analytics.baseCurrency),
    transactionCount: category.transactionCount,
    sharePercent: category.sharePercent,
    barWidthPercent: Math.max(4, Math.min(100, category.sharePercent)),
  }));

  return {
    savingRatePercent,
    savingRateLabel: savingRatePercent === null ? "Нет доходов" : formatSignedPercent(savingRatePercent),
    savingRateTone:
      savingRatePercent === null || savingRatePercent === 0
        ? "neutral"
        : savingRatePercent > 0
          ? "positive"
          : "negative",
    averageIncomePerDayLabel: formatMoney(incomeTotal.div(dayCount).toString(), analytics.baseCurrency),
    averageExpensePerDayLabel: formatMoney(expenseTotal.div(dayCount).toString(), analytics.baseCurrency),
    incomeTone: getAnalyticsTrendTone(analytics.summary.income.percentageChange, "up"),
    expenseTone: getAnalyticsTrendTone(analytics.summary.expense.percentageChange, "down"),
    netFlowTone: getAnalyticsTrendTone(analytics.summary.netFlow.percentageChange, "up"),
    incomeDeltaLabel: formatAnalyticsDelta(analytics.summary.income.percentageChange),
    expenseDeltaLabel: formatAnalyticsDelta(analytics.summary.expense.percentageChange),
    netFlowDeltaLabel: formatAnalyticsDelta(analytics.summary.netFlow.percentageChange),
    topExpenseCategory: categoryRows[0] ?? null,
    timeSeries: analytics.timeSeries.map((point) => {
      const income = toBig(point.incomeTotalInBaseCurrency);
      const expense = toBig(point.expenseTotalInBaseCurrency);
      cumulativeNetFlow = cumulativeNetFlow.plus(income).minus(expense);

      return {
        date: point.date,
        income: toNumber(point.incomeTotalInBaseCurrency),
        expense: toNumber(point.expenseTotalInBaseCurrency),
        cumulativeNetFlow: Number(cumulativeNetFlow.toString()),
      };
    }),
    capitalTimeSeries: analytics.capitalTimeSeries.map((point) => ({
      date: point.date,
      total: toNumber(point.totalInBaseCurrency),
      totalLabel: formatMoney(point.totalInBaseCurrency, analytics.baseCurrency),
    })),
    incomeCategoryRows,
    categoryRows,
    debtRows: analytics.debtsByPerson.map((debt) => {
      const netExposure = toBig(debt.netExposureInBaseCurrency);

      return {
        personName: debt.personName,
        lent: toNumber(debt.lentTotalInBaseCurrency),
        borrowed: toNumber(debt.borrowedTotalInBaseCurrency),
        netExposure: debt.netExposureInBaseCurrency,
        netExposureLabel: formatMoney(debt.netExposureInBaseCurrency, analytics.baseCurrency),
        netExposureTone: netExposure.eq(0) ? "neutral" : netExposure.gt(0) ? "positive" : "negative",
        debtCount: debt.debtCount,
      };
    }),
  };
}
