import { addMoney, compareMoney, normalizeMoneyString, subtractMoney } from "@/shared/utils/money";

import { DebtType } from "../../debt.constants";

const COMPLETE_MONEY_AMOUNT_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

interface AddToDebtSummaryPreviewInput {
  additionalAmount?: string;
  remainingAmount: string;
  totalAmount: string;
}

export function getAddToDebtSummaryPreview({
  additionalAmount,
  remainingAmount,
  totalAmount,
}: AddToDebtSummaryPreviewInput) {
  const normalizedAdditionalAmount = normalizeMoneyString(additionalAmount || "");

  if (
    !COMPLETE_MONEY_AMOUNT_PATTERN.test(normalizedAdditionalAmount) ||
    compareMoney(normalizedAdditionalAmount, "0") <= 0
  ) {
    return { remainingAmount, totalAmount };
  }

  return {
    remainingAmount: addMoney(remainingAmount, normalizedAdditionalAmount),
    totalAmount: addMoney(totalAmount, normalizedAdditionalAmount),
  };
}

export function getAddToDebtPreviewAccount<TAccount extends { balance: string }>({
  selectedAccount,
  accountAmount,
  debtType,
}: {
  selectedAccount?: TAccount;
  accountAmount?: string;
  debtType: string;
}): TAccount | undefined {
  if (!selectedAccount || !accountAmount) {
    return selectedAccount;
  }

  const numericAmount = Number.parseFloat(accountAmount);
  if (!Number.isFinite(numericAmount)) {
    return selectedAccount;
  }

  return {
    ...selectedAccount,
    balance:
      debtType === DebtType.LENT
        ? subtractMoney(selectedAccount.balance, accountAmount)
        : addMoney(selectedAccount.balance, accountAmount),
  };
}
