import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { AccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { compareMoney, formatMoney, HIDDEN_AMOUNT } from "@/shared/utils/money";

export interface AccountBalanceQuickAction {
  icon: LucideIcon;
  id: string;
  label: string;
  onClick: () => void;
}

export interface AccountBalanceBreakdownItem {
  accountColor: string | null;
  accountIcon: string | null;
  accountId: string;
  accountName: string;
  dailyChangeAmount: string;
}

interface AccountBalanceSummaryProps {
  accountChanges: AccountBalanceBreakdownItem[];
  actions: AccountBalanceQuickAction[];
  amountsHidden: boolean;
  baseCurrency: string;
  balance: string;
  dailyChangeAmount: string;
  dailyChangePercent: number | null;
  hasAccounts: boolean;
  isError?: boolean;
  isLoading?: boolean;
  onAccountClick: (accountId: string) => void;
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

function getDailyChangeTextClassName(value: string) {
  const comparison = compareMoney(value, "0");

  if (comparison === 0) {
    return "text-muted-foreground";
  }

  return comparison > 0 ? "text-success" : "text-destructive";
}

export function AccountBalanceSummary({
  accountChanges,
  actions,
  amountsHidden,
  balance,
  baseCurrency,
  dailyChangeAmount,
  dailyChangePercent,
  hasAccounts,
  isError = false,
  isLoading = false,
  onAccountClick,
  onBalanceClick,
}: AccountBalanceSummaryProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const showBalanceSkeleton = isLoading;
  const balanceLabel = amountsHidden ? HIDDEN_AMOUNT : isError ? "—" : formatMoney(balance, baseCurrency);
  const changeLabel = amountsHidden
    ? HIDDEN_AMOUNT
    : isError || !hasAccounts
      ? "—"
      : `${formatDailyChangeAmount(dailyChangeAmount, baseCurrency)} (${formatDailyChange(dailyChangePercent)})`;

  const canOpenBreakdown = !isError && hasAccounts && accountChanges.length > 0;

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
            <button
              type="button"
              aria-controls="account-balance-breakdown"
              aria-expanded={isBreakdownOpen}
              aria-label={isBreakdownOpen ? "Скрыть расшифровку изменения" : "Показать расшифровку изменения"}
              disabled={!canOpenBreakdown}
              onClick={() => setIsBreakdownOpen((current) => !current)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring focus:ring-offset-2 disabled:cursor-default",
                getDailyChangeBadgeClassName(isError ? null : dailyChangePercent, dailyChangeAmount)
              )}
            >
              {changeLabel}
              <ChevronDown className={cn("size-3 transition-transform", isBreakdownOpen && "rotate-180")} />
            </button>
          </>
        )}
      </div>

      {isBreakdownOpen && (
        <div id="account-balance-breakdown" className="rounded-xl border border-border/70 bg-surface-subtle/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Изменение за сегодня</p>
            <p className={cn("text-sm font-semibold", getDailyChangeTextClassName(dailyChangeAmount))}>
              {amountsHidden ? HIDDEN_AMOUNT : formatDailyChangeAmount(dailyChangeAmount, baseCurrency)}
            </p>
          </div>

          <div className="space-y-1">
            {accountChanges.map(({ accountColor, accountIcon, accountId, accountName, dailyChangeAmount }) => (
              <button
                key={accountId}
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30"
                onClick={() => {
                  setIsBreakdownOpen(false);
                  onAccountClick(accountId);
                }}
              >
                <AccountIcon
                  accountColor={accountColor}
                  accountName={accountName}
                  className="size-4 shrink-0"
                  iconName={accountIcon}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{accountName}</span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium",
                    amountsHidden ? "text-muted-foreground" : getDailyChangeTextClassName(dailyChangeAmount)
                  )}
                >
                  {amountsHidden ? HIDDEN_AMOUNT : formatDailyChangeAmount(dailyChangeAmount, baseCurrency)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border/70 px-2 pt-2">
            <span className="text-sm font-medium">Итого</span>
            <span className={cn("text-sm font-semibold", getDailyChangeTextClassName(dailyChangeAmount))}>
              {amountsHidden ? HIDDEN_AMOUNT : formatDailyChangeAmount(dailyChangeAmount, baseCurrency)}
            </span>
          </div>
        </div>
      )}

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
