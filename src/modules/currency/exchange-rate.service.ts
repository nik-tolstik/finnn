"use server";

import { Currency } from "@prisma/client";

import { getNBRBExchangeRates, getNBRBExchangeRatesByDate } from "@/modules/analytics/currency.service";
import { prisma } from "@/shared/lib/prisma";

const SUPPORTED_CURRENCIES: Currency[] = [Currency.USD, Currency.EUR, Currency.BYN];

async function saveExchangeRate(
  date: Date,
  fromCurrency: Currency,
  toCurrency: Currency,
  rate: number
) {
  return await prisma.exchangeRate.upsert({
    where: {
      date_fromCurrency_toCurrency: {
        date,
        fromCurrency,
        toCurrency,
      },
    },
    update: {
      rate,
    },
    create: {
      date,
      fromCurrency,
      toCurrency,
      rate,
    },
  });
}

export async function saveDailyExchangeRates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ratesResult = await getNBRBExchangeRates();
  
  if ("error" in ratesResult) {
    throw new Error(ratesResult.error);
  }

  const savedRates = [];
  const baseCurrency = Currency.BYN;
  const baseRates: Record<Currency, number> = {
    [Currency.BYN]: 1,
    [Currency.USD]: ratesResult.data[Currency.USD] || 0,
    [Currency.EUR]: ratesResult.data[Currency.EUR] || 0,
  };

  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === baseCurrency) {
      continue;
    }

    const rate = baseRates[currency];
    if (!rate) {
      console.warn(`Курс для ${currency} не найден`);
      continue;
    }

    const saved = await saveExchangeRate(today, currency, baseCurrency, rate);
    savedRates.push(saved);
  }

  return savedRates;
}

export async function getExchangeRate(
  date: Date,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<{ data: number } | { error: string }> {
  if (fromCurrency === toCurrency) {
    return { data: 1 };
  }

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const rate = await prisma.exchangeRate.findUnique({
    where: {
      date_fromCurrency_toCurrency: {
        date: targetDate,
        fromCurrency,
        toCurrency,
      },
    },
  });

  if (!rate) {
    const inverseRate = await prisma.exchangeRate.findUnique({
      where: {
        date_fromCurrency_toCurrency: {
          date: targetDate,
          fromCurrency: toCurrency,
          toCurrency: fromCurrency,
        },
      },
    });

    if (inverseRate) {
      return { data: 1 / inverseRate.rate };
    }

    const baseCurrency = Currency.BYN;

    if (fromCurrency !== baseCurrency && toCurrency !== baseCurrency) {
      const fromRate = await prisma.exchangeRate.findUnique({
        where: {
          date_fromCurrency_toCurrency: {
            date: targetDate,
            fromCurrency,
            toCurrency: baseCurrency,
          },
        },
      });

      const toRate = await prisma.exchangeRate.findUnique({
        where: {
          date_fromCurrency_toCurrency: {
            date: targetDate,
            fromCurrency: toCurrency,
            toCurrency: baseCurrency,
          },
        },
      });

      if (fromRate && toRate) {
        const crossRate = fromRate.rate / toRate.rate;
        console.warn(
          `[ExchangeRate] Курс ${fromCurrency}/${toCurrency} вычислен из базовых курсов: ${crossRate}`
        );
        return { data: crossRate };
      }
    }

    console.warn(
      `[ExchangeRate] Курс ${fromCurrency}/${toCurrency} на ${targetDate.toISOString()} не найден в БД, запрашиваем из API`
    );

    const ratesResult = await getNBRBExchangeRatesByDate(targetDate);

    if ("error" in ratesResult) {
      return { error: `Не удалось получить курс: ${ratesResult.error}` };
    }

    const baseRates: Record<Currency, number> = {
      [Currency.BYN]: 1,
      [Currency.USD]: ratesResult.data[Currency.USD] || 0,
      [Currency.EUR]: ratesResult.data[Currency.EUR] || 0,
    };

    if (!baseRates[fromCurrency] || !baseRates[toCurrency]) {
      return { error: `Курс для ${fromCurrency} или ${toCurrency} не найден в API` };
    }

    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency === baseCurrency || !baseRates[currency]) {
        continue;
      }

      await prisma.exchangeRate.upsert({
        where: {
          date_fromCurrency_toCurrency: {
            date: targetDate,
            fromCurrency: currency,
            toCurrency: baseCurrency,
          },
        },
        update: {
          rate: baseRates[currency],
        },
        create: {
          date: targetDate,
          fromCurrency: currency,
          toCurrency: baseCurrency,
          rate: baseRates[currency],
        },
      });

      console.warn(
        `[ExchangeRate] Курс ${currency}/${baseCurrency} на ${targetDate.toISOString()} сохранен в БД: ${baseRates[currency]}`
      );
    }

    let calculatedRate: number;

    if (fromCurrency === baseCurrency) {
      calculatedRate = 1 / baseRates[toCurrency];
    } else if (toCurrency === baseCurrency) {
      calculatedRate = baseRates[fromCurrency];
    } else {
      calculatedRate = baseRates[fromCurrency] / baseRates[toCurrency];
    }

    return { data: calculatedRate };
  }

  return { data: rate.rate };
}

export async function getTodayExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseCurrency = Currency.BYN;
  const rates: Record<string, number> = {};

  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === baseCurrency) {
      continue;
    }

    const result = await getExchangeRate(today, currency, baseCurrency);
    if ("error" in result) {
      console.warn(`[ExchangeRate] Ошибка получения курса ${currency}:`, result.error);
      continue;
    }
    rates[currency] = result.data;
  }

  if (Object.keys(rates).length === 0) {
    return { error: "Не удалось получить курсы валют" };
  }

  return { data: rates };
}

export async function getYesterdayExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const baseCurrency = Currency.BYN;
  const rates: Record<string, number> = {};

  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === baseCurrency) {
      continue;
    }

    const result = await getExchangeRate(yesterday, currency, baseCurrency);
    if ("error" in result) {
      console.warn(`[ExchangeRate] Ошибка получения вчерашнего курса ${currency}:`, result.error);
      continue;
    }
    rates[currency] = result.data;
  }

  if (Object.keys(rates).length === 0) {
    return { error: "Не удалось получить вчерашние курсы валют" };
  }

  return { data: rates };
}
