import Big from "big.js";

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
  const total = getPositiveMoneyAmount(totalAmount);
  const value = getPositiveMoneyAmount(amount);

  if (!total || !value) {
    return 0;
  }

  const percent = value.div(total).times(100).round(0, Big.roundHalfUp);

  if (percent.lte(0)) {
    return 0;
  }

  if (percent.gte(100)) {
    return 100;
  }

  return Number(percent);
}

function getPositiveMoneyAmount(amount?: string) {
  if (!amount) {
    return undefined;
  }

  try {
    const value = new Big(amount);
    return value.gt(0) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getDebtSummaryProgress({
  totalAmount,
  remainingAmount,
  pendingPaymentAmount: pendingPaymentAmountInput,
}: DebtSummaryProgressInput): DebtSummaryProgress {
  const alreadyRepaidAmount =
    compareMoney(totalAmount, remainingAmount) > 0 ? subtractMoney(totalAmount, remainingAmount) : "0";
  const debtProgressPercent = getProgressPercent(alreadyRepaidAmount, totalAmount);
  const pendingPaymentAmount = getPositiveMoneyAmount(pendingPaymentAmountInput)
    ? pendingPaymentAmountInput
    : undefined;
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
