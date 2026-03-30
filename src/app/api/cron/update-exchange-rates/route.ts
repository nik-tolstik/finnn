import { type NextRequest, NextResponse } from "next/server";

import { saveDailyExchangeRates } from "@/modules/currency/exchange-rate.service";
import { serverLogger } from "@/shared/lib/logger";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rates = await saveDailyExchangeRates();
    return NextResponse.json({
      success: true,
      saved: rates.length,
      rates,
    });
  } catch (error: any) {
    serverLogger.error("[Cron] Failed to update exchange rates:", error);
    return NextResponse.json({ error: error.message || "Failed to update exchange rates" }, { status: 500 });
  }
}
