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
  let baseUrl = process.env.NEXTAUTH_URL;
  
  if (!baseUrl) {
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = "http://localhost:3000";
    }
  }
  
  const apiUrl = `${baseUrl}/api/exchange-rates`;
  console.log("[NBRB] Начало запроса курсов валют через API route:", apiUrl);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("[NBRB] Таймаут запроса (30 секунд)");
      controller.abort();
    }, 30000);

    try {
      console.log("[NBRB] Выполняю fetch запрос к API route...");
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store",
      });

      clearTimeout(timeoutId);
      console.log("[NBRB] Получен ответ:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Не удалось прочитать ответ" }));
        console.error("[NBRB] Ошибка ответа:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
        });
        return { error: errorData.error || `Не удалось получить курсы валют: ${response.status} ${response.statusText}` };
      }

      console.log("[NBRB] Парсинг JSON...");
      const result = await response.json();
      console.log("[NBRB] Успешно получены курсы:", result.data ? Object.keys(result.data) : "нет данных");

      if (result.error) {
        return { error: result.error };
      }

      return { data: result.data };
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
