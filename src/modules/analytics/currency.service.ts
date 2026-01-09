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
  const url = "https://www.nbrb.by/api/exrates/rates?periodicity=0";
  console.log("[NBRB] Начало запроса курсов валют:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("[NBRB] Таймаут запроса (30 секунд)");
      controller.abort();
    }, 30000);

    try {
      console.log("[NBRB] Выполняю fetch запрос...");
      const response = await fetch(url, {
        next: { revalidate: 3600 },
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);
      console.log("[NBRB] Получен ответ:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Не удалось прочитать ответ");
        console.error("[NBRB] Ошибка ответа:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200),
        });
        return { error: `Не удалось получить курсы валют: ${response.status} ${response.statusText}` };
      }

      console.log("[NBRB] Парсинг JSON...");
      const rates: NBRBRate[] = await response.json();
      console.log("[NBRB] Получено курсов:", rates.length);

      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap["BYN"] = 1;

      console.log("[NBRB] Успешно получены курсы:", Object.keys(ratesMap));
      return { data: ratesMap };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error("[NBRB] Ошибка fetch:", {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack,
        cause: fetchError.cause,
      });

      if (fetchError.name === "AbortError") {
        return { error: "Таймаут при получении курсов валют" };
      }

      if (fetchError.message?.includes("CORS") || fetchError.message?.includes("cors")) {
        console.error("[NBRB] Обнаружена CORS ошибка");
        return { error: `CORS ошибка: ${fetchError.message}` };
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error("[NBRB] Критическая ошибка:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
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
