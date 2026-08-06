import type { LucideIcon } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
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

function getDailyChangeBadgeClassName(value: number | null) {
  if (value === null || value === 0) {
    return "bg-surface-subtle text-muted-foreground";
  }

  return value > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
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
    <div className="mb-5 space-y-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {showBalanceSkeleton ? (
          <>
            <Skeleton className="h-8 w-36 sm:h-9" />
            <Skeleton className="h-6 w-14" />
          </>
        ) : (
          <>
            <p className="truncate text-2xl font-semibold sm:text-3xl">{balanceLabel}</p>
            <Badge className={cn("shrink-0", getDailyChangeBadgeClassName(isError ? null : dailyChangePercent))}>
              {changeLabel}
            </Badge>
          </>
        )}
      </div>

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
  );
}
