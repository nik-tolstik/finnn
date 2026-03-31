"use server";

import { Currency } from "@prisma/client";

import { getNBRBExchangeRates, getNBRBExchangeRatesByDate } from "@/modules/currency/currency.service";
import { serverLogger } from "@/shared/lib/logger";
import { prisma } from "@/shared/lib/prisma";

const BASE_CURRENCY = Currency.BYN;
const NON_BASE_CURRENCIES = [Currency.USD, Currency.EUR] as const;

type BaseRates = {
  [Currency.BYN]: number;
  [Currency.USD]?: number;
  [Currency.EUR]?: number;
};

export interface ExchangeRateRequest {
  date: Date;
  fromCurrency: Currency;
  toCurrency: Currency;
}

const baseRatesRequests = new Map<string, Promise<BaseRates>>();

function normalizeDate(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setUTCHours(0, 0, 0, 0);
  return normalizedDate;
}

function getDateKey(date: Date) {
  return normalizeDate(date).toISOString().split("T")[0];
}

function getRequestKey(request: ExchangeRateRequest) {
  return `${getDateKey(request.date)}:${request.fromCurrency}:${request.toCurrency}`;
}

function toBaseRates(rates: Record<string, number>): BaseRates {
  return {
    [Currency.BYN]: 1,
    [Currency.USD]: rates[Currency.USD],
    [Currency.EUR]: rates[Currency.EUR],
  };
}

function hasCompleteBaseRates(baseRates: BaseRates) {
  return typeof baseRates[Currency.USD] === "number" && typeof baseRates[Currency.EUR] === "number";
}

function getRateFromBaseRates(baseRates: BaseRates, fromCurrency: Currency, toCurrency: Currency) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  if (fromCurrency === BASE_CURRENCY) {
    const toRate = baseRates[toCurrency];
    return typeof toRate === "number" ? 1 / toRate : undefined;
  }

  if (toCurrency === BASE_CURRENCY) {
    const fromRate = baseRates[fromCurrency];
    return typeof fromRate === "number" ? fromRate : undefined;
  }

  const fromRate = baseRates[fromCurrency];
  const toRate = baseRates[toCurrency];

  if (typeof fromRate !== "number" || typeof toRate !== "number") {
    return undefined;
  }

  return fromRate / toRate;
}

async function readBaseRates(dates: Date[]) {
  const normalizedDates = Array.from(new Map(dates.map((date) => [getDateKey(date), normalizeDate(date)])).values());

  if (normalizedDates.length === 0) {
    return new Map<string, BaseRates>();
  }

  const storedRates = await prisma.exchangeRate.findMany({
    where: {
      date: { in: normalizedDates },
      toCurrency: BASE_CURRENCY,
      fromCurrency: { in: [...NON_BASE_CURRENCIES] },
    },
    select: {
      date: true,
      fromCurrency: true,
      rate: true,
    },
  });

  const ratesByDate = new Map<string, BaseRates>(
    normalizedDates.map((date) => [getDateKey(date), { [Currency.BYN]: 1 }])
  );

  for (const storedRate of storedRates) {
    const dateKey = getDateKey(storedRate.date);
    const currentRates = ratesByDate.get(dateKey) ?? { [Currency.BYN]: 1 };
    currentRates[storedRate.fromCurrency] = storedRate.rate;
    ratesByDate.set(dateKey, currentRates);
  }

  return ratesByDate;
}

async function saveBaseRates(date: Date, baseRates: BaseRates) {
  const normalizedDate = normalizeDate(date);

  return Promise.all(
    NON_BASE_CURRENCIES.map(async (currency) => {
      const rate = baseRates[currency];

      if (typeof rate !== "number") {
        return null;
      }

      const savedRate = await prisma.exchangeRate.upsert({
        where: {
          date_fromCurrency_toCurrency: {
            date: normalizedDate,
            fromCurrency: currency,
            toCurrency: BASE_CURRENCY,
          },
        },
        update: { rate },
        create: {
          date: normalizedDate,
          fromCurrency: currency,
          toCurrency: BASE_CURRENCY,
          rate,
        },
      });

      serverLogger.warn(
        `[ExchangeRate] Rate ${currency}/${BASE_CURRENCY} on ${normalizedDate.toISOString()} saved to DB: ${rate}`
      );

      return savedRate;
    })
  );
}

