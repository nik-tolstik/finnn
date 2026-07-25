import { Inject, Injectable, Logger } from "@nestjs/common";
import { Currency } from "@prisma/client";

import { PrismaService } from "@/prisma/prisma.service";

import { getExchangeRateDateKey, normalizeExchangeRateDate } from "./exchange-rate-date";

const BASE_CURRENCY = Currency.BYN;
const NON_BASE_CURRENCIES = [Currency.USD, Currency.EUR, Currency.RUB] as const;
const NON_BASE_CURRENCY_LABELS = NON_BASE_CURRENCIES.join("/");
const NBRB_RATES_URL = "https://api.nbrb.by/exrates/rates";
const NBRB_LATEST_TIMEOUT_MS = 5000;
const NBRB_BY_DATE_TIMEOUT_MS = 3000;
const EXCHANGE_RATE_API_TIMEOUT_MS = 5000;
const NBRB_COOLDOWN_MS = 5 * 60 * 1000;
const EXCHANGE_RATE_API_CACHE_TTL_MS = 60 * 60 * 1000;
interface NBRBRate {
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_OfficialRate: number;
}

interface ExchangeRateAPIResponse {
  base?: string;
  date?: string;
  rates?: Record<string, unknown>;
}

type CurrencyRatesResult = { data: Record<string, number> } | { error: string };
type NonBaseCurrency = (typeof NON_BASE_CURRENCIES)[number];
type BaseRates = {
  [Currency.BYN]: number;
} & Partial<Record<NonBaseCurrency, number>>;

function isValidExchangeRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

export interface ExchangeRateRequest {
  date: Date;
  fromCurrency: Currency;
  toCurrency: Currency;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private nbrbUnavailableUntil = 0;
  private fallbackRatesCache: { dateKey: string; expiresAt: number; value: Record<string, number> } | null = null;
  private readonly fallbackRatesRequests = new Map<string, Promise<CurrencyRatesResult>>();
  private readonly ratesByDateRequests = new Map<string, Promise<CurrencyRatesResult>>();
  private readonly baseRatesRequests = new Map<string, Promise<BaseRates>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private normalizeDate(date: Date) {
    return normalizeExchangeRateDate(date);
  }

  private getDateKey(date: Date) {
    return getExchangeRateDateKey(date);
  }

  getRequestKey(request: ExchangeRateRequest) {
    return `${this.getDateKey(request.date)}:${request.fromCurrency}:${request.toCurrency}`;
  }

  private mapNBRBRates(rates: NBRBRate[]) {
    const mappedRates: Record<string, number> = {
      BYN: 1,
    };

    for (const rate of rates) {
      const normalizedRate = rate.Cur_OfficialRate / rate.Cur_Scale;

      if (isValidExchangeRate(normalizedRate)) {
        mappedRates[rate.Cur_Abbreviation] = normalizedRate;
      }
    }

    return mappedRates;
  }

  private isNBRBUnavailable() {
    return Date.now() < this.nbrbUnavailableUntil;
  }

  private markNBRBUnavailable(reason: string) {
    this.nbrbUnavailableUntil = Date.now() + NBRB_COOLDOWN_MS;
    this.logger.warn(`NBRB circuit opened: ${reason}`);
  }

