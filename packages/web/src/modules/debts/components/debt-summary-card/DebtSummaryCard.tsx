import { formatMoney } from "@/shared/utils/money";

import { DebtType } from "../../debt.constants";
import { getDebtSummaryProgress } from "./debt-summary-card.utils";

interface DebtSummaryCardProps {
  currency: string;
  debtType: string;
  pendingPaymentAmount?: string;
  personName: string;
  previewRemainingAmount?: string;
  remainingAmount: string;
  totalAmount: string;
}

export function DebtSummaryCard({
  currency,
  debtType,
  pendingPaymentAmount,
  personName,
  previewRemainingAmount,
  remainingAmount,
  totalAmount,
}: DebtSummaryCardProps) {
  const isLent = debtType === DebtType.LENT;
  const directionLabel = isLent ? "Мне должны" : "Я должен";
  const progress = getDebtSummaryProgress({ totalAmount, remainingAmount, pendingPaymentAmount });
  const displayedRemainingAmount = previewRemainingAmount ?? progress.previewRemainingAmount;
  const hasPendingPayment = progress.pendingPaymentSegmentPercent > 0;
  const progressDescription = hasPendingPayment
    ? `${progress.debtProgressPercent}% уже закрыто, ${progress.pendingPaymentPercent}% закроется этим платежом`
    : `${progress.debtProgressPercent}% уже закрыто`;

  return (
    <div className="space-y-3 rounded-xl bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-sm font-medium">{personName}</div>
          <div className="text-xs text-muted-foreground">{directionLabel}</div>
        </div>
        <div className="shrink-0 text-right text-base font-semibold text-foreground">
          {formatMoney(displayedRemainingAmount, currency)}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">Прогресс погашения долга {personName}</legend>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.totalProgressPercent}
          aria-valuetext={progressDescription}
        >
          <div className="flex h-full w-full">
            <div
              className="h-full bg-foreground transition-[width]"
              style={{ width: `${progress.debtProgressPercent}%` }}
            />
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress.pendingPaymentSegmentPercent}%` }}
            />
          </div>
        </div>
        <div className="relative h-4 text-xs text-muted-foreground">
          <span
            className={`absolute top-0 whitespace-nowrap text-foreground ${
              progress.debtProgressPercent === 0 ? "left-0" : "-translate-x-1/2"
            }`}
            style={progress.debtProgressPercent === 0 ? undefined : { left: `${progress.debtProgressPercent / 2}%` }}
          >
            {formatMoney(progress.alreadyRepaidAmount, currency)}
          </span>
          <span className="absolute top-0 right-0 whitespace-nowrap">{formatMoney(totalAmount, currency)}</span>
        </div>
      </fieldset>
    </div>
  );
}
