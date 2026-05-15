import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { formatMoney } from "@/shared/utils/money";

import { PaymentTransactionType } from "../../../transaction.constants";
import type { PaymentTransactionWithRelations, TransferTransactionWithRelations } from "../../../transaction.types";

interface TransactionAmountDisplay {
  text: string;
  className: string;
}

const TRANSFER_AMOUNT_CLASS_NAME = "text-amber-600 dark:text-amber-400";

function addSign(text: string, isPositive: boolean): string {
  return `${isPositive ? "+" : "-"}${text}`;
}

export function getPaymentTransactionAmountDisplay(
  transaction: PaymentTransactionWithRelations
): TransactionAmountDisplay {
  const isIncome = transaction.type === PaymentTransactionType.INCOME;

  return {
    text: addSign(formatMoney(transaction.amount, transaction.account.currency), isIncome),
    className: isIncome ? "text-success" : "text-destructive",
  };
}

export function getTransferTransactionAmountDisplay(
  transaction: TransferTransactionWithRelations
): TransactionAmountDisplay {
  const fromAmount = formatMoney(transaction.amount, transaction.fromAccount.currency);

  if (transaction.fromAccount.currency === transaction.toAccount.currency) {
    return {
      text: fromAmount,
      className: TRANSFER_AMOUNT_CLASS_NAME,
    };
  }

  return {
    text: `${fromAmount} ⇄ ${formatMoney(transaction.toAmount, transaction.toAccount.currency)}`,
    className: TRANSFER_AMOUNT_CLASS_NAME,
  };
}

function getDebtAmountText(debtTransaction: DebtTransactionWithRelations): string {
  const debtAmountText = formatMoney(debtTransaction.amount, debtTransaction.debt.currency);

  if (
    debtTransaction.type !== DebtTransactionType.CLOSED ||
    !debtTransaction.account ||
    !debtTransaction.toAmount ||
    debtTransaction.account.currency === debtTransaction.debt.currency
  ) {
    return debtAmountText;
  }

  return `${debtAmountText} ⇄ ${formatMoney(debtTransaction.toAmount, debtTransaction.account.currency)}`;
}

export function getDebtTransactionAmountDisplay(
  debtTransaction: DebtTransactionWithRelations
): TransactionAmountDisplay {
  const isPositive =
    (debtTransaction.debt.type === DebtType.LENT && debtTransaction.type === DebtTransactionType.CLOSED) ||
    (debtTransaction.debt.type === DebtType.BORROWED && debtTransaction.type !== DebtTransactionType.CLOSED);

  return {
    text: addSign(getDebtAmountText(debtTransaction), isPositive),
    className: isPositive ? "text-success" : "text-destructive",
  };
}
