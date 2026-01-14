"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

import { getTodayExchangeRates } from "@/modules/currency/exchange-rate.service";
import { getCurrencySymbol } from "@/shared/utils/money";

interface ExchangeRatesHeaderProps {
  baseCurrency: string;
}

export function ExchangeRatesHeader({ baseCurrency }: ExchangeRatesHeaderProps) {
  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["exchange-rates-today"],
    queryFn: () => getTodayExchangeRates(),
    staleTime: 3600000,
    refetchInterval: false,
    retry: 1,
    retryDelay: 5000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    gcTime: 86400000,
  });


  if (baseCurrency !== Currency.BYN) {
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
  const usdRate = rates[Currency.USD];
  const eurRate = rates[Currency.EUR];

  if (!usdRate && !eurRate) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      {usdRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol(Currency.USD)}</span>
          <span className="font-medium">{usdRate.toFixed(2)}</span>
        </div>
      )}
      {eurRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol(Currency.EUR)}</span>
          <span className="font-medium">{eurRate.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
