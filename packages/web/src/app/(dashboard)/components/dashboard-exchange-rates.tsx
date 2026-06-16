"use client";

import { useQuery } from "@tanstack/react-query";

import { getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { getTodayExchangeRates } from "@/shared/api/generated/currency/currency";
import { Currency, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { exchangeRateKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { cn } from "@/shared/utils/cn";

export interface DashboardExchangeRate {
  currency: Currency;
  label: string;
  rate: number;
  symbol: string;
  value: string;
}

interface DashboardExchangeRatesListProps {
  className?: string;
  compact?: boolean;
  rates: DashboardExchangeRate[];
}

export function useDashboardExchangeRates(workspaceId?: string) {
  const { data: workspaceData, isLoading: isWorkspaceLoading } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId ?? "pending"),
    queryFn: () => (workspaceId ? getWorkspaceSummary(workspaceId) : null),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;
  const shouldLoadRates = !!workspaceId && baseCurrency === Currency.BYN;

  const { data: ratesData, isLoading: isRatesLoading } = useQuery({
    queryKey: exchangeRateKeys.today(),
    queryFn: () => getTodayExchangeRates(),
    enabled: shouldLoadRates,
    staleTime: 3600000,
    refetchInterval: false,
    retry: 1,
    retryDelay: 5000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    gcTime: 86400000,
  });

  const rates = ratesData?.data ?? {};
  const exchangeRates = [
    rates[Currency.USD] && {
      currency: Currency.USD,
      label: `${Currency.USD}/BYN`,
      rate: rates[Currency.USD],
      symbol: "$",
      value: rates[Currency.USD].toFixed(2),
    },
    rates[Currency.EUR] && {
      currency: Currency.EUR,
      label: `${Currency.EUR}/BYN`,
      rate: rates[Currency.EUR],
      symbol: "€",
      value: rates[Currency.EUR].toFixed(2),
    },
  ].filter(Boolean) as DashboardExchangeRate[];

  return {
    baseCurrency,
    isLoading: !!workspaceId && (isWorkspaceLoading || (shouldLoadRates && isRatesLoading)),
    rates: shouldLoadRates ? exchangeRates : [],
    shouldRender: shouldLoadRates && exchangeRates.length > 0,
  };
}

export function DashboardExchangeRatesList({ className, compact = false, rates }: DashboardExchangeRatesListProps) {
  return (
    <div className={cn(compact ? "space-y-1" : "flex items-center gap-6", className)}>
      {rates.map((rate) => (
        <div
          className={cn(
            "flex items-center whitespace-nowrap",
            compact ? "justify-between gap-3 text-sm" : "gap-1.5 text-xs"
          )}
          key={rate.currency}
        >
          <span className="text-muted-foreground">{compact ? rate.symbol : rate.label}</span>
          <span className="font-medium">{rate.value}</span>
        </div>
      ))}
    </div>
  );
}
