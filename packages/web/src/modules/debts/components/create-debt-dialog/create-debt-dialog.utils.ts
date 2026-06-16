import type { Account } from "@/modules/accounts/account.types";
import { DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { applyBalanceDelta, getDebtInitialAccountBalanceDelta } from "@/shared/lib/balance-domain";
import type { CreateDebtInput } from "@/shared/lib/validations/debt";

import { DebtType } from "../../debt.constants";

export function getCreateDebtDefaultValues(): CreateDebtInput {
  return {
    type: DebtType.LENT,
    personName: "",
    amount: "",
    toAmount: "",
    date: new Date(),
    useAccount: true,
    accountId: "",
    currency: DEFAULT_CURRENCY,
  };
}

export function getDefaultDebtAccount<TAccount extends Pick<Account, "ownerId">>(
  accounts: TAccount[],
  userId?: string
) {
  if (!userId) {
    return undefined;
  }

  return accounts.find((account) => account.ownerId === userId);
}

export function getCreateDebtPreviewAccount<TAccount extends Pick<Account, "balance">>({
  selectedAccount,
  useAccount,
  amount,
  accountAmount,
  debtType,
}: {
  selectedAccount?: TAccount;
  useAccount?: boolean;
  amount?: string;
  accountAmount?: string;
  debtType: string;
}) {
  const balanceAmount = accountAmount || amount;
  if (!selectedAccount || !useAccount || !balanceAmount) {
    return selectedAccount;
  }

  const amountNum = parseFloat(balanceAmount);
  if (Number.isNaN(amountNum)) {
    return selectedAccount;
  }

  return {
    ...selectedAccount,
    balance: applyBalanceDelta(selectedAccount.balance, getDebtInitialAccountBalanceDelta(debtType, balanceAmount)),
  };
}