  private clearNBRBUnavailable() {
    this.nbrbUnavailableUntil = 0;
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
  }

  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private async fetchWithTimeout(url: string, timeoutMs: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async requestNBRBRates(url: string, timeoutMs: number): Promise<CurrencyRatesResult> {
    if (this.isNBRBUnavailable()) {
      return { error: "NBRB temporarily unavailable" };
    }

    try {
      const response = await this.fetchWithTimeout(url, timeoutMs);

      if (!response.ok) {
        const error = `NBRB API error: ${response.status}`;
        this.markNBRBUnavailable(error);
        return { error };
      }

      const rates = (await response.json()) as NBRBRate[];
      this.clearNBRBUnavailable();
      return { data: this.mapNBRBRates(rates) };
    } catch (error: unknown) {
      const message = this.isAbortError(error) ? "NBRB timeout" : this.getErrorMessage(error, "NBRB error");
      this.markNBRBUnavailable(message);
      return { error: message };
    }
  }

  private async getExchangeRateAPIRates(expectedDateKey: string): Promise<CurrencyRatesResult> {
    if (this.fallbackRatesCache?.dateKey === expectedDateKey && this.fallbackRatesCache.expiresAt > Date.now()) {
      return { data: this.fallbackRatesCache.value };
    }

    const existingRequest = this.fallbackRatesRequests.get(expectedDateKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      try {
        const response = await this.fetchWithTimeout(
          "https://api.exchangerate-api.com/v4/latest/BYN",
          EXCHANGE_RATE_API_TIMEOUT_MS
        );

        if (!response.ok) {
          return { error: `ExchangeRate-API error: ${response.status}` };
        }

        const data = (await response.json()) as ExchangeRateAPIResponse;
        if (data.base !== BASE_CURRENCY || data.date !== expectedDateKey || !data.rates) {
          return { error: `ExchangeRate-API returned rates for an unexpected date or base currency` };
        }

        const rates: Record<string, number> = { BYN: 1 };

        for (const currency of NON_BASE_CURRENCIES) {
          const rate = data.rates[currency];
          if (!isValidExchangeRate(rate)) {
            return { error: `ExchangeRate-API did not return a valid ${currency} rate` };
          }

          rates[currency] = 1 / rate;
        }

        this.fallbackRatesCache = {
          dateKey: expectedDateKey,
          expiresAt: Date.now() + EXCHANGE_RATE_API_CACHE_TTL_MS,
          value: rates,
        };

        return { data: rates };
      } catch (error: unknown) {
        return {
          error: this.isAbortError(error)
            ? "ExchangeRate-API timeout"
            : this.getErrorMessage(error, "ExchangeRate-API error"),
        };
      } finally {
        this.fallbackRatesRequests.delete(expectedDateKey);
      }
    })();

    this.fallbackRatesRequests.set(expectedDateKey, request);
    return request;
  }

  private async getRatesWithFallback(
    nbrbResultPromise: Promise<CurrencyRatesResult>,
    warningMessage: string,
    expectedDateKey: string
  ) {
    const nbrbResult = await nbrbResultPromise;

    if (!("error" in nbrbResult)) {
      return nbrbResult;
    }

    this.logger.warn(`${warningMessage} ${nbrbResult.error}`);

    const fallbackResult = await this.getExchangeRateAPIRates(expectedDateKey);
    if (!("error" in fallbackResult)) {
      return fallbackResult;
    }

    return nbrbResult;
  }

  private async getNBRBExchangeRatesByDate(date: Date): Promise<CurrencyRatesResult> {
    const dateKey = this.getDateKey(date);
    const existingRequest = this.ratesByDateRequests.get(dateKey);

    if (existingRequest) {
      return existingRequest;
    }

    const url = `${NBRB_RATES_URL}?periodicity=0&ondate=${dateKey}`;
    const nbrbRequest = this.requestNBRBRates(url, NBRB_BY_DATE_TIMEOUT_MS);
    const ratesRequest =
      dateKey === this.getDateKey(new Date())
        ? this.getRatesWithFallback(nbrbRequest, "NBRB unavailable for today, using ExchangeRate-API:", dateKey)
        : nbrbRequest;
    const request = ratesRequest.finally(() => {
      this.ratesByDateRequests.delete(dateKey);
    });

    this.ratesByDateRequests.set(dateKey, request);
    return request;
  }

  async getNBRBExchangeRates(): Promise<CurrencyRatesResult> {
    const todayKey = this.getDateKey(new Date());
    const result = await this.getRatesWithFallback(
      this.requestNBRBRates(`${NBRB_RATES_URL}?periodicity=0`, NBRB_LATEST_TIMEOUT_MS),
      "NBRB unavailable, using ExchangeRate-API:",
      todayKey
    );

    if (!("error" in result)) {
      return result;
    }

    return { error: "Failed to retrieve exchange rates from either source" };
  }

