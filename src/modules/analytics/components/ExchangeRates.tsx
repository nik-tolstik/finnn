"use client";

import { useQuery } from "@tanstack/react-query";

import { getCurrencySymbol } from "@/shared/utils/money";
import { getNBRBExchangeRates } from "../currency.service";

interface ExchangeRatesProps {
  baseCurrency: string;
}

export function ExchangeRates({ baseCurrency }: ExchangeRatesProps) {
  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["nbrb-rates"],
    queryFn: () => getNBRBExchangeRates(),
    staleTime: 3600000,
    refetchInterval: 3600000,
  });

  if (baseCurrency !== "BYN") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border shadow-sm p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-6 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (ratesData && "error" in ratesData) {
    return null;
  }

  const rates = ratesData && "data" in ratesData ? ratesData.data : {};
  const usdRate = rates["USD"];
  const eurRate = rates["EUR"];

  if (!usdRate && !eurRate) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {usdRate && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <span className="text-lg font-semibold text-primary">{getCurrencySymbol("USD")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">USD / BYN</p>
              <p className="text-lg font-semibold text-foreground">{usdRate.toFixed(4)} Br</p>
            </div>
          </div>
        </div>
      )}
      {eurRate && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <span className="text-lg font-semibold text-primary">{getCurrencySymbol("EUR")}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">EUR / BYN</p>
              <p className="text-lg font-semibold text-foreground">{eurRate.toFixed(4)} Br</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
