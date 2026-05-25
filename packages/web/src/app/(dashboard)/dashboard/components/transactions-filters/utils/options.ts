import { CategoryType } from "@/modules/categories/category.constants";
import {
  DASHBOARD_TRANSACTION_TYPE_LABELS,
  type DashboardTransactionType,
  PaymentTransactionType,
  TRANSFER_TRANSACTION_FILTER_VALUE,
} from "@/modules/transactions/transaction.constants";
import type { SelectOption } from "@/shared/ui/select";

import type { FilterAccount, FilterCategory, FilterMember } from "../types";

export function buildTransactionTypeOptions(): SelectOption<DashboardTransactionType>[] {
  return [
    {
      value: PaymentTransactionType.INCOME,
      label: DASHBOARD_TRANSACTION_TYPE_LABELS[PaymentTransactionType.INCOME],
    },
    {
      value: PaymentTransactionType.EXPENSE,
      label: DASHBOARD_TRANSACTION_TYPE_LABELS[PaymentTransactionType.EXPENSE],
    },
    {
      value: TRANSFER_TRANSACTION_FILTER_VALUE,
      label: DASHBOARD_TRANSACTION_TYPE_LABELS[TRANSFER_TRANSACTION_FILTER_VALUE],
    },
    { value: "debt", label: DASHBOARD_TRANSACTION_TYPE_LABELS.debt },
  ];
}

function getMemberLabel(member: FilterMember) {
  return member.name ? `${member.name} (${member.email})` : member.email;
}

function getAccountLabel(account: FilterAccount) {
  const ownerLabel =
    account.ownerId === null ? "Общий" : account.owner?.name || account.owner?.email || "Без владельца";

  return `${account.name} · ${ownerLabel}`;
}

export function buildMemberOptions(members: FilterMember[]): SelectOption<string>[] {
  return members.map((member) => ({
    value: member.id,
    label: getMemberLabel(member),
  }));
}

export function buildAccountOptions(accounts: FilterAccount[]): SelectOption<string>[] {
  return accounts.map((account) => ({
    value: account.id,
    label: getAccountLabel(account),
  }));
}

export function buildCategoryOptions(categories: FilterCategory[], allowedCategoryTypes: CategoryType[]) {
  const options: SelectOption<string>[] = [];

  if (allowedCategoryTypes.includes(CategoryType.INCOME)) {
    const incomeCategories = categories.filter((category) => category.type === CategoryType.INCOME);

    if (incomeCategories.length > 0) {
      options.push({ value: "__group_income", label: "Доход" });
      incomeCategories.forEach((category) => {
        options.push({
          value: category.id,
          label: category.name,
        });
      });
    }
  }

  if (allowedCategoryTypes.includes(CategoryType.EXPENSE)) {
    const expenseCategories = categories.filter((category) => category.type === CategoryType.EXPENSE);

    if (expenseCategories.length > 0) {
      options.push({ value: "__group_expense", label: "Расход" });
      expenseCategories.forEach((category) => {
        options.push({
          value: category.id,
          label: category.name,
        });
      });
    }
  }

  return options;
}
