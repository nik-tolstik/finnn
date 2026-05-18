import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

const PAYMENT_INCOME = "income";
const PAYMENT_EXPENSE = "expense";
const DEBT_LENT = "lent";
const DEBT_CLOSED_TRANSACTION = "closed";

export type DebtBalanceTransaction = {
  type: string;
  amount: string;
  toAmount?: string | null;
  accountId?: string | null;
};

export type DebtTransactionTotalsDelta = {
  amountDelta: string;
  remainingDelta: string;
};

export function applyBalanceDelta(balance: string, delta: string) {
  return addMoney(balance, delta);
}

export function getPaymentTransactionBalanceDelta(type: string, amount: string) {
  if (type === PAYMENT_INCOME) {
    return amount;
  }

  if (type === PAYMENT_EXPENSE) {
    return subtractMoney("0", amount);
  }

  return "0";
}

export function applyPaymentTransactionBalance(balance: string, type: string, amount: string) {
  return applyBalanceDelta(balance, getPaymentTransactionBalanceDelta(type, amount));
}

export function revertPaymentTransactionBalance(balance: string, type: string, amount: string) {
  return applyBalanceDelta(balance, subtractMoney("0", getPaymentTransactionBalanceDelta(type, amount)));
}

export function getTransferTransactionBalanceDeltas(amount: string, toAmount: string) {
  return {
    fromDelta: subtractMoney("0", amount),
    toDelta: toAmount,
  };
}

export function getDebtInitialAccountBalanceDelta(debtType: string, amount: string) {
  return debtType === DEBT_LENT ? subtractMoney("0", amount) : amount;
}

export function getDebtTransactionAccountAmount(transaction: DebtBalanceTransaction) {
  return transaction.type === DEBT_CLOSED_TRANSACTION ? transaction.toAmount || transaction.amount : transaction.amount;
}

export function getDebtTransactionBalanceDelta(debtType: string, transaction: DebtBalanceTransaction) {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DEBT_CLOSED_TRANSACTION) {
    return debtType === DEBT_LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return getDebtInitialAccountBalanceDelta(debtType, accountAmount);
}

export function getDebtDeletionBalanceDelta(debtType: string, transaction: DebtBalanceTransaction) {
  return subtractMoney("0", getDebtTransactionBalanceDelta(debtType, transaction));
}

export function getDebtTransactionTotalsDelta(transactionType: string, amount: string): DebtTransactionTotalsDelta {
  if (transactionType === DEBT_CLOSED_TRANSACTION) {
    return {
      amountDelta: "0",
      remainingDelta: subtractMoney("0", amount),
    };
  }

  return {
    amountDelta: amount,
    remainingDelta: amount,
  };
}

export function addAccountBalanceDelta(
  balanceDeltasByAccount: Map<string, string>,
  accountId: string | null | undefined,
  delta: string
) {
  if (!accountId || compareMoney(delta, "0") === 0) {
    return;
  }

  const currentDelta = balanceDeltasByAccount.get(accountId) || "0";
  balanceDeltasByAccount.set(accountId, addMoney(currentDelta, delta));
}

export function assertNonNegativeBalance(balance: string, message: string) {
  if (compareMoney(balance, "0") < 0) {
    throw new Error(message);
  }
}
