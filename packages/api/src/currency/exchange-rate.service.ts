import { Inject, Injectable, Logger } from "@nestjs/common";
import { Currency } from "@prisma/client";

import { PrismaService } from "@/prisma/prisma.service";

const BASE_CURRENCY = Currency.BYN;
const NON_BASE_CURRENCIES = [Currency.USD, Currency.EUR] as const;
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
  rates: Record<string, number>;
}

type CurrencyRatesResult = { data: Record<string, number> } | { error: string };
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

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private nbrbUnavailableUntil = 0;
  private fallbackRatesCache: { expiresAt: number; value: Record<string, number> } | null = null;
  private fallbackRatesRequest: Promise<CurrencyRatesResult> | null = null;
  private readonly ratesByDateRequests = new Map<string, Promise<CurrencyRatesResult>>();
  private readonly baseRatesRequests = new Map<string, Promise<BaseRates>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private normalizeDate(date: Date) {
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);
    return normalizedDate;
  }

  private getDateKey(date: Date) {
    return this.normalizeDate(date).toISOString().split("T")[0];
  }

  getRequestKey(request: ExchangeRateRequest) {
    return `${this.getDateKey(request.date)}:${request.fromCurrency}:${request.toCurrency}`;
  }

  private mapNBRBRates(rates: NBRBRate[]) {
    const mappedRates: Record<string, number> = {
      BYN: 1,
    };

    for (const rate of rates) {
      mappedRates[rate.Cur_Abbreviation] = rate.Cur_OfficialRate / rate.Cur_Scale;
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

  private async getExchangeRateAPIRates(): Promise<CurrencyRatesResult> {
    if (this.fallbackRatesCache && this.fallbackRatesCache.expiresAt > Date.now()) {
      return { data: this.fallbackRatesCache.value };
    }

    if (this.fallbackRatesRequest) {
      return this.fallbackRatesRequest;
    }

    this.fallbackRatesRequest = (async () => {
      try {
        const response = await this.fetchWithTimeout(
          "https://api.exchangerate-api.com/v4/latest/BYN",
          EXCHANGE_RATE_API_TIMEOUT_MS
        );

        if (!response.ok) {
          return { error: `ExchangeRate-API error: ${response.status}` };
        }

        const data = (await response.json()) as ExchangeRateAPIResponse;
        const rates: Record<string, number> = { BYN: 1 };

        if (data.rates.USD) {
          rates.USD = 1 / data.rates.USD;
        }

        if (data.rates.EUR) {
          rates.EUR = 1 / data.rates.EUR;
        }

        this.fallbackRatesCache = {
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
        this.fallbackRatesRequest = null;
      }
    })();

    return this.fallbackRatesRequest;
  }

  private async getRatesWithFallback(nbrbResultPromise: Promise<CurrencyRatesResult>, warningMessage: string) {
    const nbrbResult = await nbrbResultPromise;

    if (!("error" in nbrbResult)) {
      return nbrbResult;
    }

    this.logger.warn(`${warningMessage} ${nbrbResult.error}`);

    const fallbackResult = await this.getExchangeRateAPIRates();
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

    const url = `https://www.nbrb.by/api/exrates/rates?periodicity=0&ondate=${dateKey}`;
    const request = this.getRatesWithFallback(
      this.requestNBRBRates(url, NBRB_BY_DATE_TIMEOUT_MS),
      "NBRB unavailable for date, using ExchangeRate-API:"
    ).finally(() => {
      this.ratesByDateRequests.delete(dateKey);
    });

    this.ratesByDateRequests.set(dateKey, request);
    return request;
  }

  async getNBRBExchangeRates(): Promise<CurrencyRatesResult> {
    const result = await this.getRatesWithFallback(
      this.requestNBRBRates("https://www.nbrb.by/api/exrates/rates?periodicity=0", NBRB_LATEST_TIMEOUT_MS),
      "NBRB unavailable, using ExchangeRate-API:"
    );

    if (!("error" in result)) {
      return result;
    }

    return { error: "Failed to retrieve exchange rates from either source" };
  }

  private toBaseRates(rates: Record<string, number>): BaseRates {
    return {
      [Currency.BYN]: 1,
      [Currency.USD]: rates[Currency.USD],
      [Currency.EUR]: rates[Currency.EUR],
    };
  }

  private hasCompleteBaseRates(baseRates: BaseRates) {
    return typeof baseRates[Currency.USD] === "number" && typeof baseRates[Currency.EUR] === "number";
  }

  private getRateFromBaseRates(baseRates: BaseRates, fromCurrency: Currency, toCurrency: Currency) {
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

    await Promise.all(
      NON_BASE_CURRENCIES.map(async (currency) => {
        const rate = baseRates[currency];

        if (typeof rate !== "number") {
          return null;
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
        throw new Error(`Курсы USD/EUR на ${dateKey} не найдены`);
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
}
