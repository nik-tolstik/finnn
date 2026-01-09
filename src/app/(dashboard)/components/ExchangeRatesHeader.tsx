"use client";

import { useQuery } from "@tanstack/react-query";

import { getCurrencySymbol } from "@/shared/utils/money";
import { getNBRBExchangeRates } from "@/modules/analytics/currency.service";

interface ExchangeRatesHeaderProps {
  baseCurrency: string;
}

export function ExchangeRatesHeader({ baseCurrency }: ExchangeRatesHeaderProps) {
  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["nbrb-rates"],
    queryFn: () => getNBRBExchangeRates(),
    staleTime: 3600000,
    refetchInterval: 3600000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  if (baseCurrency !== "BYN") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-5 w-12 bg-muted rounded animate-pulse" />
        <div className="h-5 w-12 bg-muted rounded animate-pulse" />
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
    <div className="flex items-center gap-4 text-sm">
      {usdRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol("USD")}</span>
          <span className="font-medium">{usdRate.toFixed(2)}</span>
        </div>
      )}
      {eurRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol("EUR")}</span>
          <span className="font-medium">{eurRate.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
