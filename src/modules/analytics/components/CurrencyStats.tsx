"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { addMoney, formatMoney, getCurrencySymbol } from "@/shared/utils/money";
import { useCountUp } from "@/shared/hooks/useCountUp";

interface CurrencyStatsProps {
  workspaceId: string;
  selectedAccountIds?: string[] | undefined;
}

export function CurrencyStats({ workspaceId, selectedAccountIds }: CurrencyStatsProps) {
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const allAccounts = accountsData?.data || [];
  const accounts = selectedAccountIds
    ? allAccounts.filter((account) => selectedAccountIds.includes(account.id))
    : allAccounts;

  const currencyTotals = accounts.reduce((acc, account) => {
    const currency = account.currency || "USD";
    if (!acc[currency]) {
      acc[currency] = "0";
    }
    acc[currency] = addMoney(acc[currency], account.balance);
    return acc;
  }, {} as Record<string, string>);

  const currencyEntries = Object.entries(currencyTotals).sort((a, b) => {
    const valueA = parseFloat(a[1]);
    const valueB = parseFloat(b[1]);
    return valueB - valueA;
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border shadow-sm p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (currencyEntries.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {currencyEntries.map(([currency, total]) => (
        <CurrencyCard key={currency} currency={currency} total={total} />
      ))}
    </div>
  );
}

function CurrencyCard({ currency, total }: { currency: string; total: string }) {
  const totalNumber = useMemo(() => parseFloat(total), [total]);
  const animatedValue = useCountUp({
    end: totalNumber,
    duration: 1000,
    enabled: !isNaN(totalNumber),
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <span className="text-lg font-bold text-primary">{getCurrencySymbol(currency)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">Общий баланс</p>
          <p className="text-lg font-semibold text-foreground truncate">
            {formatMoney(animatedValue.toString(), currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
