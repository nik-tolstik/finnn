import Big from "big.js";
import { addDays, differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";

import type { TransactionViewFilters } from "@/modules/transactions/components/transactions-filters";
import { toDateString } from "@/modules/transactions/components/transactions-filters/utils/date";

import type { AnalyticsDateRange } from "./analytics.types";

export const ANALYTICS_DEFAULT_DAY_COUNT = 30;

function normalizeRange(start: Date, end: Date) {
  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return { start: startOfDay(end), end: endOfDay(start) };
}

export function resolveAnalyticsDateRange(
  filters: Pick<TransactionViewFilters, "dateFrom" | "dateTo">,
  referenceDate = new Date()
): AnalyticsDateRange {
  const referenceEnd = endOfDay(referenceDate);
  const explicitStart = filters.dateFrom ? startOfDay(new Date(`${filters.dateFrom}T00:00:00`)) : null;
  const explicitEnd = filters.dateTo ? endOfDay(new Date(`${filters.dateTo}T00:00:00`)) : null;

  let start: Date;
  let end: Date;
  let isImplicit = false;

  if (explicitStart && explicitEnd) {
    start = explicitStart;
    end = explicitEnd;
  } else if (explicitStart) {
    start = explicitStart;
    end = referenceEnd;
  } else if (explicitEnd) {
    end = explicitEnd;
    start = startOfDay(subDays(end, ANALYTICS_DEFAULT_DAY_COUNT - 1));
  } else {
    end = referenceEnd;
    start = startOfDay(subDays(end, ANALYTICS_DEFAULT_DAY_COUNT - 1));
    isImplicit = true;
  }

  const normalized = normalizeRange(start, end);
  const dayCount = differenceInCalendarDays(normalized.end, normalized.start) + 1;

  return {
    start: normalized.start,
    end: normalized.end,
    startDate: toDateString(normalized.start) ?? toDateString(referenceDate) ?? "",
    endDate: toDateString(normalized.end) ?? toDateString(referenceDate) ?? "",
    dayCount,
    isImplicit,
  };
}

export function resolvePreviousAnalyticsDateRange(range: AnalyticsDateRange): AnalyticsDateRange {
  const previousEnd = endOfDay(subDays(range.start, 1));
  const previousStart = startOfDay(subDays(previousEnd, range.dayCount - 1));

  return {
    start: previousStart,
    end: previousEnd,
    startDate: toDateString(previousStart) ?? "",
    endDate: toDateString(previousEnd) ?? "",
    dayCount: range.dayCount,
    isImplicit: false,
  };
}

export function applyAnalyticsDateRangeToFilters(
  filters: TransactionViewFilters,
  range: AnalyticsDateRange
): TransactionViewFilters {
  return {
    ...filters,
    dateFrom: range.startDate,
    dateTo: range.endDate,
  };
}

export function getPreviousPeriodPercentageChange(current: string, previous: string): number | null {
  if (new Big(previous).eq(0)) {
    return new Big(current).eq(0) ? 0 : null;
  }

  return Number(new Big(current).minus(previous).div(previous).times(100).toFixed(1));
}

export function buildInclusiveDateRangeDates(range: AnalyticsDateRange) {
  return Array.from({ length: range.dayCount }, (_, index) => startOfDay(addDays(range.start, index)));
}
