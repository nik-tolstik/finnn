import { NextResponse } from "next/server";
import { serverLogger } from "@/shared/lib/logger";

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
  serverLogger.warn("[NBRB API Route] Starting exchange rates request:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      serverLogger.error("[NBRB API Route] Request timeout (30 seconds)");
      controller.abort();
    }, 30000);

    try {
      serverLogger.warn("[NBRB API Route] Executing fetch request...");
      const response = await fetch(url, {
        next: { revalidate: 3600 },
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);
      serverLogger.warn("[NBRB API Route] Response received:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Failed to read response body");
        serverLogger.error("[NBRB API Route] Response error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200),
        });
        return NextResponse.json(
          { error: `Failed to get exchange rates: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      serverLogger.warn("[NBRB API Route] Parsing JSON...");
      const rates: NBRBRate[] = await response.json();
      serverLogger.warn("[NBRB API Route] Rates received:", rates.length);

      const ratesMap: Record<string, number> = {};
      for (const rate of rates) {
        const ratePerUnit = rate.Cur_OfficialRate / rate.Cur_Scale;
        ratesMap[rate.Cur_Abbreviation] = ratePerUnit;
      }

      ratesMap.BYN = 1;

      serverLogger.warn("[NBRB API Route] Successfully retrieved rates:", Object.keys(ratesMap));
      return NextResponse.json({ data: ratesMap });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      serverLogger.error("[NBRB API Route] Fetch error:", {
        name: fetchError.name,
        message: fetchError.message,
        stack: fetchError.stack,
        cause: fetchError.cause,
      });

      if (fetchError.name === "AbortError") {
        return NextResponse.json({ error: "Таймаут при получении курсов валют" }, { status: 504 });
      }

      if (fetchError.message?.includes("CORS") || fetchError.message?.includes("cors")) {
        serverLogger.error("[NBRB API Route] CORS error detected");
        return NextResponse.json({ error: `CORS ошибка: ${fetchError.message}` }, { status: 502 });
      }

      throw fetchError;
    }
  } catch (error: any) {
    serverLogger.error("[NBRB API Route] Critical error:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    return NextResponse.json({ error: error.message || "Failed to get exchange rates" }, { status: 500 });
  }
}
