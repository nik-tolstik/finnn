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

  let rate = await prisma.exchangeRate.findUnique({
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

    console.log(
      `[ExchangeRate] Курс ${fromCurrency}/${toCurrency} на ${targetDate.toISOString()} не найден в БД, запрашиваем из API`
    );

    const ratesResult = await getNBRBExchangeRatesByDate(targetDate);

    if ("error" in ratesResult) {
      return { error: `Не удалось получить курс: ${ratesResult.error}` };
    }

    const baseCurrency = Currency.BYN;
    const baseRates: Record<Currency, number> = {
      [Currency.BYN]: 1,
      [Currency.USD]: ratesResult.data[Currency.USD] || 0,
      [Currency.EUR]: ratesResult.data[Currency.EUR] || 0,
    };

    if (!baseRates[fromCurrency] || !baseRates[toCurrency]) {
      return { error: `Курс для ${fromCurrency} или ${toCurrency} не найден в API` };
    }

    let calculatedRate: number;

    if (fromCurrency === baseCurrency) {
      calculatedRate = 1 / baseRates[toCurrency];
    } else if (toCurrency === baseCurrency) {
      calculatedRate = baseRates[fromCurrency];
    } else {
      calculatedRate = baseRates[fromCurrency] / baseRates[toCurrency];
    }

    if (toCurrency === baseCurrency && fromCurrency !== baseCurrency) {
      rate = await prisma.exchangeRate.create({
        data: {
          date: targetDate,
          fromCurrency,
          toCurrency,
          rate: calculatedRate,
        },
      });

      console.log(
        `[ExchangeRate] Курс ${fromCurrency}/${toCurrency} на ${targetDate.toISOString()} сохранен в БД: ${calculatedRate}`
      );
      return { data: rate.rate };
    } else {
      return { data: calculatedRate };
    }
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
