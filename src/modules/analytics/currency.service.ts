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

async function getNBRBRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const url = "https://www.nbrb.by/api/exrates/rates?periodicity=0";
  console.warn("[NBRB] Попытка получить курсы от НБРБ:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        next: { revalidate: 86400 },
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { error: `NBRB API error: ${response.status}` };
      }

      const rates: NBRBRate[] = await response.json();
      const ratesMap: Record<string, number> = {};

      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap["BYN"] = 1;

      console.warn("[NBRB] Успешно получены курсы от НБРБ");
      return { data: ratesMap };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        return { error: "NBRB timeout" };
      }
      throw fetchError;
    }
  } catch (error: any) {
    return { error: error.message || "NBRB error" };
  }
}

async function getExchangeRateAPIRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  const url = "https://api.exchangerate-api.com/v4/latest/BYN";
  console.warn("[ExchangeRate-API] Получение курсов валют (fallback):", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        next: { revalidate: 86400 },
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { error: `ExchangeRate-API error: ${response.status}` };
      }

      const data: ExchangeRateAPIResponse = await response.json();

      const ratesMap: Record<string, number> = {
        BYN: 1,
      };

      if (data.rates) {
        if (data.rates.USD) {
          ratesMap["USD"] = 1 / data.rates.USD;
        }
        if (data.rates.EUR) {
          ratesMap["EUR"] = 1 / data.rates.EUR;
        }
      }

      console.warn("[ExchangeRate-API] Успешно получены курсы");
      return { data: ratesMap };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        return { error: "ExchangeRate-API timeout" };
      }
      throw fetchError;
    }
  } catch (error: any) {
    return { error: error.message || "ExchangeRate-API error" };
  }
}

export async function getNBRBExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  console.warn("[Currency Service] Начало получения курсов валют");

  const nbrbResult = await getNBRBRates();
  if (!("error" in nbrbResult)) {
    return nbrbResult;
  }

  console.warn("[Currency Service] НБРБ недоступен, используем ExchangeRate-API:", nbrbResult.error);

  const exchangeRateResult = await getExchangeRateAPIRates();
  if (!("error" in exchangeRateResult)) {
    return exchangeRateResult;
  }

  console.error("[Currency Service] Оба источника недоступны");
  return { error: "Не удалось получить курсы валют ни от одного источника" };
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
      return { error: "Не удалось получить курс валюты" };
    }

    const rate: NBRBRate = await response.json();
    const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;

    return { data: ratePerUnit };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить курс валюты" };
  }
}

export async function getNBRBExchangeRatesByDate(date: Date): Promise<{ data: Record<string, number> } | { error: string }> {
  const dateStr = date.toISOString().split("T")[0];
  const url = `https://www.nbrb.by/api/exrates/rates?periodicity=0&ondate=${dateStr}`;
  console.warn("[NBRB] Получение курсов на дату:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = `NBRB API error: ${response.status}`;
        console.warn("[Currency Service] НБРБ недоступен для даты, используем ExchangeRate-API (fallback):", error);
        const exchangeRateResult = await getExchangeRateAPIRates();
        if (!("error" in exchangeRateResult)) {
          return exchangeRateResult;
        }
        return { error };
      }

      const rates: NBRBRate[] = await response.json();
      const ratesMap: Record<string, number> = {};

      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap["BYN"] = 1;

      console.warn("[NBRB] Успешно получены курсы на дату", dateStr);
      return { data: ratesMap };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.warn("[Currency Service] НБРБ timeout для даты, используем ExchangeRate-API (fallback)");
        const exchangeRateResult = await getExchangeRateAPIRates();
        if (!("error" in exchangeRateResult)) {
          return exchangeRateResult;
        }
        return { error: "NBRB timeout" };
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.warn("[Currency Service] НБРБ ошибка для даты, используем ExchangeRate-API (fallback):", error.message);
    const exchangeRateResult = await getExchangeRateAPIRates();
    if (!("error" in exchangeRateResult)) {
      return exchangeRateResult;
    }
    return { error: error.message || "NBRB error" };
  }
}
