import type { Account } from "@prisma/client";

import { DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { applyBalanceDelta, getDebtInitialAccountBalanceDelta } from "@/shared/lib/balance-domain";
import type { CreateDebtInput } from "@/shared/lib/validations/debt";

import { DebtType } from "../../debt.constants";

export function getCreateDebtDefaultValues(): CreateDebtInput {
  return {
    type: DebtType.LENT,
    personName: "",
    amount: "",
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
  debtType,
}: {
  selectedAccount?: TAccount;
  useAccount?: boolean;
  amount?: string;
  debtType: string;
}) {
  if (!selectedAccount || !useAccount || !amount) {
    return selectedAccount;
  }

  const amountNum = parseFloat(amount);
  if (Number.isNaN(amountNum)) {
    return selectedAccount;
  }

  return {
    ...selectedAccount,
    balance: applyBalanceDelta(selectedAccount.balance, getDebtInitialAccountBalanceDelta(debtType, amount)),
  };
}
