import type { Account } from "@/modules/accounts/account.types";
import { CategoryType } from "@/modules/categories/category.constants";
import type { Category } from "@/modules/categories/category.types";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import {
  applyBalanceDelta,
  getDebtTransactionBalanceDelta,
  getPaymentTransactionBalanceDelta,
} from "@/shared/lib/balance-domain";
import type { CloseDebtInput } from "@/shared/lib/validations/debt";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { compareMoney, subtractMoney } from "@/shared/utils/money";

import { DebtTransactionType, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

export function getCloseDebtDefaultValues(
  debt: Pick<DebtWithRelations, "remainingAmount" | "accountId">
): CloseDebtInput {
  return {
    amount: debt.remainingAmount,
    paymentAmount: debt.remainingAmount,
    toAmount: "",
    categoryId: undefined,
    closeEarly: false,
    accountId: debt.accountId || "",
    useAccount: true,
  };
}

export function getCloseDebtCategoryType({
  debtType,
  remainingAmount,
  paymentAmount,
  closeEarly,
  currenciesMatch,
}: {
  debtType: string;
  remainingAmount: string;
  paymentAmount?: string;
  closeEarly: boolean;
  currenciesMatch: boolean;
}) {
  if (!currenciesMatch || !paymentAmount) {
    return null;
  }

  if (closeEarly && compareMoney(paymentAmount, remainingAmount) < 0) {
    return debtType === DebtType.LENT ? CategoryType.EXPENSE : CategoryType.INCOME;
  }

  if (compareMoney(paymentAmount, remainingAmount) > 0) {
    return debtType === DebtType.LENT ? CategoryType.INCOME : CategoryType.EXPENSE;
  }

  return null;
}

export function getCloseDebtCategoryAmount({
  remainingAmount,
  paymentAmount,
  closeEarly,
  categoryType,
}: {
  remainingAmount: string;
  paymentAmount?: string;
  closeEarly: boolean;
  categoryType: CategoryType | null;
}) {
  if (!categoryType || !paymentAmount) {
    return "0";
  }

  if (closeEarly && compareMoney(paymentAmount, remainingAmount) < 0) {
    return subtractMoney(remainingAmount, paymentAmount);
  }

  if (compareMoney(paymentAmount, remainingAmount) > 0) {
    return subtractMoney(paymentAmount, remainingAmount);
  }

  return "0";
}

export function getCloseDebtCategoryOptions(categories: Pick<Category, "id" | "name" | "type">[], type: string | null) {
  if (!type) {
    return [];
  }

  return categories
    .filter((category) => category.type === type)
    .map(
      (category): ComboboxOption => ({
        value: category.id,
        label: category.name,
      })
    );
}

function getCategoryPaymentType(categoryType: CategoryType | null) {
  if (!categoryType) {
    return null;
  }

  if (categoryType === CategoryType.INCOME) {
    return PaymentTransactionType.INCOME;
  }

  return PaymentTransactionType.EXPENSE;
}

export function getCloseDebtPreviewAccount<TAccount extends Pick<Account, "balance" | "currency">>({
  selectedAccount,
  debtType,
  debtCurrency,
  closeAmount,
  paymentAmount,
  toAmount,
  closeEarly,
  remainingAmount,
  currenciesMatch,
}: {
  selectedAccount?: TAccount;
  debtType: string;
  debtCurrency: string;
  closeAmount?: string;
  paymentAmount?: string;
  toAmount?: string;
  closeEarly: boolean;
  remainingAmount: string;
  currenciesMatch: boolean;
}) {
  if (!selectedAccount) {
    return selectedAccount;
  }

  const accountAmount = currenciesMatch ? paymentAmount || closeAmount : toAmount;
  if (!accountAmount) {
    return selectedAccount;
  }

  const amountNum = parseFloat(accountAmount);
  if (Number.isNaN(amountNum)) {
    return selectedAccount;
  }

  const categoryType = getCloseDebtCategoryType({
    debtType,
    remainingAmount,
    paymentAmount,
    closeEarly,
    currenciesMatch,
  });
  const categoryAmount = getCloseDebtCategoryAmount({
    remainingAmount,
    paymentAmount,
    closeEarly,
    categoryType,
  });
  const categoryPaymentType = getCategoryPaymentType(categoryType);
  const debtBalanceDelta = getDebtTransactionBalanceDelta(debtType, {
    type: DebtTransactionType.CLOSED,
    amount: closeAmount || remainingAmount,
    toAmount: currenciesMatch ? null : accountAmount,
  });
  const categoryBalanceDelta =
    categoryPaymentType && compareMoney(categoryAmount, "0") > 0
      ? getPaymentTransactionBalanceDelta(categoryPaymentType, categoryAmount)
      : "0";

  const nextBalance = applyBalanceDelta(
    applyBalanceDelta(selectedAccount.balance, debtBalanceDelta),
    categoryBalanceDelta
  );

  if (compareMoney(nextBalance, "0") < 0) {
    return selectedAccount;
  }

  return {
    ...selectedAccount,
    currency: selectedAccount.currency || debtCurrency,
    balance: nextBalance,
  };
}
