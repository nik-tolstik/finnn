import { CategoryType } from "@/modules/categories/category.constants";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import type { DebtWriteOffInput } from "@/shared/lib/validations/debt";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { addMoney, compareMoney, subtractMoney } from "@/shared/utils/money";

import { DebtStatus, DebtType } from "../../debt.constants";
import type { DebtWithRelations, DebtWriteOffPaymentTransaction } from "../../debt.types";

export type DebtWriteOffDebt = Pick<
  DebtWithRelations,
  "id" | "workspaceId" | "type" | "personName" | "remainingAmount" | "currency" | "status"
>;

export function getDebtWriteOffDebt({
  debt,
  transaction,
}: {
  debt?: DebtWriteOffDebt;
  transaction?: DebtWriteOffPaymentTransaction;
}): DebtWriteOffDebt {
  if (debt) {
    return debt;
  }

  if (!transaction) {
    throw new Error("Debt or debt write-off transaction is required");
  }

  return {
    id: transaction.debtWriteOff.debtId,
    workspaceId: transaction.workspaceId,
    type: transaction.debtWriteOff.debtType,
    personName: transaction.debtWriteOff.personName,
    remainingAmount: transaction.debtWriteOff.remainingAmount,
    currency: transaction.debtWriteOff.debtCurrency,
    status: transaction.debtWriteOff.status,
  };
}

export function getDebtWriteOffType(debtType: string) {
  return debtType === DebtType.LENT ? PaymentTransactionType.EXPENSE : PaymentTransactionType.INCOME;
}

export function getDebtWriteOffCategoryType(debtType: string) {
  return debtType === DebtType.LENT ? CategoryType.EXPENSE : CategoryType.INCOME;
}

export function getDebtWriteOffDescription(personName: string) {
  return `Погашение долга: ${personName}`;
}

export function getDebtWriteOffDefaultValues({
  debt,
  transaction,
  now = new Date(),
}: {
  debt: DebtWriteOffDebt;
  transaction?: DebtWriteOffPaymentTransaction;
  now?: Date;
}): DebtWriteOffInput {
  if (!transaction) {
    return {
      amount: debt.remainingAmount,
      toAmount: "",
      accountId: "",
      categoryId: "",
      date: now,
      description: getDebtWriteOffDescription(debt.personName),
    };
  }

  return {
    amount: transaction.debtWriteOff.amount,
    toAmount: transaction.account.currency === debt.currency ? "" : transaction.amount,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId || "",
    date: new Date(transaction.date),
    description: transaction.description || getDebtWriteOffDescription(debt.personName),
  };
}

export function getDebtWriteOffMaximumAmount(
  debt: Pick<DebtWriteOffDebt, "remainingAmount">,
  transaction?: Pick<DebtWriteOffPaymentTransaction, "debtWriteOff">
) {
  return transaction ? addMoney(debt.remainingAmount, transaction.debtWriteOff.amount) : debt.remainingAmount;
}

export function getDebtWriteOffRemainingAmount({
  debt,
  amount,
  transaction,
}: {
  debt: Pick<DebtWriteOffDebt, "remainingAmount">;
  amount: string;
  transaction?: Pick<DebtWriteOffPaymentTransaction, "debtWriteOff">;
}) {
  const availableAmount = getDebtWriteOffMaximumAmount(debt, transaction);
  return subtractMoney(availableAmount, amount);
}

export function getDebtWriteOffStatus(remainingAmount: string) {
  return compareMoney(remainingAmount, "0") <= 0 ? DebtStatus.CLOSED : DebtStatus.OPEN;
}

export function isDebtWriteOffAmountWithinLimit(amount: string, maximumAmount: string) {
  return compareMoney(amount, "0") > 0 && compareMoney(amount, maximumAmount) <= 0;
}

export function getDebtWriteOffCategoryOptions(
  categories: { id: string; name: string; type: string }[],
  debtType: string
): ComboboxOption[] {
  const categoryType = getDebtWriteOffCategoryType(debtType);

  return categories
    .filter((category) => category.type === categoryType)
    .map((category) => ({ value: category.id, label: category.name }));
}

export function isDateBeforeAccountCreation(date: Date, accountCreatedAt: Date) {
  const transactionDate = new Date(date);
  const createdDate = new Date(accountCreatedAt);
  transactionDate.setHours(0, 0, 0, 0);
  createdDate.setHours(0, 0, 0, 0);
  return transactionDate < createdDate;
}

export function hasDebtWriteOff<T extends { debtWriteOff?: unknown }>(
  transaction: T
): transaction is T & { debtWriteOff: DebtWriteOffPaymentTransaction["debtWriteOff"] } {
  return Boolean(transaction.debtWriteOff);
}
