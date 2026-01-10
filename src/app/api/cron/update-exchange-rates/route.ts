import { NextRequest, NextResponse } from "next/server";
import { saveDailyExchangeRates } from "@/modules/currency/exchange-rate.service";

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
      rates 
    });
  } catch (error: any) {
    console.error("[Cron] Ошибка обновления курсов:", error);
    return NextResponse.json(
      { error: error.message || "Ошибка обновления курсов" },
      { status: 500 }
    );
  }
}
