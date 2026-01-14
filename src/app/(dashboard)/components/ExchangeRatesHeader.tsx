"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

import { getTodayExchangeRates, getYesterdayExchangeRates } from "@/modules/currency/exchange-rate.service";
import { cn } from "@/shared/utils/cn";
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

  const { data: yesterdayRatesData } = useQuery({
    queryKey: ["exchange-rates-yesterday"],
    queryFn: () => getYesterdayExchangeRates(),
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
  const yesterdayRates = yesterdayRatesData && "data" in yesterdayRatesData ? yesterdayRatesData.data : {};
  const usdRate = rates[Currency.USD];
  const eurRate = rates[Currency.EUR];
  const usdRateYesterday = yesterdayRates[Currency.USD];
  const eurRateYesterday = yesterdayRates[Currency.EUR];

  if (!usdRate && !eurRate) {
    return null;
  }

  const calculateChange = (today: number, yesterday: number | undefined) => {
    if (!yesterday) return null;
    const change = today - yesterday;
    return change;
  };

  const formatChange = (change: number | null) => {
    if (change === null) return null;
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      {usdRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol(Currency.USD)}</span>
          <span className="font-medium">{usdRate.toFixed(2)}</span>
          {usdRateYesterday && (() => {
            const change = calculateChange(usdRate, usdRateYesterday);
            if (change === null) return null;
            return (
              <span
                className={cn(
                  "text-xs",
                  change > 0 ? "text-error-primary" : change < 0 ? "text-success-primary" : "text-muted-foreground"
                )}
              >
                {formatChange(change)}
              </span>
            );
          })()}
        </div>
      )}
      {eurRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{getCurrencySymbol(Currency.EUR)}</span>
          <span className="font-medium">{eurRate.toFixed(2)}</span>
          {eurRateYesterday && (() => {
            const change = calculateChange(eurRate, eurRateYesterday);
            if (change === null) return null;
            return (
              <span
                className={cn(
                  "text-xs",
                  change > 0 ? "text-error-primary" : change < 0 ? "text-success-primary" : "text-muted-foreground"
                )}
              >
                {formatChange(change)}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}
