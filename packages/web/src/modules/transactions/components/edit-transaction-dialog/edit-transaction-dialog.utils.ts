import type { Account } from "@/modules/accounts/account.types";
import type { Category } from "@/modules/categories/category.types";
import { applyPaymentTransactionBalance, revertPaymentTransactionBalance } from "@/shared/lib/balance-domain";
import type { UpdatePaymentTransactionInput } from "@/shared/lib/validations/transaction";
import type { ComboboxOption } from "@/shared/ui/combobox";

import type { PaymentTransactionWithRelations } from "../../transaction.types";

export function getEditPaymentDefaultValues(
  transaction: PaymentTransactionWithRelations
): UpdatePaymentTransactionInput {
  return {
    accountId: transaction.account.id,
    amount: transaction.amount,
    description: transaction.description || "",
    date: new Date(transaction.date),
    categoryId: transaction.categoryId || null,
  };
}

export function getEditTransactionCategoryOptions(
  categories: Pick<Category, "id" | "name" | "type">[],
  transactionType: string
) {
  return categories
    .filter((category) => category.type === transactionType)
    .map(
      (category): ComboboxOption => ({
        value: category.id,
        label: category.name,
      })
    );
}

export function getPaymentAccountBalanceBeforeEdit(
  selectedAccount: Pick<Account, "id" | "balance"> | undefined,
  transaction: Pick<PaymentTransactionWithRelations, "accountId" | "type" | "amount">
) {
  if (!selectedAccount || selectedAccount.id !== transaction.accountId) {
    return selectedAccount?.balance;
  }

  return revertPaymentTransactionBalance(selectedAccount.balance, transaction.type, transaction.amount);
}

export function getEditPaymentPreviewAccount<TAccount extends Pick<Account, "id" | "balance">>(
  selectedAccount: TAccount | undefined,
  transaction: Pick<PaymentTransactionWithRelations, "accountId" | "type" | "amount">,
  amount?: string
) {
  if (!selectedAccount || !amount) {
    return selectedAccount;
  }

  const amountNum = parseFloat(amount);
  if (Number.isNaN(amountNum)) {
    return selectedAccount;
  }

  const balanceBeforeTransaction = getPaymentAccountBalanceBeforeEdit(selectedAccount, transaction);

  return {
    ...selectedAccount,
    balance: applyPaymentTransactionBalance(
      balanceBeforeTransaction || selectedAccount.balance,
      transaction.type,
      amount
    ),
  };
}
