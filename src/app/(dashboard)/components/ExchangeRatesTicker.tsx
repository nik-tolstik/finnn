"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getTodayExchangeRates } from "@/modules/currency/exchange-rate.service";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { DEFAULT_CURRENCY } from "@/shared/constants/currency";

export function ExchangeRatesTicker() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setWorkspaceId(searchParams.get("workspaceId") || undefined);
  }, [searchParams]);

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => (workspaceId ? getWorkspace(workspaceId) : null),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;

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
      <div className="h-8 bg-muted/50 border-b overflow-hidden">
        <div className="flex items-center h-full px-4 sm:px-8">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
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

  const ratesList = [
    usdRate && { currency: Currency.USD, rate: usdRate },
    eurRate && { currency: Currency.EUR, rate: eurRate },
  ].filter(Boolean) as Array<{ currency: Currency; rate: number }>;

  if (ratesList.length === 0) {
    return null;
  }

  const content = ratesList.map(({ currency, rate }) => (
    <div key={currency} className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground">{currency}/BYN</span>
      <span className="font-medium">{rate.toFixed(2)}</span>
    </div>
  ));

  return (
    <div className="h-8 bg-muted/50 border-b">
      <div className="flex items-center h-full px-4 sm:px-8 gap-6 text-xs">
        {content}
      </div>
    </div>
  );
}
