import { getDebtTransactionBalanceDelta } from "@/shared/lib/balance-domain";
import type { UpdateDebtTransactionInput } from "@/shared/lib/validations/debt";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { DebtTransactionType, DebtType } from "../../debt.constants";
import type { DebtTransactionWithRelations } from "../../debt.types";

interface GetPreviewDebtTransactionAccountParams<TAccount extends { id: string; balance: string; currency: string }> {
  debtTransaction: DebtTransactionWithRelations;
  selectedAccount?: TAccount;
  amount?: string;
  toAmount?: string;
  currenciesMatch: boolean;
}

export function getEditDebtTransactionDefaultValues(
  debtTransaction: DebtTransactionWithRelations
): UpdateDebtTransactionInput {
  return {
    amount: debtTransaction.amount,
    toAmount: debtTransaction.toAmount || "",
    accountId: debtTransaction.accountId || "",
    date: new Date(debtTransaction.date),
  };
}

export function getEditDebtTransactionTitle(transactionType: string) {
  return transactionType === DebtTransactionType.CLOSED
    ? "Редактировать погашение долга"
    : "Редактировать добавление к долгу";
}

export function getEditDebtTransactionDescription(transactionType: string) {
  return transactionType === DebtTransactionType.CLOSED
    ? "Измените параметры погашения долга."
    : "Измените сумму и дату добавления к долгу.";
}

export function getEditDebtAmountLabel({
  debtTransaction,
  selectedAccount,
  currenciesMatch,
}: {
  debtTransaction: DebtTransactionWithRelations;
  selectedAccount?: { currency: string };
  currenciesMatch: boolean;
}) {
  if (debtTransaction.type !== DebtTransactionType.CLOSED) {
    return `Сумма (${debtTransaction.debt.currency})`;
  }

  if (currenciesMatch || !selectedAccount) {
    return `Сумма к закрытию (${debtTransaction.debt.currency})`;
  }

  return debtTransaction.debt.type === DebtType.LENT
    ? `Сумма получения (${debtTransaction.debt.currency})`
    : `Сумма к закрытию (${debtTransaction.debt.currency})`;
}

export function getPreviewDebtTransactionAccount<TAccount extends { id: string; balance: string; currency: string }>({
  debtTransaction,
  selectedAccount,
  amount,
  toAmount,
  currenciesMatch,
}: GetPreviewDebtTransactionAccountParams<TAccount>): TAccount | undefined {
  if (!selectedAccount) {
    return selectedAccount;
  }

  const nextAmount = amount || debtTransaction.amount;
  const nextToAmount = selectedAccount && !currenciesMatch ? toAmount || null : null;

  if (
    compareMoney(nextAmount || "0", "0") <= 0 ||
    (selectedAccount && !currenciesMatch && (!nextToAmount || compareMoney(nextToAmount, "0") <= 0))
  ) {
    return selectedAccount;
  }

  const oldBalanceDelta =
    debtTransaction.accountId === selectedAccount.id
      ? getDebtTransactionBalanceDelta(debtTransaction.debt.type, debtTransaction)
      : "0";
  const nextBalanceDelta = getDebtTransactionBalanceDelta(debtTransaction.debt.type, {
    type: debtTransaction.type,
    amount: nextAmount,
    toAmount: nextToAmount,
  });
  const nextBalance = addMoney(selectedAccount.balance, subtractMoney(nextBalanceDelta, oldBalanceDelta));

  if (compareMoney(nextBalance, "0") < 0) {
    return selectedAccount;
  }

  return {
    ...selectedAccount,
    balance: nextBalance,
  };
}
