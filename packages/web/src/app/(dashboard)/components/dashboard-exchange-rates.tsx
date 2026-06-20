"use client";

import { useQuery } from "@tanstack/react-query";

import { getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { getTodayExchangeRates } from "@/shared/api/generated/currency/currency";
import { Currency, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { exchangeRateKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { cn } from "@/shared/utils/cn";

export interface DashboardExchangeRate {
  currency: Currency;
  flagCode: CurrencyFlagCode;
  flagLabel: string;
  label: string;
  rate: number;
  shortValue: string;
  value: string;
}

interface DashboardExchangeRatesListProps {
  className?: string;
  compact?: boolean;
  labelMode?: "flag" | "label";
  rates: DashboardExchangeRate[];
}

type CurrencyFlagCode = "US" | "EU" | "RU";

const DASHBOARD_EXCHANGE_RATE_CURRENCIES = [
  { currency: Currency.USD, displayUnit: 1, flagCode: "US", flagLabel: "Флаг США", precision: 4, shortPrecision: 4 },
  {
    currency: Currency.EUR,
    displayUnit: 1,
    flagCode: "EU",
    flagLabel: "Флаг Евросоюза",
    precision: 4,
    shortPrecision: 4,
  },
  {
    currency: Currency.RUB,
    displayUnit: 100,
    flagCode: "RU",
    flagLabel: "Флаг России",
    precision: 4,
    shortPrecision: 4,
  },
] as const;

interface CurrencyFlagProps {
  className?: string;
  code: CurrencyFlagCode;
  label: string;
}

const US_STRIPES = Array.from({ length: 13 }, (_, index) => ({
  isRed: index % 2 === 0,
  y: (24 / 13) * index,
}));

const US_CANTON_DOTS = Array.from({ length: 20 }, (_, index) => ({
  cx: 1.8 + (index % 5) * 1.7,
  cy: 1.5 + Math.floor(index / 5) * 1.8,
}));

const EU_STARS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;

  return {
    cx: 12 + Math.cos(angle) * 6,
    cy: 12 + Math.sin(angle) * 6,
  };
});

function CurrencyFlagArtwork({ code }: { code: CurrencyFlagCode }) {
  if (code === "US") {
    return (
      <>
        <rect fill="#fff" height="24" width="24" />
        {US_STRIPES.map(({ isRed, y }) => isRed && <rect fill="#b22234" height={24 / 13} key={y} width="24" y={y} />)}
        <rect fill="#3c3b6e" height="10" width="11" />
        {US_CANTON_DOTS.map(({ cx, cy }) => (
          <circle cx={cx} cy={cy} fill="#fff" key={`${cx}-${cy}`} r="0.35" />
        ))}
      </>
    );
  }

  if (code === "EU") {
    return (
      <>
        <rect fill="#1e4fa3" height="24" width="24" />
        {EU_STARS.map(({ cx, cy }) => (
          <circle cx={cx} cy={cy} fill="#ffcc00" key={`${cx}-${cy}`} r="0.8" />
        ))}
      </>
    );
  }

  return (
    <>
      <rect fill="#fff" height="8" width="24" />
      <rect fill="#1c57a5" height="8" width="24" y="8" />
      <rect fill="#d52b1e" height="8" width="24" y="16" />
    </>
  );
}

export function CurrencyFlag({ className, code, label }: CurrencyFlagProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border",
        className
      )}
      role="img"
    >
      <svg aria-hidden="true" className="size-full" focusable="false" viewBox="0 0 24 24">
        <CurrencyFlagArtwork code={code} />
      </svg>
    </span>
  );
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
  const exchangeRates = DASHBOARD_EXCHANGE_RATE_CURRENCIES.flatMap(
    ({ currency, displayUnit, flagCode, flagLabel, precision, shortPrecision }) => {
      const rate = rates[currency];

      if (typeof rate !== "number") {
        return [];
      }

      const displayRate = rate * displayUnit;
      const label = displayUnit === 1 ? `${currency}/BYN` : `${displayUnit} ${currency}/BYN`;

      return [
        {
          currency,
          flagCode,
          flagLabel,
          label,
          rate,
          shortValue: displayRate.toFixed(shortPrecision),
          value: displayRate.toFixed(precision),
        },
      ];
    }
  );

  return {
    baseCurrency,
    isLoading: !!workspaceId && (isWorkspaceLoading || (shouldLoadRates && isRatesLoading)),
    rates: shouldLoadRates ? exchangeRates : [],
    shouldRender: shouldLoadRates && exchangeRates.length > 0,
  };
}

export function DashboardExchangeRatesList({
  className,
  compact = false,
  labelMode = compact ? "flag" : "label",
  rates,
}: DashboardExchangeRatesListProps) {
  return (
    <div className={cn(compact ? "space-y-1" : "flex items-center gap-4", className)}>
      {rates.map((rate) => (
        <div
          className={cn(
            "flex items-center whitespace-nowrap",
            compact ? "justify-between gap-3 text-sm" : "gap-1.5 text-xs"
          )}
          key={rate.currency}
        >
          {labelMode === "flag" ? (
            <CurrencyFlag code={rate.flagCode} label={rate.flagLabel} />
          ) : (
            <span className="text-muted-foreground">{rate.label}</span>
          )}
          <span className="font-medium">{rate.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardExchangeRatesCards({
  className,
  rates,
}: {
  className?: string;
  rates: DashboardExchangeRate[];
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {rates.map((rate) => (
        <div className="rounded-md border bg-background p-3 text-sm" key={rate.currency}>
          <div className="mb-3 flex items-center gap-2">
            <CurrencyFlag code={rate.flagCode} label={rate.flagLabel} />
            <span className="font-medium text-foreground">{rate.currency}</span>
          </div>
          <p className="text-base font-semibold">{rate.value}</p>
        </div>
      ))}
    </div>
  );
}
