import type { LucideIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

export interface AccountBalanceQuickAction {
  icon: LucideIcon;
  id: string;
  label: string;
  onClick: () => void;
}

interface AccountBalanceSummaryProps {
  actions: AccountBalanceQuickAction[];
  baseCurrency: string;
  balance: string;
  dailyChangePercent: number | null;
  hasAccounts: boolean;
  isError?: boolean;
  isLoading?: boolean;
}

function formatDailyChange(value: number | null) {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getDailyChangeClassName(value: number | null) {
  if (value === null || value === 0) {
    return "text-muted-foreground";
  }

  return value > 0 ? "text-success" : "text-destructive";
}

export function AccountBalanceSummary({
  actions,
  balance,
  baseCurrency,
  dailyChangePercent,
  hasAccounts,
  isError = false,
  isLoading = false,
}: AccountBalanceSummaryProps) {
  const showBalanceSkeleton = isLoading;
  const balanceLabel = isError ? "—" : formatMoney(balance, baseCurrency);
  const changeLabel = isError || !hasAccounts ? "—" : formatDailyChange(dailyChangePercent);

  return (
    <Card className="mb-4 gap-4 p-4 sm:p-5">
      <CardContent className="flex items-start justify-between gap-4 p-0">
        <div className="min-w-0 space-y-1">
          <CardDescription>Общий баланс</CardDescription>
          {showBalanceSkeleton ? (
            <Skeleton className="h-8 w-36" />
          ) : (
            <CardTitle className="truncate text-2xl sm:text-3xl">{balanceLabel}</CardTitle>
          )}
        </div>
        <div className="shrink-0 space-y-1 text-right">
          <CardDescription>Сегодня</CardDescription>
          {showBalanceSkeleton ? (
            <Skeleton className="ml-auto h-5 w-16" />
          ) : (
            <p className={cn("text-sm font-medium", getDailyChangeClassName(isError ? null : dailyChangePercent))}>
              {changeLabel}
            </p>
          )}
        </div>
      </CardContent>

      <div className="space-y-2">
        <p className="text-sm font-medium">Быстрые действия</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map(({ icon: Icon, id, label, onClick }) => (
            <Button
              className="h-auto min-h-14 flex-col gap-1.5 px-3 py-2.5"
              key={id}
              onClick={onClick}
              type="button"
              variant="secondary"
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