  private toBaseRates(rates: Record<string, number>): BaseRates {
    return NON_BASE_CURRENCIES.reduce<BaseRates>(
      (baseRates, currency) => {
        baseRates[currency] = rates[currency];
        return baseRates;
      },
      { [Currency.BYN]: 1 }
    );
  }

  private hasCompleteBaseRates(baseRates: BaseRates) {
    return NON_BASE_CURRENCIES.every((currency) => isValidExchangeRate(baseRates[currency]));
  }

  private getRateFromBaseRates(baseRates: BaseRates, fromCurrency: Currency, toCurrency: Currency) {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    if (fromCurrency === BASE_CURRENCY) {
      const toRate = baseRates[toCurrency];
      return isValidExchangeRate(toRate) ? 1 / toRate : undefined;
    }

    if (toCurrency === BASE_CURRENCY) {
      const fromRate = baseRates[fromCurrency];
      return isValidExchangeRate(fromRate) ? fromRate : undefined;
    }

    const fromRate = baseRates[fromCurrency];
    const toRate = baseRates[toCurrency];

    if (!isValidExchangeRate(fromRate) || !isValidExchangeRate(toRate)) {
      return undefined;
    }

    return fromRate / toRate;
  }

  private async readBaseRates(dates: Date[]) {
    const normalizedDates = Array.from(
      new Map(dates.map((date) => [this.getDateKey(date), this.normalizeDate(date)])).values()
    );

    if (normalizedDates.length === 0) {
      return new Map<string, BaseRates>();
    }

    const storedRates = await this.prisma.exchangeRate.findMany({
      where: {
        date: { in: normalizedDates },
        fromCurrency: { in: [...NON_BASE_CURRENCIES] },
        toCurrency: BASE_CURRENCY,
      },
      select: {
        date: true,
        fromCurrency: true,
        rate: true,
      },
    });

    const ratesByDate = new Map<string, BaseRates>(
      normalizedDates.map((date) => [this.getDateKey(date), { [Currency.BYN]: 1 }])
    );

    for (const storedRate of storedRates) {
      const dateKey = this.getDateKey(storedRate.date);
      const currentRates = ratesByDate.get(dateKey) ?? { [Currency.BYN]: 1 };
      currentRates[storedRate.fromCurrency] = storedRate.rate;
      ratesByDate.set(dateKey, currentRates);
    }

    return ratesByDate;
  }

  private async saveBaseRates(date: Date, baseRates: BaseRates) {
    const normalizedDate = this.normalizeDate(date);

    return this.prisma.$transaction(
      NON_BASE_CURRENCIES.map((currency) => {
        const rate = baseRates[currency];

        if (!isValidExchangeRate(rate)) {
          throw new Error(`Курс ${currency}/${BASE_CURRENCY} на ${this.getDateKey(date)} некорректен`);
        }

        return this.prisma.exchangeRate.upsert({
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
      })
    );
  }

  private async loadBaseRates(date: Date) {
    const normalizedDate = this.normalizeDate(date);
    const dateKey = this.getDateKey(normalizedDate);
    const existingRequest = this.baseRatesRequests.get(dateKey);

    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const storedRates = await this.readBaseRates([normalizedDate]);
      const baseRates = storedRates.get(dateKey);

      if (baseRates && this.hasCompleteBaseRates(baseRates)) {
        return baseRates;
      }

      const apiResult = await this.getNBRBExchangeRatesByDate(normalizedDate);
      if ("error" in apiResult) {
        throw new Error(`Не удалось получить курс: ${apiResult.error}`);
      }

      const fetchedBaseRates = this.toBaseRates(apiResult.data);

      if (!this.hasCompleteBaseRates(fetchedBaseRates)) {
        throw new Error(`Курсы ${NON_BASE_CURRENCY_LABELS} на ${dateKey} не найдены`);
      }

      await this.saveBaseRates(normalizedDate, fetchedBaseRates);
      return fetchedBaseRates;
    })().finally(() => {
      this.baseRatesRequests.delete(dateKey);
    });

    this.baseRatesRequests.set(dateKey, request);
    return request;
  }