async function loadBaseRates(date: Date) {
  const normalizedDate = normalizeDate(date);
  const dateKey = getDateKey(normalizedDate);
  const existingRequest = baseRatesRequests.get(dateKey);

  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const storedRates = await readBaseRates([normalizedDate]);
    const baseRates = storedRates.get(dateKey);

    if (baseRates && hasCompleteBaseRates(baseRates)) {
      return baseRates;
    }

    serverLogger.warn(`[ExchangeRate] Rates on ${normalizedDate.toISOString()} not found in DB, requesting from API`);

    const apiResult = await getNBRBExchangeRatesByDate(normalizedDate);
    if ("error" in apiResult) {
      throw new Error(`Не удалось получить курс: ${apiResult.error}`);
    }

    const fetchedBaseRates = toBaseRates(apiResult.data);

    if (!hasCompleteBaseRates(fetchedBaseRates)) {
      throw new Error(`Курсы USD/EUR на ${dateKey} не найдены`);
    }

    await saveBaseRates(normalizedDate, fetchedBaseRates);
    return fetchedBaseRates;
  })().finally(() => {
    baseRatesRequests.delete(dateKey);
  });

  baseRatesRequests.set(dateKey, request);
  return request;
}

function buildRatesResponse(date: Date, rates: Map<string, number>) {
  return Object.fromEntries(
    NON_BASE_CURRENCIES.flatMap((currency) => {
      const rate = rates.get(
        getRequestKey({
          date,
          fromCurrency: currency,
          toCurrency: BASE_CURRENCY,
        })
      );

      return typeof rate === "number" ? [[currency, rate]] : [];
    })
  );
}

export async function preloadExchangeRates(requests: ExchangeRateRequest[]) {
  const uniqueRequests = Array.from(
    new Map(
      requests.map((request) => {
        const normalizedRequest = {
          ...request,
          date: normalizeDate(request.date),
        };

        return [getRequestKey(normalizedRequest), normalizedRequest];
      })
    ).values()
  );

  const rates = new Map<string, number>();
  const baseRatesByDate = await readBaseRates(uniqueRequests.map((request) => request.date));
  const missingDates = new Map<string, Date>();

  for (const request of uniqueRequests) {
    const requestKey = getRequestKey(request);
    const baseRates = baseRatesByDate.get(getDateKey(request.date));
    const rate = baseRates ? getRateFromBaseRates(baseRates, request.fromCurrency, request.toCurrency) : undefined;

    if (typeof rate === "number") {
      rates.set(requestKey, rate);
      continue;
    }

    missingDates.set(getDateKey(request.date), request.date);
  }

  for (const date of missingDates.values()) {
    baseRatesByDate.set(getDateKey(date), await loadBaseRates(date));
  }

  for (const request of uniqueRequests) {
    const requestKey = getRequestKey(request);

    if (rates.has(requestKey)) {
      continue;
    }

    const baseRates = baseRatesByDate.get(getDateKey(request.date));
    const rate = baseRates ? getRateFromBaseRates(baseRates, request.fromCurrency, request.toCurrency) : undefined;

    if (typeof rate !== "number") {
      throw new Error(
        `Курс для ${request.fromCurrency}/${request.toCurrency} на ${getDateKey(request.date)} не найден`
      );
    }

    rates.set(requestKey, rate);
  }

  return rates;
}

export async function saveDailyExchangeRates() {
  const today = normalizeDate(new Date());
  const apiResult = await getNBRBExchangeRates();

  if ("error" in apiResult) {
    throw new Error(apiResult.error);
  }

  const baseRates = toBaseRates(apiResult.data);
  if (!hasCompleteBaseRates(baseRates)) {
    throw new Error(`Курсы USD/EUR на ${getDateKey(today)} не найдены`);
  }

  return saveBaseRates(today, baseRates);
}

export async function getExchangeRate(
  date: Date,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<{ data: number } | { error: string }> {
  if (fromCurrency === toCurrency) {
    return { data: 1 };
  }

  try {
    const request = {
      date,
      fromCurrency,
      toCurrency,
    };
    const rates = await preloadExchangeRates([request]);
    const rate = rates.get(getRequestKey(request));

    if (typeof rate !== "number") {
      return { error: `Курс для ${fromCurrency}/${toCurrency} на ${getDateKey(date)} не найден` };
    }

    return { data: rate };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить курс" };
  }
}

async function getCurrencyRatesForDate(date: Date) {
  const rates = await preloadExchangeRates(
    NON_BASE_CURRENCIES.map((currency) => ({
      date,
      fromCurrency: currency,
      toCurrency: BASE_CURRENCY,
    }))
  );

  const response = buildRatesResponse(date, rates);

  if (Object.keys(response).length === 0) {
    throw new Error("Не удалось получить курсы валют");
  }

  return response;
}

export async function getTodayExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const today = normalizeDate(new Date());

  try {
    return { data: await getCurrencyRatesForDate(today) };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить курсы валют" };
  }
}

export async function getYesterdayExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const yesterday = normalizeDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  try {
    return { data: await getCurrencyRatesForDate(yesterday) };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить вчерашние курсы валют" };
  }
}
