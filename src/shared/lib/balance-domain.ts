import { asMoneyAmount, type MoneyAmount, type MoneyInput } from "@/shared/lib/domain-types";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

const PAYMENT_INCOME = "income";
const PAYMENT_EXPENSE = "expense";
const DEBT_LENT = "lent";
const DEBT_CLOSED_TRANSACTION = "closed";

export type DebtBalanceTransaction = {
  type: string;
  amount: MoneyInput;
  toAmount?: MoneyInput | null;
  accountId?: string | null;
};

export type DebtTransactionTotalsDelta = {
  amountDelta: MoneyAmount;
  remainingDelta: MoneyAmount;
};

export function applyBalanceDelta(balance: MoneyInput, delta: MoneyInput): MoneyAmount {
  return addMoney(balance, delta);
}

export function getPaymentTransactionBalanceDelta(type: string, amount: MoneyInput): MoneyAmount {
  if (type === PAYMENT_INCOME) {
    return asMoneyAmount(amount);
  }

  if (type === PAYMENT_EXPENSE) {
    return subtractMoney("0", amount);
  }

  return asMoneyAmount("0");
}

export function applyPaymentTransactionBalance(balance: MoneyInput, type: string, amount: MoneyInput): MoneyAmount {
  return applyBalanceDelta(balance, getPaymentTransactionBalanceDelta(type, amount));
}

export function revertPaymentTransactionBalance(balance: MoneyInput, type: string, amount: MoneyInput): MoneyAmount {
  return applyBalanceDelta(balance, subtractMoney("0", getPaymentTransactionBalanceDelta(type, amount)));
}

export function getTransferTransactionBalanceDeltas(amount: MoneyInput, toAmount: MoneyInput) {
  return {
    fromDelta: subtractMoney("0", amount),
    toDelta: asMoneyAmount(toAmount),
  };
}

export function getDebtInitialAccountBalanceDelta(debtType: string, amount: MoneyInput): MoneyAmount {
  return debtType === DEBT_LENT ? subtractMoney("0", amount) : asMoneyAmount(amount);
}

export function getDebtTransactionAccountAmount(transaction: DebtBalanceTransaction): MoneyAmount {
  return transaction.type === DEBT_CLOSED_TRANSACTION
    ? asMoneyAmount(transaction.toAmount || transaction.amount)
    : asMoneyAmount(transaction.amount);
}

export function getDebtTransactionBalanceDelta(debtType: string, transaction: DebtBalanceTransaction): MoneyAmount {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DEBT_CLOSED_TRANSACTION) {
    return debtType === DEBT_LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return getDebtInitialAccountBalanceDelta(debtType, accountAmount);
}

export function getDebtDeletionBalanceDelta(debtType: string, transaction: DebtBalanceTransaction): MoneyAmount {
  return subtractMoney("0", getDebtTransactionBalanceDelta(debtType, transaction));
}

export function getDebtTransactionTotalsDelta(transactionType: string, amount: MoneyInput): DebtTransactionTotalsDelta {
  if (transactionType === DEBT_CLOSED_TRANSACTION) {
    return {
      amountDelta: asMoneyAmount("0"),
      remainingDelta: subtractMoney("0", amount),
    };
  }

  return {
    amountDelta: asMoneyAmount(amount),
    remainingDelta: asMoneyAmount(amount),
  };
}

export function addAccountBalanceDelta(
  balanceDeltasByAccount: Map<string, string>,
  accountId: string | null | undefined,
  delta: MoneyInput
) {
  if (!accountId || compareMoney(delta, "0") === 0) {
    return;
  }

  const currentDelta = balanceDeltasByAccount.get(accountId) || "0";
  balanceDeltasByAccount.set(accountId, addMoney(currentDelta, delta));
}

export function assertNonNegativeBalance(balance: MoneyInput, message: string) {
  if (compareMoney(balance, "0") < 0) {
    throw new Error(message);
  }
}
