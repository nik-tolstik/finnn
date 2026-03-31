import type { Currency } from "@prisma/client";
import Big from "big.js";
import { endOfDay, format, startOfDay, subDays } from "date-fns";

import {
  type ExchangeRateRequest,
  getExchangeRate,
  preloadExchangeRates,
} from "@/modules/currency/exchange-rate.service";
import { multiplyMoney } from "@/shared/utils/money";

import type { DateRangeInput } from "./assistant-tool.schemas";
import type { MoneyBucket, ResolvedDateRange } from "./assistant-tool.types";

export function parseDateInput(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Некорректная дата: ${value}`);
  }

  return parsed;
}

export function resolveDateRange(input: DateRangeInput): ResolvedDateRange {
  const today = startOfDay(new Date());
  const fallbackDays = input.days ?? 30;

  if (input.dateFrom || input.dateTo) {
    const resolvedEnd = input.dateTo ? endOfDay(parseDateInput(input.dateTo)) : endOfDay(today);
    const resolvedStart = input.dateFrom
      ? startOfDay(parseDateInput(input.dateFrom))
      : startOfDay(subDays(resolvedEnd, fallbackDays - 1));

    if (resolvedStart.getTime() > resolvedEnd.getTime()) {
      throw new Error("Начало периода не может быть позже конца периода");
    }

    return {
      start: resolvedStart,
      end: resolvedEnd,
      label: `${format(resolvedStart, "dd.MM.yyyy")} - ${format(resolvedEnd, "dd.MM.yyyy")}`,
    };
  }

  return {
    start: startOfDay(subDays(today, fallbackDays - 1)),
    end: endOfDay(today),
    label: `Последние ${fallbackDays} дн.`,
  };
}

export function resolvePreviousDateRange(range: ResolvedDateRange): ResolvedDateRange {
  const diffInMs = endOfDay(range.end).getTime() - startOfDay(range.start).getTime();
  const previousEnd = endOfDay(subDays(range.start, 1));
  const previousStart = startOfDay(new Date(previousEnd.getTime() - diffInMs));

  return {
    start: previousStart,
    end: previousEnd,
    label: `${format(previousStart, "dd.MM.yyyy")} - ${format(previousEnd, "dd.MM.yyyy")}`,
  };
}

export function normalizeLimit(limit: number | undefined, fallback: number, max: number) {
  if (!limit) {
    return fallback;
  }

  return Math.min(Math.max(limit, 1), max);
}

export function percentageChange(currentValue: string, previousValue: string) {
  const previous = new Big(previousValue || "0");
  const current = new Big(currentValue || "0");

  if (previous.eq(0)) {
    return current.eq(0) ? 0 : null;
  }

  return Number(current.minus(previous).div(previous).times(100).toFixed(2));
}

function getExchangeRateResolverKey(date: Date, fromCurrency: string, toCurrency: string) {
  const normalizedDate = new Date(date);
  normalizedDate.setUTCHours(0, 0, 0, 0);

  return `${normalizedDate.toISOString().split("T")[0]}:${fromCurrency}:${toCurrency}`;
}

type ExchangeRateResolverPreloadRequest = {
  date: Date;
  fromCurrency: string;
  toCurrency: string;
};

export type ExchangeRateResolver = ((date: Date, fromCurrency: string, toCurrency: string) => Promise<number>) & {
  preload: (requests: ExchangeRateResolverPreloadRequest[]) => Promise<void>;
};

export function createExchangeRateResolver(): ExchangeRateResolver {
  const cache = new Map<string, number>();
  const resolve = (async (date: Date, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const key = getExchangeRateResolverKey(date, fromCurrency, toCurrency);
    const cachedValue = cache.get(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const result = await getExchangeRate(date, fromCurrency as Currency, toCurrency as Currency);

    if ("error" in result) {
      throw new Error(result.error);
    }

    cache.set(key, result.data);
    return result.data;
  }) as ExchangeRateResolver;

  resolve.preload = async (requests: ExchangeRateResolverPreloadRequest[]) => {
    const filteredRequests = requests.filter((request) => request.fromCurrency !== request.toCurrency);

    if (filteredRequests.length === 0) {
      return;
    }

    const preloadedRates = await preloadExchangeRates(
      filteredRequests.map(
        (request): ExchangeRateRequest => ({
          date: request.date,
          fromCurrency: request.fromCurrency as Currency,
          toCurrency: request.toCurrency as Currency,
        })
      )
    );

    for (const request of filteredRequests) {
      const key = getExchangeRateResolverKey(request.date, request.fromCurrency, request.toCurrency);
      const rate = preloadedRates.get(key);

      if (rate !== undefined) {
        cache.set(key, rate);
      }
    }
  };

  return resolve;
}

export async function convertToBaseCurrency(
  amount: string,
  fromCurrency: string,
  baseCurrency: string,
  date: Date,
  resolveRate: ExchangeRateResolver
) {
  const rate = await resolveRate(date, fromCurrency, baseCurrency);
  return multiplyMoney(amount, rate);
}

export function sortBucketsDesc<T extends MoneyBucket>(items: T[]) {
  return [...items].sort((left, right) => new Big(right.converted).cmp(left.converted));
}
