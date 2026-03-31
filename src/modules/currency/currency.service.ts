"use server";

interface NBRBRate {
  Cur_ID: number;
  Date: string;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
}

interface ExchangeRateAPIResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

type CurrencyRatesResult = { data: Record<string, number> } | { error: string };

const NBRB_LATEST_TIMEOUT_MS = 5000;
const NBRB_BY_DATE_TIMEOUT_MS = 3000;
const EXCHANGE_RATE_API_TIMEOUT_MS = 5000;
const NBRB_COOLDOWN_MS = 5 * 60 * 1000;
const EXCHANGE_RATE_API_CACHE_TTL_MS = 60 * 60 * 1000;

let nbrbUnavailableUntil = 0;
let fallbackRatesCache: { expiresAt: number; value: Record<string, number> } | null = null;
let fallbackRatesRequest: Promise<CurrencyRatesResult> | null = null;

const ratesByDateRequests = new Map<string, Promise<CurrencyRatesResult>>();

function mapNBRBRates(rates: NBRBRate[]) {
  const mappedRates: Record<string, number> = {
    BYN: 1,
  };

  for (const rate of rates) {
    mappedRates[rate.Cur_Abbreviation] = rate.Cur_OfficialRate / rate.Cur_Scale;
  }

  return mappedRates;
}

function isNBRBUnavailable() {
  return Date.now() < nbrbUnavailableUntil;
}

function markNBRBUnavailable(reason: string) {
  nbrbUnavailableUntil = Date.now() + NBRB_COOLDOWN_MS;
  console.warn("[Currency Service] NBRB circuit opened:", reason);
}

function clearNBRBUnavailable() {
  nbrbUnavailableUntil = 0;
}

async function fetchWithTimeout(url: string, timeoutMs: number, revalidate: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      next: { revalidate },
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestNBRBRates(url: string, timeoutMs: number, successMessage: string): Promise<CurrencyRatesResult> {
  if (isNBRBUnavailable()) {
    return { error: "NBRB temporarily unavailable" };
  }

  try {
    const response = await fetchWithTimeout(url, timeoutMs, 86400);

    if (!response.ok) {
      const error = `NBRB API error: ${response.status}`;
      markNBRBUnavailable(error);
      return { error };
    }

    const rates: NBRBRate[] = await response.json();
    clearNBRBUnavailable();
    console.warn(successMessage);

    return { data: mapNBRBRates(rates) };
  } catch (error: any) {
    const message = error.name === "AbortError" ? "NBRB timeout" : error.message || "NBRB error";
    markNBRBUnavailable(message);
    return { error: message };
  }
}

async function getExchangeRateAPIRates(): Promise<CurrencyRatesResult> {
  if (fallbackRatesCache && fallbackRatesCache.expiresAt > Date.now()) {
    return { data: fallbackRatesCache.value };
  }

  if (fallbackRatesRequest) {
    return fallbackRatesRequest;
  }

  const url = "https://api.exchangerate-api.com/v4/latest/BYN";
  console.warn("[ExchangeRate-API] Fetching currency rates (fallback):", url);

  fallbackRatesRequest = (async () => {
    try {
      const response = await fetchWithTimeout(url, EXCHANGE_RATE_API_TIMEOUT_MS, 86400);

      if (!response.ok) {
        return { error: `ExchangeRate-API error: ${response.status}` };
      }

      const data: ExchangeRateAPIResponse = await response.json();
      const rates: Record<string, number> = {
        BYN: 1,
      };

      if (data.rates.USD) {
        rates.USD = 1 / data.rates.USD;
      }

      if (data.rates.EUR) {
        rates.EUR = 1 / data.rates.EUR;
      }

      fallbackRatesCache = {
        expiresAt: Date.now() + EXCHANGE_RATE_API_CACHE_TTL_MS,
        value: rates,
      };

      console.warn("[ExchangeRate-API] Successfully fetched rates");
      return { data: rates };
    } catch (error: any) {
      return {
        error: error.name === "AbortError" ? "ExchangeRate-API timeout" : error.message || "ExchangeRate-API error",
      };
    } finally {
      fallbackRatesRequest = null;
    }
  })();

  return fallbackRatesRequest;
}

async function getRatesWithFallback(nbrbResultPromise: Promise<CurrencyRatesResult>, warningMessage: string) {
  const nbrbResult = await nbrbResultPromise;

  if (!("error" in nbrbResult)) {
    return nbrbResult;
  }

  console.warn(warningMessage, nbrbResult.error);

  const fallbackResult = await getExchangeRateAPIRates();
  if (!("error" in fallbackResult)) {
    return fallbackResult;
  }

  return nbrbResult;
}

export async function getNBRBExchangeRates(): Promise<CurrencyRatesResult> {
  console.warn("[Currency Service] Starting to fetch exchange rates");

  const result = await getRatesWithFallback(
    requestNBRBRates(
      "https://www.nbrb.by/api/exrates/rates?periodicity=0",
      NBRB_LATEST_TIMEOUT_MS,
      "[NBRB] Successfully fetched rates from NBRB"
    ),
    "[Currency Service] NBRB unavailable, using ExchangeRate-API:"
  );

  if (!("error" in result)) {
    return result;
  }

  console.error("[Currency Service] Both sources are unavailable");
  return { error: "Failed to retrieve exchange rates from either source" };
}

export async function getNBRBExchangeRate(currencyCode: string): Promise<{ data: number } | { error: string }> {
  try {
    if (currencyCode === "BYN") {
      return { data: 1 };
    }

    const response = await fetch(`https://www.nbrb.by/api/exrates/rates/${currencyCode}?parammode=2`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return { error: "Failed to fetch exchange rate" };
    }

    const rate: NBRBRate = await response.json();
    return { data: rate.Cur_OfficialRate / rate.Cur_Scale };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch exchange rate" };
  }
}

export async function getNBRBExchangeRatesByDate(date: Date): Promise<CurrencyRatesResult> {
  const dateKey = date.toISOString().split("T")[0];
  const existingRequest = ratesByDateRequests.get(dateKey);

  if (existingRequest) {
    return existingRequest;
  }

  const url = `https://www.nbrb.by/api/exrates/rates?periodicity=0&ondate=${dateKey}`;
  console.warn("[NBRB] Fetching rates for date:", url);

  const request = getRatesWithFallback(
    requestNBRBRates(url, NBRB_BY_DATE_TIMEOUT_MS, `[NBRB] Successfully fetched rates for date ${dateKey}`),
    "[Currency Service] NBRB unavailable for date, using ExchangeRate-API (fallback):"
  ).finally(() => {
    ratesByDateRequests.delete(dateKey);
  });

  ratesByDateRequests.set(dateKey, request);
  return request;
}
