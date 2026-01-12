import { NextResponse } from "next/server";

interface NBRBRate {
  Cur_ID: number;
  Date: string;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
}

export async function GET() {
  const url = "https://www.nbrb.by/api/exrates/rates?periodicity=0";
  console.warn("[NBRB API Route] Начало запроса курсов валют:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("[NBRB API Route] Таймаут запроса (30 секунд)");
      controller.abort();
    }, 30000);

    try {
      console.warn("[NBRB API Route] Выполняю fetch запрос...");
      const response = await fetch(url, {
        next: { revalidate: 3600 },
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);
      console.warn("[NBRB API Route] Получен ответ:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Не удалось прочитать ответ");
        console.error("[NBRB API Route] Ошибка ответа:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200),
        });
        return NextResponse.json(
          { error: `Не удалось получить курсы валют: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      console.warn("[NBRB API Route] Парсинг JSON...");
      const rates: NBRBRate[] = await response.json();
      console.warn("[NBRB API Route] Получено курсов:", rates.length);

      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap["BYN"] = 1;

      console.warn("[NBRB API Route] Успешно получены курсы:", Object.keys(ratesMap));
      return NextResponse.json({ data: ratesMap });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error("[NBRB API Route] Ошибка fetch:", {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack,
        cause: fetchError.cause,
      });

      if (fetchError.name === "AbortError") {
        return NextResponse.json({ error: "Таймаут при получении курсов валют" }, { status: 504 });
      }

      if (fetchError.message?.includes("CORS") || fetchError.message?.includes("cors")) {
        console.error("[NBRB API Route] Обнаружена CORS ошибка");
        return NextResponse.json({ error: `CORS ошибка: ${fetchError.message}` }, { status: 502 });
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error("[NBRB API Route] Критическая ошибка:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    return NextResponse.json(
      { error: error.message || "Не удалось получить курсы валют" },
      { status: 500 }
    );
  }
}
