import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import type { DashboardBalancePeriod, DashboardBalanceTimeSeriesPoint } from "@/modules/analytics/analytics.api";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Button } from "@/shared/ui/button";
import { Popover } from "@/shared/ui/popover";
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
  balancePeriod: DashboardBalancePeriod;
  balanceTimeSeries: DashboardBalanceTimeSeriesPoint[];
  dailyChangeAmount: string;
  dailyChangePercent: number | null;
  hasAccounts: boolean;
  isError?: boolean;
  isLoading?: boolean;
  onAccountClick: (accountId: string) => void;
  onBalancePeriodChange: (value: DashboardBalancePeriod) => void;
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

const BALANCE_PERIOD_OPTIONS: Array<{
  compactLabel: string;
  label: string;
  value: DashboardBalancePeriod;
}> = [
  { compactLabel: "7 дн.", label: "7 дней", value: "7d" },
  { compactLabel: "30 дн.", label: "30 дней", value: "30d" },
];

function BalancePeriodSelector({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: DashboardBalancePeriod) => void;
  value: DashboardBalancePeriod;
}) {
  const selectedOption = BALANCE_PERIOD_OPTIONS.find((option) => option.value === value) ?? BALANCE_PERIOD_OPTIONS[0];

  return (
    <Popover
      className="w-44 p-1"
      placement="bottom-end"
      trigger={({ ref, ...triggerProps }) => (
        <Button
          ref={ref}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
          aria-label="Период графика"
          disabled={disabled}
          {...triggerProps}
        >
          <span className="sm:hidden">{selectedOption.compactLabel}</span>
          <span className="hidden sm:inline">{selectedOption.label}</span>
          <ChevronDown className="size-3" />
        </Button>
      )}
    >
      {({ close }) => (
        <div role="menu" aria-label="Период графика" className="space-y-0.5">
          {BALANCE_PERIOD_OPTIONS.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30"
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="size-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

function BalanceSparkline({
  amountsHidden,
  isError,
  period,
  points,
}: {
  amountsHidden: boolean;
  isError: boolean;
  period: DashboardBalancePeriod;
  points: DashboardBalanceTimeSeriesPoint[];
}) {
  const { isMobile } = useBreakpoints();
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  const trend = firstPoint && lastPoint ? compareMoney(lastPoint.balance, firstPoint.balance) : 0;
  const chartColor = trend > 0 ? "#16a34a" : trend < 0 ? "#ef4444" : "#737373";
  const periodLabel = period === "7d" ? "7 дней" : "30 дней";
  const values = points.map((point) => Number(point.balance));
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const normalizedValues = finiteValues.length > 0 ? finiteValues : [0];
  const minValue = Math.min(...normalizedValues);
  const maxValue = Math.max(...normalizedValues);
  const valueRange = maxValue - minValue || 1;
  const linePoints = points
    .map((point, index) => {
      const value = Number(point.balance);
      const x = points.length === 1 ? 48 : (index / (points.length - 1)) * 96;
      const y = Number.isFinite(value) ? 28 - ((value - minValue) / valueRange) * 22 : 28;

      return `${x},${y}`;
    })
    .join(" ");

  if (isMobile || amountsHidden || isError || points.length < 2) {
    return null;
  }

  return (
    <div className="h-8 w-20 shrink-0 select-none sm:w-24" role="img" aria-label={`График баланса за ${periodLabel}`}>
      <svg viewBox="0 0 96 32" className="size-full overflow-visible" aria-hidden="true">
        <polygon points={`0,32 ${linePoints} 96,32`} fill={chartColor} fillOpacity={0.1} />
        <polyline
          points={linePoints}
          fill="none"
          stroke={chartColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function AccountBalanceSummary({
  accountChanges,
  actions,
  amountsHidden,
  balance,
  balancePeriod,
  balanceTimeSeries,
  baseCurrency,
  dailyChangeAmount,
  dailyChangePercent,
  hasAccounts,
  isError = false,
  isLoading = false,
  onAccountClick,
  onBalancePeriodChange,
  onBalanceClick,
}: AccountBalanceSummaryProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const showBalanceSkeleton = isLoading;
  const balanceLabel = amountsHidden ? HIDDEN_AMOUNT : isError ? "—" : formatMoney(balance, baseCurrency);
  const changeLabel = amountsHidden
    ? HIDDEN_AMOUNT
    : isError || !hasAccounts
      ? "—"
      : `${formatDailyChangeAmount(dailyChangeAmount, baseCurrency)} (${formatDailyChange(dailyChangePercent)})`;

  const changedAccountChanges = accountChanges.filter(
    ({ dailyChangeAmount }) => compareMoney(dailyChangeAmount, "0") !== 0
  );
  const canOpenBreakdown = !isError && hasAccounts && changedAccountChanges.length > 0;

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
                "inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus/30 disabled:cursor-default",
                getDailyChangeBadgeClassName(isError ? null : dailyChangePercent, dailyChangeAmount)
              )}
            >
              {changeLabel}
              <ChevronDown className={cn("size-3 transition-transform", isBreakdownOpen && "rotate-180")} />
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <BalanceSparkline
                amountsHidden={amountsHidden}
                isError={isError}
                period={balancePeriod}
                points={balanceTimeSeries}
              />
              <BalancePeriodSelector
                disabled={isError || isLoading || balanceTimeSeries.length === 0}
                onChange={onBalancePeriodChange}
                value={balancePeriod}
              />
            </div>
          </>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isBreakdownOpen && (
          <motion.div
            id="account-balance-breakdown"
            key="account-balance-breakdown"
            initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0, y: -6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0, y: -6 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-surface-subtle/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Изменение за сегодня</p>
                <p className={cn("text-sm font-semibold", getDailyChangeTextClassName(dailyChangeAmount))}>
                  {amountsHidden ? HIDDEN_AMOUNT : formatDailyChangeAmount(dailyChangeAmount, baseCurrency)}
                </p>
              </div>

              <div className="space-y-1">
                {changedAccountChanges.map(
                  ({ accountColor, accountIcon, accountId, accountName, dailyChangeAmount }) => (
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
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
