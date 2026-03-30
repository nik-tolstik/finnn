import { CategoryType } from "@/modules/categories/category.constants";
import {
  type DashboardTransactionType,
  DEBT_TRANSACTION_FILTER_VALUE,
  PaymentTransactionType,
  TRANSFER_TRANSACTION_FILTER_VALUE,
} from "@/modules/transactions/transaction.constants";

import type { DashboardTransactionFilters } from "../types";

export const TRANSACTION_FILTER_QUERY_PARAM_NAMES = [
  "amountFrom",
  "amountTo",
  "userId",
  "transactionType",
  "categoryId",
  "accountId",
  "description",
  "dateFrom",
  "dateTo",
] as const;

export type SearchParamsLike = Pick<URLSearchParams, "get" | "getAll" | "toString">;

function normalizeStringArray(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeAmountValue(value?: string | null) {
  if (!value) {
    return undefined;
  }

  let normalized = value
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "");
  const parts = normalized.split(".");

  if (parts.length > 2) {
    normalized = `${parts[0]}.${parts.slice(1).join("")}`;
  }

  return normalized || undefined;
}

function normalizeDescriptionValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeDateValue(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return normalized;
}

function normalizeTransactionTypes(values: string[]) {
  const validValues = values.filter(
    (value): value is DashboardTransactionType =>
      value === PaymentTransactionType.INCOME ||
      value === PaymentTransactionType.EXPENSE ||
      value === TRANSFER_TRANSACTION_FILTER_VALUE ||
      value === DEBT_TRANSACTION_FILTER_VALUE
  );

  return normalizeStringArray(validValues) as DashboardTransactionType[];
}

export function normalizeTransactionFilters(filters: DashboardTransactionFilters): DashboardTransactionFilters {
  const normalized: DashboardTransactionFilters = {
    amountFrom: normalizeAmountValue(filters.amountFrom),
    amountTo: normalizeAmountValue(filters.amountTo),
    userIds: normalizeStringArray(filters.userIds || []),
    transactionTypes: normalizeTransactionTypes(filters.transactionTypes || []),
    categoryIds: normalizeStringArray(filters.categoryIds || []),
    accountIds: normalizeStringArray(filters.accountIds || []),
    description: normalizeDescriptionValue(filters.description),
    dateFrom: normalizeDateValue(filters.dateFrom),
    dateTo: normalizeDateValue(filters.dateTo),
  };

  return {
    amountFrom: normalized.amountFrom,
    amountTo: normalized.amountTo,
    userIds: normalized.userIds?.length ? normalized.userIds : undefined,
    transactionTypes: normalized.transactionTypes?.length ? normalized.transactionTypes : undefined,
    categoryIds: normalized.categoryIds?.length ? normalized.categoryIds : undefined,
    accountIds: normalized.accountIds?.length ? normalized.accountIds : undefined,
    description: normalized.description,
    dateFrom: normalized.dateFrom,
    dateTo: normalized.dateTo,
  };
}

export function parseTransactionFilters(searchParams: SearchParamsLike): DashboardTransactionFilters {
  return normalizeTransactionFilters({
    amountFrom: searchParams.get("amountFrom") ?? undefined,
    amountTo: searchParams.get("amountTo") ?? undefined,
    userIds: searchParams.getAll("userId"),
    transactionTypes: searchParams.getAll("transactionType") as DashboardTransactionType[],
    categoryIds: searchParams.getAll("categoryId"),
    accountIds: searchParams.getAll("accountId"),
    description: searchParams.get("description") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });
}

export function applyTransactionFiltersToSearchParams(
  searchParams: SearchParamsLike,
  filters: DashboardTransactionFilters
) {
  const params = new URLSearchParams(searchParams.toString());
  const normalizedFilters = normalizeTransactionFilters(filters);

  TRANSACTION_FILTER_QUERY_PARAM_NAMES.forEach((paramName) => {
    params.delete(paramName);
  });

  if (normalizedFilters.amountFrom) {
    params.set("amountFrom", normalizedFilters.amountFrom);
  }

  if (normalizedFilters.amountTo) {
    params.set("amountTo", normalizedFilters.amountTo);
  }

  if (normalizedFilters.description) {
    params.set("description", normalizedFilters.description);
  }

  if (normalizedFilters.dateFrom) {
    params.set("dateFrom", normalizedFilters.dateFrom);
  }

  if (normalizedFilters.dateTo) {
    params.set("dateTo", normalizedFilters.dateTo);
  }

  normalizedFilters.userIds?.forEach((userId) => {
    params.append("userId", userId);
  });

  normalizedFilters.transactionTypes?.forEach((transactionType) => {
    params.append("transactionType", transactionType);
  });

  normalizedFilters.categoryIds?.forEach((categoryId) => {
    params.append("categoryId", categoryId);
  });

  normalizedFilters.accountIds?.forEach((accountId) => {
    params.append("accountId", accountId);
  });

  return params;
}

export function countActiveTransactionFilterGroups(filters: DashboardTransactionFilters) {
  const normalizedFilters = normalizeTransactionFilters(filters);

  return [
    Boolean(normalizedFilters.amountFrom || normalizedFilters.amountTo),
    Boolean(normalizedFilters.userIds?.length),
    Boolean(normalizedFilters.transactionTypes?.length),
    Boolean(normalizedFilters.categoryIds?.length),
    Boolean(normalizedFilters.accountIds?.length),
    Boolean(normalizedFilters.description),
    Boolean(normalizedFilters.dateFrom || normalizedFilters.dateTo),
  ].filter(Boolean).length;
}

export function getAllowedCategoryTypes(transactionTypes?: DashboardTransactionType[]) {
  if (!transactionTypes?.length) {
    return [CategoryType.INCOME, CategoryType.EXPENSE];
  }

  const allowedCategoryTypes: CategoryType[] = [];

  if (transactionTypes.includes(PaymentTransactionType.INCOME)) {
    allowedCategoryTypes.push(CategoryType.INCOME);
  }

  if (transactionTypes.includes(PaymentTransactionType.EXPENSE)) {
    allowedCategoryTypes.push(CategoryType.EXPENSE);
  }

  return allowedCategoryTypes;
}

export function shouldIncludeDebtTransactions(transactionTypes?: DashboardTransactionType[]) {
  if (!transactionTypes?.length) {
    return true;
  }

  return transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
}
