import { compareMoney, subtractMoney } from "@/shared/utils/money";

export interface DebtSummaryProgressInput {
  pendingPaymentAmount?: string;
  remainingAmount: string;
  totalAmount: string;
}

export interface DebtSummaryProgress {
  alreadyRepaidAmount: string;
  debtProgressPercent: number;
  pendingPaymentPercent: number;
  pendingPaymentSegmentPercent: number;
  previewRemainingAmount: string;
  totalProgressPercent: number;
}

function getProgressPercent(amount: string, totalAmount: string) {
  const total = Number(totalAmount);
  const value = Number(amount);

  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function isPositiveMoneyAmount(amount?: string): amount is string {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}

export function getDebtSummaryProgress({
  totalAmount,
  remainingAmount,
  pendingPaymentAmount: pendingPaymentAmountInput,
}: DebtSummaryProgressInput): DebtSummaryProgress {
  const alreadyRepaidAmount =
    compareMoney(totalAmount, remainingAmount) > 0 ? subtractMoney(totalAmount, remainingAmount) : "0";
  const debtProgressPercent = getProgressPercent(alreadyRepaidAmount, totalAmount);
  const pendingPaymentAmount = isPositiveMoneyAmount(pendingPaymentAmountInput) ? pendingPaymentAmountInput : undefined;
  const pendingPaymentPercent = pendingPaymentAmount ? getProgressPercent(pendingPaymentAmount, totalAmount) : 0;
  const pendingPaymentSegmentPercent = Math.min(100 - debtProgressPercent, pendingPaymentPercent);
  const previewRemainingAmount = pendingPaymentAmount
    ? compareMoney(pendingPaymentAmount, remainingAmount) >= 0
      ? "0"
      : subtractMoney(remainingAmount, pendingPaymentAmount)
    : remainingAmount;

  return {
    alreadyRepaidAmount,
    debtProgressPercent,
    pendingPaymentPercent,
    pendingPaymentSegmentPercent,
    previewRemainingAmount,
    totalProgressPercent: debtProgressPercent + pendingPaymentSegmentPercent,
  };
}
