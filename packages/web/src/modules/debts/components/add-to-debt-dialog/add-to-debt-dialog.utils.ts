import { addMoney, subtractMoney } from "@/shared/utils/money";

import { DebtType } from "../../debt.constants";

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
