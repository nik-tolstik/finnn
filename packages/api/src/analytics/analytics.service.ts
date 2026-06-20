import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type {
  Account,
  Category,
  Currency,
  Debt,
  DebtTransaction,
  PaymentTransaction,
  Prisma,
  TransferTransaction,
  User,
} from "@prisma/client";
import Big from "big.js";

import { compareMoney, formatMoney } from "@/common/money";
import { type ExchangeRateRequest, ExchangeRateService } from "@/currency/exchange-rate.service";
import { PrismaService } from "@/prisma/prisma.service";

import type { AnalyticsOverviewQueryDto } from "./analytics.dto";

const ANALYTICS_DEFAULT_DAY_COUNT = 30;
const PAYMENT_INCOME = "income";
const TRANSFER_TRANSACTION_FILTER_VALUE = "transfer";
const DEBT_TRANSACTION_FILTER_VALUE = "debt";
const DEBT_OPEN = "open";
const DEBT_LENT = "lent";
const DEBT_BORROWED = "borrowed";
const DEBT_TRANSACTION_CREATED = "created";
const DEBT_TRANSACTION_CLOSED = "closed";
const DEBT_TRANSACTION_ADDED = "added";

const ACCOUNT_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

const ACCOUNT_WITH_OWNER_SELECT = {
  id: true,
  name: true,
  currency: true,
  color: true,
  icon: true,
  ownerId: true,
  owner: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.AccountSelect;

const CAPITAL_ACCOUNT_SELECT = {
  id: true,
  balance: true,
  currency: true,
  ownerId: true,
  createdAt: true,
} satisfies Prisma.AccountSelect;

const CATEGORY_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const PAYMENT_TRANSACTION_INCLUDE = {
  account: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  category: {
    select: CATEGORY_SELECT,
  },
} satisfies Prisma.PaymentTransactionInclude;

const TRANSFER_TRANSACTION_INCLUDE = {
  fromAccount: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  toAccount: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
  createdBy: {
    select: ACCOUNT_OWNER_SELECT,
  },
} satisfies Prisma.TransferTransactionInclude;

const DEBT_TRANSACTION_INCLUDE = {
  debt: {
    select: {
      id: true,
      workspaceId: true,
      type: true,
      personName: true,
      amount: true,
      remainingAmount: true,
      currency: true,
      date: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  account: {
    select: ACCOUNT_WITH_OWNER_SELECT,
  },
} satisfies Prisma.DebtTransactionInclude;

type TransactionUser = Pick<User, "id" | "name" | "email" | "image">;
type TransactionAccount = Pick<Account, "id" | "name" | "currency" | "color" | "icon" | "ownerId"> & {
  owner: TransactionUser | null;
};
type CapitalAccount = Pick<Account, "id" | "balance" | "currency" | "ownerId" | "createdAt">;
type TransactionCategory = Pick<Category, "id" | "name">;
type PaymentTransactionWithRelations = PaymentTransaction & {
  account: TransactionAccount;
  category: TransactionCategory | null;
};
type TransferTransactionWithRelations = TransferTransaction & {
  fromAccount: TransactionAccount;
  toAccount: TransactionAccount;
  createdBy: TransactionUser | null;
};
type DebtTransactionWithRelations = DebtTransaction & {
  debt: Pick<
    Debt,
    | "id"
    | "workspaceId"
    | "type"
    | "personName"
    | "amount"
    | "remainingAmount"
    | "currency"
    | "date"
    | "status"
    | "createdAt"
    | "updatedAt"
  >;
  account: TransactionAccount | null;
};
type CombinedTransaction =
  | { kind: "paymentTransaction"; data: PaymentTransactionWithRelations }
  | { kind: "transferTransaction"; data: TransferTransactionWithRelations }
  | { kind: "debtTransaction"; data: DebtTransactionWithRelations };
type AnalyticsDateRange = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  dayCount: number;
  isImplicit: boolean;
};
type AnalyticsCategoryTotal = {
  id: string;
  name: string;
  totalInBaseCurrency: string;
  transactionCount: number;
};
type AnalyticsCalendarDayBucket = {
  date: string;
  incomeTotalInBaseCurrency: string;
  expenseTotalInBaseCurrency: string;
  netTotalInBaseCurrency: string;
  transactionCount: number;
};
type AnalyticsDebtByPerson = {
  personName: string;
  lentTotalInBaseCurrency: string;
  borrowedTotalInBaseCurrency: string;
  netExposureInBaseCurrency: string;
  debtCount: number;
};
type AnalyticsLargestMovement = {
  id: string;
  kind: CombinedTransaction["kind"];
  kindLabel: string;
  date: string;
  primaryLabel: string;
  secondaryLabel: string;
  originalAmount: string;
  amountInBaseCurrency: string;
};
type ConvertedMovement = AnalyticsLargestMovement & {
  sortAmountInBaseCurrency: string;
};
type CapitalBalanceDelta = {
  accountId: string;
  date: Date;
  delta: string;
};

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function subDays(date: Date, days: number) {
  return addDays(date, -days);
}

function differenceInCalendarDays(left: Date, right: Date) {
  const leftDay = startOfDay(left).getTime();
  const rightDay = startOfDay(right).getTime();
  return Math.round((leftDay - rightDay) / 86_400_000);
}

function toDateString(value?: Date) {
  if (!value) {
    return undefined;
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeRange(start: Date, end: Date) {
  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return { start: startOfDay(end), end: endOfDay(start) };
}

function resolveAnalyticsDateRange(
  filters: Pick<AnalyticsOverviewQueryDto, "dateFrom" | "dateTo">,
  referenceDate = new Date()
): AnalyticsDateRange {
  const referenceEnd = endOfDay(referenceDate);
  const explicitStart = filters.dateFrom ? startOfDay(new Date(`${filters.dateFrom}T00:00:00`)) : null;
  const explicitEnd = filters.dateTo ? endOfDay(new Date(`${filters.dateTo}T00:00:00`)) : null;

  let start: Date;
  let end: Date;
  let isImplicit = false;

  if (explicitStart && explicitEnd) {
    start = explicitStart;
    end = explicitEnd;
  } else if (explicitStart) {
    start = explicitStart;
    end = referenceEnd;
  } else if (explicitEnd) {
    end = explicitEnd;
    start = startOfDay(subDays(end, ANALYTICS_DEFAULT_DAY_COUNT - 1));
  } else {
    end = referenceEnd;
    start = startOfDay(subDays(end, ANALYTICS_DEFAULT_DAY_COUNT - 1));
    isImplicit = true;
  }

  const normalized = normalizeRange(start, end);
  const dayCount = differenceInCalendarDays(normalized.end, normalized.start) + 1;

  return {
    start: normalized.start,
    end: normalized.end,
    startDate: toDateString(normalized.start) ?? toDateString(referenceDate) ?? "",
    endDate: toDateString(normalized.end) ?? toDateString(referenceDate) ?? "",
    dayCount,
    isImplicit,
  };
}

function resolvePreviousAnalyticsDateRange(range: AnalyticsDateRange): AnalyticsDateRange {
  const previousEnd = endOfDay(subDays(range.start, 1));
  const previousStart = startOfDay(subDays(previousEnd, range.dayCount - 1));

  return {
    start: previousStart,
    end: previousEnd,
    startDate: toDateString(previousStart) ?? "",
    endDate: toDateString(previousEnd) ?? "",
    dayCount: range.dayCount,
    isImplicit: false,
  };
}

function resolveAnalyticsCalendarDateRange(
  filters: Pick<AnalyticsOverviewQueryDto, "dateFrom" | "dateTo">,
  referenceDate = new Date()
): AnalyticsDateRange {
  const explicitStart = filters.dateFrom ? startOfDay(new Date(`${filters.dateFrom}T00:00:00`)) : null;
  const explicitEnd = filters.dateTo ? endOfDay(new Date(`${filters.dateTo}T00:00:00`)) : null;

  if (explicitStart && explicitEnd) {
    const normalized = normalizeRange(explicitStart, explicitEnd);

    return {
      start: normalized.start,
      end: normalized.end,
      startDate: toDateString(normalized.start) ?? "",
      endDate: toDateString(normalized.end) ?? "",
      dayCount: differenceInCalendarDays(normalized.end, normalized.start) + 1,
      isImplicit: false,
    };
  }

  const monthDate = explicitStart ?? explicitEnd ?? referenceDate;
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);

  return {
    start,
    end,
    startDate: toDateString(start) ?? "",
    endDate: toDateString(end) ?? "",
    dayCount: differenceInCalendarDays(end, start) + 1,
    isImplicit: !explicitStart && !explicitEnd,
  };
}

function applyAnalyticsDateRangeToFilters(
  filters: AnalyticsOverviewQueryDto,
  range: AnalyticsDateRange
): AnalyticsOverviewQueryDto {
  return {
    ...filters,
    dateFrom: range.startDate,
    dateTo: range.endDate,
  };
}

function getPreviousPeriodPercentageChange(current: string, previous: string): number | null {
  if (new Big(previous).eq(0)) {
    return new Big(current).eq(0) ? 0 : null;
  }

  return Number(new Big(current).minus(previous).div(previous).times(100).toFixed(1));
}

function buildInclusiveDateRangeDates(range: AnalyticsDateRange) {
  return Array.from({ length: range.dayCount }, (_value, index) => startOfDay(addDays(range.start, index)));
}

function buildCalendarDayBuckets(dates: Date[]) {
  return new Map(
    dates.map((date) => {
      const key = toDateString(date) ?? "";

      return [
        key,
        {
          date: key,
          incomeTotalInBaseCurrency: "0",
          expenseTotalInBaseCurrency: "0",
          netTotalInBaseCurrency: "0",
          transactionCount: 0,
        },
      ];
    })
  );
}

function addCalendarCashImpact(
  bucket: AnalyticsCalendarDayBucket,
  amountInBaseCurrency: string,
  direction: "income" | "expense"
) {
  if (direction === "income") {
    bucket.incomeTotalInBaseCurrency = new Big(bucket.incomeTotalInBaseCurrency).plus(amountInBaseCurrency).toString();
    bucket.netTotalInBaseCurrency = new Big(bucket.netTotalInBaseCurrency).plus(amountInBaseCurrency).toString();
    return;
  }

  bucket.expenseTotalInBaseCurrency = new Big(bucket.expenseTotalInBaseCurrency).plus(amountInBaseCurrency).toString();
  bucket.netTotalInBaseCurrency = new Big(bucket.netTotalInBaseCurrency).minus(amountInBaseCurrency).toString();
}

function buildCurrentRangeWhere(workspaceId: string, range: AnalyticsDateRange) {
  return {
    workspaceId,
    date: {
      gte: range.start,
      lte: range.end,
    },
  };
}

function buildCapitalAccountWhere(workspaceId: string, filters: AnalyticsOverviewQueryDto): Prisma.AccountWhereInput {
  const where: Prisma.AccountWhereInput = {
    workspaceId,
    archived: false,
  };

  if (filters.accountIds?.length) {
    where.id = { in: filters.accountIds };
  }

  if (filters.userIds?.length) {
    where.ownerId = { in: filters.userIds };
  }

  return where;
}

function toCurrencyEnum(currency: string) {
  return currency as Currency;
}

function shouldIncludeDebtTransactions(transactionTypes?: string[]) {
  if (!transactionTypes?.length) {
    return true;
  }

  return transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
}

function matchesAmountRange(amounts: Array<string | null | undefined>, filters?: AnalyticsOverviewQueryDto) {
  if (!filters?.amountFrom && !filters?.amountTo) {
    return true;
  }

  const candidateAmounts = amounts.filter((amount): amount is string => Boolean(amount));

  return candidateAmounts.some((amount) => {
    if (filters.amountFrom && compareMoney(amount, filters.amountFrom) < 0) {
      return false;
    }

    if (filters.amountTo && compareMoney(amount, filters.amountTo) > 0) {
      return false;
    }

    return true;
  });
}

function includesCaseInsensitive(value: string | null | undefined, searchTerm: string) {
  if (!value) {
    return false;
  }

  return value.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase());
}

function matchesMultiSelect(selectedValues: string[] | undefined, candidateValues: Array<string | null | undefined>) {
  if (!selectedValues?.length) {
    return true;
  }

  const normalizedCandidateValues = candidateValues.filter((value): value is string => Boolean(value));
  return normalizedCandidateValues.some((value) => selectedValues.includes(value));
}

function matchesTransactionTypes(
  transactionTypes: string[] | undefined,
  kind: CombinedTransaction["kind"],
  paymentType?: string
) {
  if (!transactionTypes?.length) {
    return true;
  }

  if (kind === "debtTransaction") {
    return transactionTypes.includes(DEBT_TRANSACTION_FILTER_VALUE);
  }

  if (kind === "transferTransaction") {
    return transactionTypes.includes(TRANSFER_TRANSACTION_FILTER_VALUE);
  }

  return paymentType ? transactionTypes.includes(paymentType) : false;
}

function matchesDateRange(date: Date, filters?: AnalyticsOverviewQueryDto) {
  const dateValue = new Date(date).getTime();

  if (filters?.dateFrom) {
    const dateFrom = new Date(`${filters.dateFrom}T00:00:00`);
    if (dateValue < dateFrom.getTime()) {
      return false;
    }
  }

  if (filters?.dateTo) {
    const dateTo = new Date(`${filters.dateTo}T23:59:59.999`);
    if (dateValue > dateTo.getTime()) {
      return false;
    }
  }

  return true;
}

function matchesPaymentTransactionFilters(
  transaction: PaymentTransactionWithRelations,
  filters?: AnalyticsOverviewQueryDto
) {
  if (!matchesTransactionTypes(filters?.transactionTypes, "paymentTransaction", transaction.type)) return false;
  if (!matchesMultiSelect(filters?.userIds, [transaction.account.ownerId])) return false;
  if (!matchesMultiSelect(filters?.accountIds, [transaction.account.id])) return false;
  if (filters?.categoryIds?.length && !matchesMultiSelect(filters.categoryIds, [transaction.category?.id])) {
    return false;
  }
  if (filters?.description && !includesCaseInsensitive(transaction.description, filters.description)) return false;
  if (!matchesAmountRange([transaction.amount], filters)) return false;
  if (!matchesDateRange(transaction.date, filters)) return false;
  return true;
}

function matchesTransferTransactionFilters(
  transaction: TransferTransactionWithRelations,
  filters?: AnalyticsOverviewQueryDto
) {
  if (!matchesTransactionTypes(filters?.transactionTypes, "transferTransaction")) return false;
  if (!matchesMultiSelect(filters?.userIds, [transaction.fromAccount.ownerId, transaction.toAccount.ownerId]))
    return false;
  if (!matchesMultiSelect(filters?.accountIds, [transaction.fromAccount.id, transaction.toAccount.id])) return false;
  if (filters?.categoryIds?.length) return false;
  if (filters?.description && !includesCaseInsensitive(transaction.description, filters.description)) return false;
  if (!matchesAmountRange([transaction.amount, transaction.toAmount], filters)) return false;
  if (!matchesDateRange(transaction.date, filters)) return false;
  return true;
}

function matchesDebtTransactionFilters(
  debtTransaction: DebtTransactionWithRelations,
  filters?: AnalyticsOverviewQueryDto
) {
  if (!matchesTransactionTypes(filters?.transactionTypes, "debtTransaction")) return false;
  if (!matchesMultiSelect(filters?.userIds, [debtTransaction.account?.ownerId])) return false;
  if (!matchesMultiSelect(filters?.accountIds, [debtTransaction.account?.id])) return false;
  if (filters?.categoryIds?.length || filters?.description) return false;
  if (!matchesAmountRange([debtTransaction.amount, debtTransaction.toAmount], filters)) return false;
  if (!matchesDateRange(debtTransaction.date, filters)) return false;
  return true;
}

function filterCombinedTransactions(transactions: CombinedTransaction[], filters?: AnalyticsOverviewQueryDto) {
  return transactions.filter((transaction) => {
    if (transaction.kind === "debtTransaction") {
      return matchesDebtTransactionFilters(transaction.data, filters);
    }

    if (transaction.kind === "transferTransaction") {
      return matchesTransferTransactionFilters(transaction.data, filters);
    }

    return matchesPaymentTransactionFilters(transaction.data, filters);
  });
}

function getCombinedTransactionDate(transaction: CombinedTransaction) {
  return transaction.data.date;
}

function isPaymentTransaction(transaction: CombinedTransaction): transaction is {
  kind: "paymentTransaction";
  data: PaymentTransactionWithRelations;
} {
  return transaction.kind === "paymentTransaction";
}

function isTransferTransaction(transaction: CombinedTransaction): transaction is {
  kind: "transferTransaction";
  data: TransferTransactionWithRelations;
} {
  return transaction.kind === "transferTransaction";
}

function isDebtTransaction(transaction: CombinedTransaction): transaction is {
  kind: "debtTransaction";
  data: DebtTransactionWithRelations;
} {
  return transaction.kind === "debtTransaction";
}

function normalizeRateDate(date: Date) {
  const normalizedDate = new Date(date);
  normalizedDate.setUTCHours(0, 0, 0, 0);
  return normalizedDate;
}

function getRateKey(date: Date, fromCurrency: Currency, toCurrency: Currency) {
  return `${normalizeRateDate(date).toISOString().split("T")[0]}:${fromCurrency}:${toCurrency}`;
}

function convertAmountWithRates(
  amount: string,
  fromCurrency: Currency,
  toCurrency: Currency,
  date: Date,
  rates: Map<string, number>
) {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = rates.get(getRateKey(date, fromCurrency, toCurrency));

  if (typeof rate !== "number") {
    throw new ServiceUnavailableException(
      `Курс для ${fromCurrency}/${toCurrency} на ${normalizeRateDate(date).toISOString()} не найден`
    );
  }

  return new Big(amount).times(rate).toString();
}

function addMoney(a: string, b: string): string {
  return new Big(a).plus(b).toString();
}

function subtractMoney(a: string, b: string): string {
  return new Big(a).minus(b).toString();
}

function getPaymentTransactionBalanceDelta(type: string, amount: string) {
  return type === PAYMENT_INCOME ? amount : subtractMoney("0", amount);
}

function getTransferTransactionBalanceDeltas(amount: string, toAmount: string) {
  return {
    fromDelta: subtractMoney("0", amount),
    toDelta: toAmount,
  };
}

function getDebtTransactionAccountAmount(
  transaction: Pick<DebtTransactionWithRelations, "type" | "amount" | "toAmount">
) {
  return transaction.toAmount || transaction.amount;
}

function getDebtTransactionBalanceDelta(debtType: string, transaction: DebtTransactionWithRelations) {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DEBT_TRANSACTION_CLOSED) {
    return debtType === DEBT_LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return debtType === DEBT_LENT ? subtractMoney("0", accountAmount) : accountAmount;
}

function getDebtTransactionCashImpact(transaction: DebtTransactionWithRelations) {
  const amount =
    transaction.type === DEBT_TRANSACTION_CLOSED ? transaction.toAmount || transaction.amount : transaction.amount;
  const currency =
    transaction.type === DEBT_TRANSACTION_CLOSED && transaction.toAmount
      ? toCurrencyEnum(transaction.account?.currency ?? transaction.debt.currency)
      : toCurrencyEnum(transaction.debt.currency);

  return {
    amount,
    currency,
  };
}

function isDebtTransactionCashImpactIncome(transaction: DebtTransactionWithRelations) {
  return (
    (transaction.debt.type === DEBT_LENT && transaction.type === DEBT_TRANSACTION_CLOSED) ||
    (transaction.debt.type === DEBT_BORROWED && transaction.type !== DEBT_TRANSACTION_CLOSED)
  );
}

function getDebtMovementLabels(transaction: DebtTransactionWithRelations) {
  const actionLabel =
    transaction.type === DEBT_TRANSACTION_CREATED
      ? "Создание долга"
      : transaction.type === DEBT_TRANSACTION_ADDED
        ? "Увеличение долга"
        : "Погашение долга";

  const debtTypeLabel = transaction.debt.type === DEBT_LENT ? "Вы дали в долг" : "Вы взяли в долг";
  const accountLabel = transaction.account?.name ? ` · ${transaction.account.name}` : "";

  return {
    primaryLabel: transaction.debt.personName,
    secondaryLabel: `${actionLabel} · ${debtTypeLabel}${accountLabel}`,
  };
}

function buildPaymentMovement(
  transaction: PaymentTransactionWithRelations,
  amountInBaseCurrency: string,
  baseCurrency: string
): ConvertedMovement {
  return {
    id: transaction.id,
    kind: "paymentTransaction",
    kindLabel: transaction.type === PAYMENT_INCOME ? "Доход" : "Расход",
    date: toDateString(transaction.date) ?? "",
    primaryLabel: transaction.category?.name ?? "Без категории",
    secondaryLabel: transaction.description?.trim() || transaction.account.name,
    originalAmount: formatMoney(transaction.amount, transaction.account.currency),
    amountInBaseCurrency: formatMoney(amountInBaseCurrency, baseCurrency),
    sortAmountInBaseCurrency: amountInBaseCurrency,
  };
}

function buildTransferMovement(
  transaction: TransferTransactionWithRelations,
  amountInBaseCurrency: string,
  baseCurrency: string
): ConvertedMovement {
  return {
    id: transaction.id,
    kind: "transferTransaction",
    kindLabel: "Перевод",
    date: toDateString(transaction.date) ?? "",
    primaryLabel: `${transaction.fromAccount.name} → ${transaction.toAccount.name}`,
    secondaryLabel: transaction.description?.trim() || "Перемещение между счетами",
    originalAmount: formatMoney(transaction.amount, transaction.fromAccount.currency),
    amountInBaseCurrency: formatMoney(amountInBaseCurrency, baseCurrency),
    sortAmountInBaseCurrency: amountInBaseCurrency,
  };
}

function buildDebtMovement(
  transaction: DebtTransactionWithRelations,
  amountInBaseCurrency: string,
  baseCurrency: string
): ConvertedMovement {
  const labels = getDebtMovementLabels(transaction);
  const cashImpact = getDebtTransactionCashImpact(transaction);

  return {
    id: transaction.id,
    kind: "debtTransaction",
    kindLabel: "Долг",
    date: toDateString(transaction.date) ?? "",
    primaryLabel: labels.primaryLabel,
    secondaryLabel: labels.secondaryLabel,
    originalAmount: formatMoney(cashImpact.amount, cashImpact.currency),
    amountInBaseCurrency: formatMoney(amountInBaseCurrency, baseCurrency),
    sortAmountInBaseCurrency: amountInBaseCurrency,
  };
}

function sortMovementsByAbsoluteImpact(left: ConvertedMovement, right: ConvertedMovement) {
  return new Big(right.sortAmountInBaseCurrency).abs().cmp(new Big(left.sortAmountInBaseCurrency).abs());
}

function buildCapitalRateRequests(
  dates: Date[],
  accounts: CapitalAccount[],
  baseCurrency: string
): ExchangeRateRequest[] {
  return dates.flatMap((date) => {
    const dayEnd = endOfDay(date);

    return accounts
      .filter((account) => account.createdAt.getTime() <= dayEnd.getTime())
      .map((account) => ({
        date: dayEnd,
        fromCurrency: toCurrencyEnum(account.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      }));
  });
}

function buildCapitalBalanceDeltas(
  accountIds: Set<string>,
  paymentTransactions: PaymentTransactionWithRelations[],
  transferTransactions: TransferTransactionWithRelations[],
  debtTransactions: DebtTransactionWithRelations[]
) {
  const deltas: CapitalBalanceDelta[] = [];

  for (const transaction of paymentTransactions) {
    if (!accountIds.has(transaction.accountId)) {
      continue;
    }

    deltas.push({
      accountId: transaction.accountId,
      date: transaction.date,
      delta: getPaymentTransactionBalanceDelta(transaction.type, transaction.amount),
    });
  }

  for (const transaction of transferTransactions) {
    const transferDeltas = getTransferTransactionBalanceDeltas(transaction.amount, transaction.toAmount);

    if (accountIds.has(transaction.fromAccountId)) {
      deltas.push({
        accountId: transaction.fromAccountId,
        date: transaction.date,
        delta: transferDeltas.fromDelta,
      });
    }

    if (accountIds.has(transaction.toAccountId)) {
      deltas.push({
        accountId: transaction.toAccountId,
        date: transaction.date,
        delta: transferDeltas.toDelta,
      });
    }
  }

  for (const transaction of debtTransactions) {
    if (!transaction.accountId || !accountIds.has(transaction.accountId)) {
      continue;
    }

    deltas.push({
      accountId: transaction.accountId,
      date: transaction.date,
      delta: getDebtTransactionBalanceDelta(transaction.debt.type, transaction),
    });
  }

  return deltas.sort((left, right) => right.date.getTime() - left.date.getTime());
}

function buildCapitalTimeSeries({
  accounts,
  baseCurrency,
  dates,
  debtTransactions,
  paymentTransactions,
  rates,
  transferTransactions,
}: {
  accounts: CapitalAccount[];
  baseCurrency: string;
  dates: Date[];
  debtTransactions: DebtTransactionWithRelations[];
  paymentTransactions: PaymentTransactionWithRelations[];
  rates: Map<string, number>;
  transferTransactions: TransferTransactionWithRelations[];
}) {
  const accountIds = new Set(accounts.map((account) => account.id));
  const balancesByAccount = new Map(accounts.map((account) => [account.id, account.balance]));
  const deltas = buildCapitalBalanceDeltas(accountIds, paymentTransactions, transferTransactions, debtTransactions);
  const points: Array<{ date: string; totalInBaseCurrency: string }> = [];
  let deltaIndex = 0;

  for (const date of [...dates].reverse()) {
    const dayEnd = endOfDay(date);

    while (deltaIndex < deltas.length && deltas[deltaIndex].date.getTime() > dayEnd.getTime()) {
      const delta = deltas[deltaIndex];
      const currentBalance = balancesByAccount.get(delta.accountId) ?? "0";
      balancesByAccount.set(delta.accountId, subtractMoney(currentBalance, delta.delta));
      deltaIndex += 1;
    }

    const totalInBaseCurrency = accounts.reduce((total, account) => {
      if (account.createdAt.getTime() > dayEnd.getTime()) {
        return total;
      }

      const balance = balancesByAccount.get(account.id) ?? "0";
      const convertedBalance = convertAmountWithRates(
        balance,
        toCurrencyEnum(account.currency),
        toCurrencyEnum(baseCurrency),
        dayEnd,
        rates
      );

      return addMoney(total, convertedBalance);
    }, "0");

    points.push({
      date: toDateString(date) ?? "",
      totalInBaseCurrency,
    });
  }

  return points.reverse();
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExchangeRateService) private readonly exchangeRateService: ExchangeRateService
  ) {}

  async getAnalyticsOverview(workspaceId: string, filters: AnalyticsOverviewQueryDto = {}) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const baseCurrency = workspace.baseCurrency;
    const effectiveRange = resolveAnalyticsDateRange(filters);
    const previousRange = resolvePreviousAnalyticsDateRange(effectiveRange);
    const previousPeriodFilters = applyAnalyticsDateRangeToFilters(filters, previousRange);
    const includeDebtTransactions = shouldIncludeDebtTransactions(filters.transactionTypes);

    const [
      currentPaymentTransactions,
      currentTransferTransactions,
      currentDebtTransactions,
      previousPaymentTransactions,
      openDebts,
      capitalAccounts,
    ] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: PAYMENT_TRANSACTION_INCLUDE,
        orderBy: { date: "desc" },
      }),
      this.prisma.transferTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: TRANSFER_TRANSACTION_INCLUDE,
        orderBy: { date: "desc" },
      }),
      includeDebtTransactions
        ? this.prisma.debtTransaction.findMany({
            where: {
              ...buildCurrentRangeWhere(workspaceId, effectiveRange),
              debt: {
                is: {
                  workspaceId,
                },
              },
            },
            include: DEBT_TRANSACTION_INCLUDE,
            orderBy: { date: "desc" },
          })
        : Promise.resolve([] as DebtTransactionWithRelations[]),
      this.prisma.paymentTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, previousRange),
        include: PAYMENT_TRANSACTION_INCLUDE,
        orderBy: { date: "desc" },
      }),
      this.prisma.debt.findMany({
        where: {
          workspaceId,
          status: DEBT_OPEN,
        },
        select: {
          id: true,
          personName: true,
          type: true,
          remainingAmount: true,
          currency: true,
          date: true,
        },
        orderBy: [{ date: "desc" }, { personName: "asc" }],
      }),
      this.prisma.account.findMany({
        where: buildCapitalAccountWhere(workspaceId, filters),
        select: CAPITAL_ACCOUNT_SELECT,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      }),
    ]);
    const rangeDates = buildInclusiveDateRangeDates(effectiveRange);
    const capitalAccountIds = capitalAccounts.map((account) => account.id);
    const [capitalPaymentTransactions, capitalTransferTransactions, capitalDebtTransactions] =
      capitalAccountIds.length > 0
        ? await Promise.all([
            this.prisma.paymentTransaction.findMany({
              where: {
                workspaceId,
                accountId: { in: capitalAccountIds },
                date: { gt: effectiveRange.start },
              },
              include: PAYMENT_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
            }),
            this.prisma.transferTransaction.findMany({
              where: {
                workspaceId,
                date: { gt: effectiveRange.start },
                OR: [{ fromAccountId: { in: capitalAccountIds } }, { toAccountId: { in: capitalAccountIds } }],
              },
              include: TRANSFER_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
            }),
            this.prisma.debtTransaction.findMany({
              where: {
                workspaceId,
                accountId: { in: capitalAccountIds },
                date: { gt: effectiveRange.start },
                debt: {
                  is: {
                    workspaceId,
                  },
                },
              },
              include: DEBT_TRANSACTION_INCLUDE,
              orderBy: { date: "desc" },
            }),
          ])
        : [
            [] as PaymentTransactionWithRelations[],
            [] as TransferTransactionWithRelations[],
            [] as DebtTransactionWithRelations[],
          ];

    const currentCombined: CombinedTransaction[] = [
      ...currentPaymentTransactions.map((transaction) => ({
        kind: "paymentTransaction" as const,
        data: transaction as PaymentTransactionWithRelations,
      })),
      ...currentTransferTransactions.map((transaction) => ({
        kind: "transferTransaction" as const,
        data: transaction as TransferTransactionWithRelations,
      })),
      ...currentDebtTransactions.map((transaction) => ({
        kind: "debtTransaction" as const,
        data: transaction as DebtTransactionWithRelations,
      })),
    ];
    const previousCombined: CombinedTransaction[] = previousPaymentTransactions.map((transaction) => ({
      kind: "paymentTransaction" as const,
      data: transaction as PaymentTransactionWithRelations,
    }));

    const filteredCurrentTransactions = filterCombinedTransactions(currentCombined, filters);
    const filteredPreviousTransactions = filterCombinedTransactions(previousCombined, previousPeriodFilters);

    const filteredCurrentPayments = filteredCurrentTransactions
      .filter(isPaymentTransaction)
      .map((transaction) => transaction.data);
    const filteredCurrentTransfers = filteredCurrentTransactions
      .filter(isTransferTransaction)
      .map((transaction) => transaction.data);
    const filteredCurrentDebtTransactions = filteredCurrentTransactions
      .filter(isDebtTransaction)
      .map((transaction) => transaction.data);
    const filteredPreviousPayments = filteredPreviousTransactions
      .filter(isPaymentTransaction)
      .map((transaction) => transaction.data);

    const rateRequests: ExchangeRateRequest[] = [
      ...filteredCurrentPayments.map((transaction) => ({
        date: transaction.date,
        fromCurrency: toCurrencyEnum(transaction.account.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      })),
      ...filteredCurrentTransfers.map((transaction) => ({
        date: transaction.date,
        fromCurrency: toCurrencyEnum(transaction.fromAccount.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      })),
      ...filteredCurrentDebtTransactions.map((transaction) => {
        const cashImpact = getDebtTransactionCashImpact(transaction);
        return {
          date: transaction.date,
          fromCurrency: cashImpact.currency,
          toCurrency: toCurrencyEnum(baseCurrency),
        };
      }),
      ...filteredPreviousPayments.map((transaction) => ({
        date: transaction.date,
        fromCurrency: toCurrencyEnum(transaction.account.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      })),
      ...openDebts.map((debt) => ({
        date: debt.date,
        fromCurrency: toCurrencyEnum(debt.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      })),
      ...buildCapitalRateRequests(rangeDates, capitalAccounts, baseCurrency),
    ];
    const rates = await this.loadExchangeRates(rateRequests);

    const timeSeries = new Map(
      rangeDates.map((date) => {
        const key = toDateString(date) ?? "";

        return [
          key,
          {
            date: key,
            incomeTotalInBaseCurrency: "0",
            expenseTotalInBaseCurrency: "0",
          },
        ];
      })
    );
    const capitalTimeSeries = buildCapitalTimeSeries({
      accounts: capitalAccounts,
      baseCurrency,
      dates: rangeDates,
      debtTransactions: capitalDebtTransactions as DebtTransactionWithRelations[],
      paymentTransactions: capitalPaymentTransactions as PaymentTransactionWithRelations[],
      rates,
      transferTransactions: capitalTransferTransactions as TransferTransactionWithRelations[],
    });

    let incomeTotal = "0";
    let expenseTotal = "0";
    let previousIncomeTotal = "0";
    let previousExpenseTotal = "0";
    let transferTotal = "0";
    let openDebtTotal = "0";

    let incomeCount = 0;
    let expenseCount = 0;

    const incomeCategories = new Map<string, AnalyticsCategoryTotal>();
    const expenseCategories = new Map<string, AnalyticsCategoryTotal>();
    const debtsByPerson = new Map<string, AnalyticsDebtByPerson>();
    const movementRows: ConvertedMovement[] = [];

    for (const transaction of filteredCurrentPayments) {
      const amountInBaseCurrency = convertAmountWithRates(
        transaction.amount,
        toCurrencyEnum(transaction.account.currency),
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );

      const dayKey = toDateString(transaction.date) ?? "";
      const dayBucket = timeSeries.get(dayKey);

      if (transaction.type === PAYMENT_INCOME) {
        incomeTotal = new Big(incomeTotal).plus(amountInBaseCurrency).toString();
        incomeCount += 1;

        if (dayBucket) {
          dayBucket.incomeTotalInBaseCurrency = new Big(dayBucket.incomeTotalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
        }

        const categoryKey = transaction.category?.id ?? "uncategorized";
        const existingCategory = incomeCategories.get(categoryKey);

        if (existingCategory) {
          existingCategory.totalInBaseCurrency = new Big(existingCategory.totalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
          existingCategory.transactionCount += 1;
        } else {
          incomeCategories.set(categoryKey, {
            id: categoryKey,
            name: transaction.category?.name ?? "Без категории",
            totalInBaseCurrency: amountInBaseCurrency,
            transactionCount: 1,
          });
        }
      } else {
        expenseTotal = new Big(expenseTotal).plus(amountInBaseCurrency).toString();
        expenseCount += 1;

        if (dayBucket) {
          dayBucket.expenseTotalInBaseCurrency = new Big(dayBucket.expenseTotalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
        }

        const categoryKey = transaction.category?.id ?? "uncategorized";
        const existingCategory = expenseCategories.get(categoryKey);

        if (existingCategory) {
          existingCategory.totalInBaseCurrency = new Big(existingCategory.totalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
          existingCategory.transactionCount += 1;
        } else {
          expenseCategories.set(categoryKey, {
            id: categoryKey,
            name: transaction.category?.name ?? "Без категории",
            totalInBaseCurrency: amountInBaseCurrency,
            transactionCount: 1,
          });
        }
      }

      movementRows.push(buildPaymentMovement(transaction, amountInBaseCurrency, baseCurrency));
    }

    for (const transaction of filteredPreviousPayments) {
      const amountInBaseCurrency = convertAmountWithRates(
        transaction.amount,
        toCurrencyEnum(transaction.account.currency),
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );

      if (transaction.type === PAYMENT_INCOME) {
        previousIncomeTotal = new Big(previousIncomeTotal).plus(amountInBaseCurrency).toString();
      } else {
        previousExpenseTotal = new Big(previousExpenseTotal).plus(amountInBaseCurrency).toString();
      }
    }

    for (const transaction of filteredCurrentTransfers) {
      const amountInBaseCurrency = convertAmountWithRates(
        transaction.amount,
        toCurrencyEnum(transaction.fromAccount.currency),
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );

      transferTotal = new Big(transferTotal).plus(amountInBaseCurrency).toString();
      movementRows.push(buildTransferMovement(transaction, amountInBaseCurrency, baseCurrency));
    }

    for (const transaction of filteredCurrentDebtTransactions) {
      const cashImpact = getDebtTransactionCashImpact(transaction);
      const amountInBaseCurrency = convertAmountWithRates(
        cashImpact.amount,
        cashImpact.currency,
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );
      movementRows.push(buildDebtMovement(transaction, amountInBaseCurrency, baseCurrency));
    }

    for (const debt of openDebts) {
      const amountInBaseCurrency = convertAmountWithRates(
        debt.remainingAmount,
        toCurrencyEnum(debt.currency),
        toCurrencyEnum(baseCurrency),
        debt.date,
        rates
      );

      openDebtTotal = new Big(openDebtTotal).plus(amountInBaseCurrency).toString();

      const existingPerson = debtsByPerson.get(debt.personName);

      if (existingPerson) {
        if (debt.type === DEBT_LENT) {
          existingPerson.lentTotalInBaseCurrency = new Big(existingPerson.lentTotalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
        } else {
          existingPerson.borrowedTotalInBaseCurrency = new Big(existingPerson.borrowedTotalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
        }

        existingPerson.netExposureInBaseCurrency = new Big(existingPerson.lentTotalInBaseCurrency)
          .minus(existingPerson.borrowedTotalInBaseCurrency)
          .toString();
        existingPerson.debtCount += 1;
      } else {
        const lentAmount = debt.type === DEBT_LENT ? amountInBaseCurrency : "0";
        const borrowedAmount = debt.type === DEBT_BORROWED ? amountInBaseCurrency : "0";

        debtsByPerson.set(debt.personName, {
          personName: debt.personName,
          lentTotalInBaseCurrency: lentAmount,
          borrowedTotalInBaseCurrency: borrowedAmount,
          netExposureInBaseCurrency: new Big(lentAmount).minus(borrowedAmount).toString(),
          debtCount: 1,
        });
      }
    }

    const netFlowTotal = new Big(incomeTotal).minus(expenseTotal).toString();
    const previousNetFlowTotal = new Big(previousIncomeTotal).minus(previousExpenseTotal).toString();

    const incomeCategoryRows = Array.from(incomeCategories.values())
      .sort((left, right) => new Big(right.totalInBaseCurrency).cmp(new Big(left.totalInBaseCurrency)))
      .map((category) => ({
        ...category,
        sharePercent: new Big(incomeTotal).eq(0)
          ? 0
          : Number(new Big(category.totalInBaseCurrency).div(incomeTotal).times(100).toFixed(1)),
      }));

    const expenseCategoryRows = Array.from(expenseCategories.values())
      .sort((left, right) => new Big(right.totalInBaseCurrency).cmp(new Big(left.totalInBaseCurrency)))
      .map((category) => ({
        ...category,
        sharePercent: new Big(expenseTotal).eq(0)
          ? 0
          : Number(new Big(category.totalInBaseCurrency).div(expenseTotal).times(100).toFixed(1)),
      }));

    const debtRows = Array.from(debtsByPerson.values()).sort((left, right) => {
      const leftTotal = new Big(left.lentTotalInBaseCurrency).plus(left.borrowedTotalInBaseCurrency);
      const rightTotal = new Big(right.lentTotalInBaseCurrency).plus(right.borrowedTotalInBaseCurrency);

      return rightTotal.cmp(leftTotal);
    });

    const largestMovements = movementRows
      .sort(sortMovementsByAbsoluteImpact)
      .slice(0, 10)
      .map(({ sortAmountInBaseCurrency: _sortAmountInBaseCurrency, ...movement }) => movement);

    return {
      baseCurrency,
      effectiveRange: {
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
        previousStartDate: previousRange.startDate,
        previousEndDate: previousRange.endDate,
        dayCount: effectiveRange.dayCount,
        isImplicit: effectiveRange.isImplicit,
      },
      summary: {
        income: {
          totalInBaseCurrency: incomeTotal,
          previousTotalInBaseCurrency: previousIncomeTotal,
          percentageChange: getPreviousPeriodPercentageChange(incomeTotal, previousIncomeTotal),
          transactionCount: incomeCount,
        },
        expense: {
          totalInBaseCurrency: expenseTotal,
          previousTotalInBaseCurrency: previousExpenseTotal,
          percentageChange: getPreviousPeriodPercentageChange(expenseTotal, previousExpenseTotal),
          transactionCount: expenseCount,
        },
        netFlow: {
          totalInBaseCurrency: netFlowTotal,
          previousTotalInBaseCurrency: previousNetFlowTotal,
          percentageChange: getPreviousPeriodPercentageChange(netFlowTotal, previousNetFlowTotal),
        },
        transferVolume: {
          totalInBaseCurrency: transferTotal,
          transactionCount: filteredCurrentTransfers.length,
        },
        openDebts: {
          totalInBaseCurrency: openDebtTotal,
          debtCount: openDebts.length,
        },
      },
      comparison: {
        incomePreviousTotalInBaseCurrency: previousIncomeTotal,
        expensePreviousTotalInBaseCurrency: previousExpenseTotal,
        netFlowPreviousTotalInBaseCurrency: previousNetFlowTotal,
      },
      timeSeries: Array.from(timeSeries.values()),
      capitalTimeSeries,
      incomeCategories: incomeCategoryRows,
      expenseCategories: expenseCategoryRows,
      debtsByPerson: debtRows,
      largestMovements,
    };
  }

  async getAnalyticsCalendar(workspaceId: string, filters: AnalyticsOverviewQueryDto = {}) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const baseCurrency = workspace.baseCurrency;
    const effectiveRange = resolveAnalyticsCalendarDateRange(filters);
    const previousRange = resolvePreviousAnalyticsDateRange(effectiveRange);
    const rangeFilters = applyAnalyticsDateRangeToFilters(filters, effectiveRange);
    const includeDebtTransactions = shouldIncludeDebtTransactions(filters.transactionTypes);

    const [currentPaymentTransactions, currentTransferTransactions, currentDebtTransactions] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: PAYMENT_TRANSACTION_INCLUDE,
        orderBy: { date: "desc" },
      }),
      this.prisma.transferTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: TRANSFER_TRANSACTION_INCLUDE,
        orderBy: { date: "desc" },
      }),
      includeDebtTransactions
        ? this.prisma.debtTransaction.findMany({
            where: {
              ...buildCurrentRangeWhere(workspaceId, effectiveRange),
              debt: {
                is: {
                  workspaceId,
                },
              },
            },
            include: DEBT_TRANSACTION_INCLUDE,
            orderBy: { date: "desc" },
          })
        : Promise.resolve([] as DebtTransactionWithRelations[]),
    ]);

    const currentCombined: CombinedTransaction[] = [
      ...currentPaymentTransactions.map((transaction) => ({
        kind: "paymentTransaction" as const,
        data: transaction as PaymentTransactionWithRelations,
      })),
      ...currentTransferTransactions.map((transaction) => ({
        kind: "transferTransaction" as const,
        data: transaction as TransferTransactionWithRelations,
      })),
      ...currentDebtTransactions.map((transaction) => ({
        kind: "debtTransaction" as const,
        data: transaction as DebtTransactionWithRelations,
      })),
    ];
    const filteredCurrentTransactions = filterCombinedTransactions(currentCombined, rangeFilters);
    const filteredCurrentPayments = filteredCurrentTransactions
      .filter(isPaymentTransaction)
      .map((transaction) => transaction.data);
    const filteredCurrentDebtTransactions = filteredCurrentTransactions
      .filter(isDebtTransaction)
      .map((transaction) => transaction.data);
    const rateRequests: ExchangeRateRequest[] = [
      ...filteredCurrentPayments.map((transaction) => ({
        date: transaction.date,
        fromCurrency: toCurrencyEnum(transaction.account.currency),
        toCurrency: toCurrencyEnum(baseCurrency),
      })),
      ...filteredCurrentDebtTransactions.map((transaction) => {
        const cashImpact = getDebtTransactionCashImpact(transaction);
        return {
          date: transaction.date,
          fromCurrency: cashImpact.currency,
          toCurrency: toCurrencyEnum(baseCurrency),
        };
      }),
    ];
    const rates = await this.loadExchangeRates(rateRequests);
    const calendarDays = buildCalendarDayBuckets(buildInclusiveDateRangeDates(effectiveRange));

    for (const transaction of filteredCurrentTransactions) {
      const dayBucket = calendarDays.get(toDateString(getCombinedTransactionDate(transaction)) ?? "");

      if (dayBucket) {
        dayBucket.transactionCount += 1;
      }
    }

    for (const transaction of filteredCurrentPayments) {
      const amountInBaseCurrency = convertAmountWithRates(
        transaction.amount,
        toCurrencyEnum(transaction.account.currency),
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );
      const dayBucket = calendarDays.get(toDateString(transaction.date) ?? "");

      if (dayBucket) {
        addCalendarCashImpact(
          dayBucket,
          amountInBaseCurrency,
          transaction.type === PAYMENT_INCOME ? "income" : "expense"
        );
      }
    }

    for (const transaction of filteredCurrentDebtTransactions) {
      const cashImpact = getDebtTransactionCashImpact(transaction);
      const amountInBaseCurrency = convertAmountWithRates(
        cashImpact.amount,
        cashImpact.currency,
        toCurrencyEnum(baseCurrency),
        transaction.date,
        rates
      );
      const dayBucket = calendarDays.get(toDateString(transaction.date) ?? "");

      if (dayBucket) {
        addCalendarCashImpact(
          dayBucket,
          amountInBaseCurrency,
          isDebtTransactionCashImpactIncome(transaction) ? "income" : "expense"
        );
      }
    }

    return {
      baseCurrency,
      effectiveRange: {
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
        previousStartDate: previousRange.startDate,
        previousEndDate: previousRange.endDate,
        dayCount: effectiveRange.dayCount,
        isImplicit: effectiveRange.isImplicit,
      },
      calendarDays: Array.from(calendarDays.values()),
    };
  }

  private async loadExchangeRates(rateRequests: ExchangeRateRequest[]) {
    try {
      return await this.exchangeRateService.preloadExchangeRates(rateRequests);
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : "Не удалось получить курс";
      throw new ServiceUnavailableException(message);
    }
  }
}
