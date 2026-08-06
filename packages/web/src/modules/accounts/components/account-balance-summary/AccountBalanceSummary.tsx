import type { LucideIcon } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { compareMoney, formatMoney, HIDDEN_AMOUNT } from "@/shared/utils/money";

export interface AccountBalanceQuickAction {
  icon: LucideIcon;
  id: string;
  label: string;
  onClick: () => void;
}

interface AccountBalanceSummaryProps {
  actions: AccountBalanceQuickAction[];
  amountsHidden: boolean;
  baseCurrency: string;
  balance: string;
  dailyChangeAmount: string;
  dailyChangePercent: number | null;
  hasAccounts: boolean;
  isError?: boolean;
  isLoading?: boolean;
  onBalanceClick: () => void;
}

function formatDailyChange(value: number | null) {
  if (value === null) {
    return "—";
  }

  const formattedValue = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);

  return `${value > 0 ? "+" : ""}${formattedValue}%`;
}

function formatDailyChangeAmount(value: string, currency: string) {
  const formattedValue = formatMoney(value, currency);

  return compareMoney(value, "0") > 0 ? `+${formattedValue}` : formattedValue;
}

function getDailyChangeBadgeClassName(percent: number | null, amount: string) {
  const value = percent ?? compareMoney(amount, "0");

  if (value === 0) {
    return "bg-surface-subtle text-muted-foreground";
  }

  return value > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
}

export function AccountBalanceSummary({
  actions,
  amountsHidden,
  balance,
  baseCurrency,
  dailyChangeAmount,
  dailyChangePercent,
  hasAccounts,
  isError = false,
  isLoading = false,
  onBalanceClick,
}: AccountBalanceSummaryProps) {
  const showBalanceSkeleton = isLoading;
  const balanceLabel = amountsHidden ? HIDDEN_AMOUNT : isError ? "—" : formatMoney(balance, baseCurrency);
  const changeLabel = amountsHidden
    ? HIDDEN_AMOUNT
    : isError || !hasAccounts
      ? "—"
      : `${formatDailyChangeAmount(dailyChangeAmount, baseCurrency)} (${formatDailyChange(dailyChangePercent)})`;

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
            <button
              type="button"
              className="min-w-0 cursor-pointer truncate text-left text-2xl font-semibold outline-none transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-control-focus/30 sm:text-3xl"
              aria-label={amountsHidden ? "Показать суммы" : "Скрыть суммы"}
              aria-pressed={amountsHidden}
              onClick={onBalanceClick}
            >
              {balanceLabel}
            </button>
            <Badge
              className={cn(
                "shrink-0",
                getDailyChangeBadgeClassName(isError ? null : dailyChangePercent, dailyChangeAmount)
              )}
            >
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
