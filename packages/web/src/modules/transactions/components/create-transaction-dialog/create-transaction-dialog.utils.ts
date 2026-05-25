import type { Account, Category } from "@prisma/client";

import { applyPaymentTransactionBalance } from "@/shared/lib/balance-domain";
import type {
  CreatePaymentTransactionInput,
  CreateTransferTransactionInput,
} from "@/shared/lib/validations/transaction";
import type { ComboboxOption } from "@/shared/ui/combobox";

import type { PaymentTransactionType } from "../../transaction.constants";

export const TRANSFER_TRANSACTION_MODE = "transfer" as const;

export type CreateTransactionMode =
  | PaymentTransactionType.INCOME
  | PaymentTransactionType.EXPENSE
  | typeof TRANSFER_TRANSACTION_MODE;

type AccountOption = Account | (Partial<Account> & { id: string });

type AccountWithRequiredFields = AccountOption & {
  id: string;
  balance: string;
  createdAt: Date;
};

export function hasAccountBalance(account?: AccountOption): account is AccountWithRequiredFields {
  return Boolean(account && "balance" in account && account.balance !== undefined);
}

export function getInitialTransactionDate(account?: Pick<Account, "createdAt">, initialDate?: Date) {
  if (initialDate) {
    return initialDate;
  }

  const now = new Date();
  if (!account?.createdAt) {
    return now;
  }

  const accountCreatedDate = new Date(account.createdAt);
  accountCreatedDate.setHours(0, 0, 0, 0);
  const nowDateOnly = new Date(now);
  nowDateOnly.setHours(0, 0, 0, 0);

  if (nowDateOnly >= accountCreatedDate) {
    return now;
  }

  const result = new Date(accountCreatedDate);
  result.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return result;
}

export function resolveDefaultAccount({
  accountProp,
  accounts,
  userId,
}: {
  accountProp?: AccountOption;
  accounts?: Account[];
  userId?: string;
}) {
  if (accountProp) {
    if (!hasAccountBalance(accountProp) && accounts) {
      const fullAccount = accounts.find((account) => account.id === accountProp.id);
      if (fullAccount) {
        return fullAccount;
      }
    }

    if (hasAccountBalance(accountProp) && "createdAt" in accountProp) {
      return accountProp as Account;
    }

    return undefined;
  }

  if (!accounts || !userId) {
    return undefined;
  }

  return accounts.find((account) => account.ownerId === userId);
}

export function resolveSelectedAccount({
  accountProp,
  accounts,
  accountId,
  fallbackAccount,
}: {
  accountProp?: AccountOption;
  accounts?: Account[];
  accountId?: string;
  fallbackAccount?: Account;
}) {
  if (accountProp) {
    if (!hasAccountBalance(accountProp) && accounts) {
      const fullAccount = accounts.find((account) => account.id === accountProp.id);
      if (fullAccount) {
        return fullAccount;
      }
    }

    return hasAccountBalance(accountProp) ? (accountProp as Account) : undefined;
  }

  if (accountId && accounts) {
    return accounts.find((account) => account.id === accountId);
  }

  return fallbackAccount;
}

export function getCreatePaymentDefaultValues({
  accountId,
  defaultType,
  initialAmount,
  initialDescription,
  initialDate,
  initialCategoryId,
  account,
}: {
  accountId: string;
  defaultType: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
  initialAmount?: string;
  initialDescription?: string;
  initialDate?: Date;
  initialCategoryId?: string;
  account?: Pick<Account, "createdAt">;
}): CreatePaymentTransactionInput {
  return {
    accountId,
    amount: initialAmount || "",
    type: defaultType,
    description: initialDescription || "",
    date: getInitialTransactionDate(account, initialDate),
    categoryId: initialCategoryId || undefined,
    newCategory: undefined,
  };
}

export function getCreateTransferDefaultValues(accountId: string): CreateTransferTransactionInput {
  return {
    fromAccountId: accountId,
    toAccountId: "",
    amount: "",
    toAmount: "",
    description: "",
    date: new Date(),
  };
}

export function getPreviewPaymentAccount<TAccount extends { balance?: string }>(
  account: TAccount | undefined,
  type: string,
  amount?: string
) {
  if (!account?.balance || !amount) {
    return account;
  }

  const amountNum = parseFloat(amount);
  if (Number.isNaN(amountNum)) {
    return account;
  }

  return {
    ...account,
    balance: applyPaymentTransactionBalance(account.balance, type, amount),
  };
}

export function getCategoryOptions(categories: Pick<Category, "id" | "name" | "type">[], type: string) {
  return categories
    .filter((category) => category.type === type)
    .map(
      (category): ComboboxOption => ({
        value: category.id,
        label: category.name,
      })
    );
}