  async preloadExchangeRates(requests: ExchangeRateRequest[]) {
    const uniqueRequests = Array.from(
      new Map(
        requests.map((request) => {
          const normalizedRequest = {
            ...request,
            date: this.normalizeDate(request.date),
          };

          return [this.getRequestKey(normalizedRequest), normalizedRequest];
        })
      ).values()
    );

    const rates = new Map<string, number>();
    const baseRatesByDate = await this.readBaseRates(uniqueRequests.map((request) => request.date));
    const missingDates = new Map<string, Date>();

    for (const request of uniqueRequests) {
      const requestKey = this.getRequestKey(request);
      const baseRates = baseRatesByDate.get(this.getDateKey(request.date));
      const rate = baseRates
        ? this.getRateFromBaseRates(baseRates, request.fromCurrency, request.toCurrency)
        : undefined;

      if (typeof rate === "number") {
        rates.set(requestKey, rate);
        continue;
      }

      missingDates.set(this.getDateKey(request.date), request.date);
    }

    for (const date of missingDates.values()) {
      baseRatesByDate.set(this.getDateKey(date), await this.loadBaseRates(date));
    }

    for (const request of uniqueRequests) {
      const requestKey = this.getRequestKey(request);

      if (rates.has(requestKey)) {
        continue;
      }

      const baseRates = baseRatesByDate.get(this.getDateKey(request.date));
      const rate = baseRates
        ? this.getRateFromBaseRates(baseRates, request.fromCurrency, request.toCurrency)
        : undefined;

      if (typeof rate !== "number") {
        throw new Error(
          `Курс для ${request.fromCurrency}/${request.toCurrency} на ${this.getDateKey(request.date)} не найден`
        );
      }

      rates.set(requestKey, rate);
    }

    return rates;
  }

  private buildRatesResponse(date: Date, rates: Map<string, number>) {
    return Object.fromEntries(
      NON_BASE_CURRENCIES.flatMap((currency) => {
        const rate = rates.get(
          this.getRequestKey({
            date,
            fromCurrency: currency,
            toCurrency: BASE_CURRENCY,
          })
        );

        return typeof rate === "number" ? [[currency, rate]] : [];
      })
    );
  }

  async saveDailyExchangeRates() {
    const today = this.normalizeDate(new Date());
    const apiResult = await this.getNBRBExchangeRates();

    if ("error" in apiResult) {
      throw new Error(apiResult.error);
    }

    const baseRates = this.toBaseRates(apiResult.data);
    if (!this.hasCompleteBaseRates(baseRates)) {
      throw new Error(`Курсы ${NON_BASE_CURRENCY_LABELS} на ${this.getDateKey(today)} не найдены`);
    }

    return this.saveBaseRates(today, baseRates);
  }

  async getExchangeRate(date: Date, fromCurrency: Currency, toCurrency: Currency) {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const request = {
      date,
      fromCurrency,
      toCurrency,
    };
    const rates = await this.preloadExchangeRates([request]);
    const rate = rates.get(this.getRequestKey(request));

    if (typeof rate !== "number") {
      throw new Error(`Курс для ${fromCurrency}/${toCurrency} на ${this.getDateKey(date)} не найден`);
    }

    return rate;
  }

  private async getCurrencyRatesForDate(date: Date) {
    const rates = await this.preloadExchangeRates(
      NON_BASE_CURRENCIES.map((currency) => ({
        date,
        fromCurrency: currency,
        toCurrency: BASE_CURRENCY,
      }))
    );

    const response = this.buildRatesResponse(date, rates);

    if (Object.keys(response).length === 0) {
      throw new Error("Не удалось получить курсы валют");
    }

    return response;
  }

  async getTodayExchangeRates() {
    return this.getCurrencyRatesForDate(this.normalizeDate(new Date()));
  }

  async getYesterdayExchangeRates() {
    const yesterday = this.normalizeDate(new Date());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return this.getCurrencyRatesForDate(yesterday);
  }
}
