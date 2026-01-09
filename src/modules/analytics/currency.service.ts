"use server";

interface NBRBRate {
  Cur_ID: number;
  Date: string;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
}

export async function getNBRBExchangeRates(): Promise<{ data: Record<string, number> } | { error: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("https://www.nbrb.by/api/exrates/rates?periodicity=0", {
        next: { revalidate: 3600 },
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { error: "Не удалось получить курсы валют" };
      }

      const rates: NBRBRate[] = await response.json();

      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap["BYN"] = 1;

      return { data: ratesMap };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        return { error: "Таймаут при получении курсов валют" };
      }
      throw fetchError;
    }
  } catch (error: any) {
    return { error: error.message || "Не удалось получить курсы валют" };
  }
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
