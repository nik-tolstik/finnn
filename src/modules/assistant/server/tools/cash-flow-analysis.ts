import Big from "big.js";
import { format } from "date-fns";

import type { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { formatMoney } from "@/shared/utils/money";

import type { FlowAnalysisInput } from "./assistant-tool.schemas";
import type { MoneyBucket, ResolvedDateRange } from "./assistant-tool.types";
import {
  convertToBaseCurrency,
  createExchangeRateResolver,
  normalizeLimit,
  percentageChange,
  resolveDateRange,
  resolvePreviousDateRange,
  sortBucketsDesc,
} from "./assistant-tool.utils";
import { resolveMatchingAccounts, resolveMatchingCategories } from "./assistant-tool-lookups";

function createPaymentTransactionWhere(options: {
  workspaceId: string;
  transactionType: PaymentTransactionType;
  range: ResolvedDateRange;
  accountIds?: string[];
  categoryIds?: string[];
}) {
  const { workspaceId, transactionType, range, accountIds, categoryIds } = options;

  return {
    workspaceId,
    type: transactionType,
    date: {
      gte: range.start,
      lte: range.end,
    },
    ...(accountIds?.length
      ? {
          accountId: {
            in: accountIds,
          },
        }
      : {}),
    ...(categoryIds?.length
      ? {
          categoryId: {
            in: categoryIds,
          },
        }
      : {}),
  };
}

export async function buildCashFlowAnalysis(
  workspaceId: string,
  baseCurrency: string,
  transactionType: PaymentTransactionType,
  input: FlowAnalysisInput
) {
  await requireWorkspaceAccess(workspaceId);

  const range = resolveDateRange(input);
  const previousRange = resolvePreviousDateRange(range);
  const limit = normalizeLimit(input.limit, 5, 10);
  const [matchedAccounts, matchedCategories] = await Promise.all([
    resolveMatchingAccounts(workspaceId, input.accountName),
    resolveMatchingCategories(workspaceId, input.categoryName),
  ]);

  if (input.accountName && matchedAccounts?.length === 0) {
    return {
      noData: true,
      reason: `Счета с названием, похожим на "${input.accountName}", не найдены`,
    };
  }

  if (input.categoryName && matchedCategories?.length === 0) {
    return {
      noData: true,
      reason: `Категории с названием, похожим на "${input.categoryName}", не найдены`,
    };
  }

  const accountIds = matchedAccounts?.map((account) => account.id);
  const categoryIds = matchedCategories?.map((category) => category.id);
  const resolveRate = createExchangeRateResolver();

  const [transactions, previousTransactions] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: createPaymentTransactionWhere({
        workspaceId,
        transactionType,
        range,
        accountIds,
        categoryIds,
      }),
      include: {
        account: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 500,
    }),
    prisma.paymentTransaction.findMany({
      where: createPaymentTransactionWhere({
        workspaceId,
        transactionType,
        range: previousRange,
        accountIds,
        categoryIds,
      }),
      include: {
        account: {
          select: {
            currency: true,
          },
        },
      },
      take: 500,
    }),
  ]);

  let totalConverted = "0";
  let previousTotalConverted = "0";
  let largestConverted = "0";
  let largestTransaction: null | {
    amount: string;
    amountInBaseCurrency: string;
    date: string;
    accountName: string;
    categoryName: string | null;
    description: string | null;
  } = null;

  const categoryBuckets = new Map<string, MoneyBucket & { name: string; count: number }>();
  const accountBuckets = new Map<string, MoneyBucket & { name: string; count: number }>();
  const dailyBuckets = new Map<string, MoneyBucket>();
  const recentTransactions = [];

  for (const transaction of transactions) {
    const convertedAmount = await convertToBaseCurrency(
      transaction.amount,
      transaction.account.currency,
      baseCurrency,
      transaction.date,
      resolveRate
    );

    totalConverted = new Big(totalConverted).plus(convertedAmount).toString();

    if (new Big(convertedAmount).gt(largestConverted)) {
      largestConverted = convertedAmount;
      largestTransaction = {
        amount: formatMoney(transaction.amount, transaction.account.currency),
        amountInBaseCurrency: formatMoney(convertedAmount, baseCurrency),
        date: format(transaction.date, "dd.MM.yyyy"),
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? null,
        description: transaction.description ?? null,
      };
    }

    const categoryKey = transaction.category?.id ?? "uncategorized";
    const existingCategory = categoryBuckets.get(categoryKey);

    if (existingCategory) {
      existingCategory.raw = new Big(existingCategory.raw).plus(transaction.amount).toString();
      existingCategory.converted = new Big(existingCategory.converted).plus(convertedAmount).toString();
      existingCategory.count += 1;
    } else {
      categoryBuckets.set(categoryKey, {
        name: transaction.category?.name ?? "Без категории",
        currency: baseCurrency,
        raw: transaction.amount,
        converted: convertedAmount,
        count: 1,
      });
    }

    const accountKey = transaction.account.id;
    const existingAccount = accountBuckets.get(accountKey);

    if (existingAccount) {
      existingAccount.raw = new Big(existingAccount.raw).plus(transaction.amount).toString();
      existingAccount.converted = new Big(existingAccount.converted).plus(convertedAmount).toString();
      existingAccount.count += 1;
    } else {
      accountBuckets.set(accountKey, {
        name: transaction.account.name,
        currency: baseCurrency,
        raw: transaction.amount,
        converted: convertedAmount,
        count: 1,
      });
    }

    const dayKey = format(transaction.date, "yyyy-MM-dd");
    const existingDay = dailyBuckets.get(dayKey);

    if (existingDay) {
      existingDay.raw = new Big(existingDay.raw).plus(transaction.amount).toString();
      existingDay.converted = new Big(existingDay.converted).plus(convertedAmount).toString();
    } else {
      dailyBuckets.set(dayKey, {
        currency: baseCurrency,
        raw: transaction.amount,
        converted: convertedAmount,
      });
    }

    if (recentTransactions.length < limit) {
      recentTransactions.push({
        date: format(transaction.date, "dd.MM.yyyy"),
        amount: formatMoney(transaction.amount, transaction.account.currency),
        amountInBaseCurrency: formatMoney(convertedAmount, baseCurrency),
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? "Без категории",
        description: transaction.description ?? null,
      });
    }
  }

  for (const transaction of previousTransactions) {
    const convertedAmount = await convertToBaseCurrency(
      transaction.amount,
      transaction.account.currency,
      baseCurrency,
      transaction.date,
      resolveRate
    );

    previousTotalConverted = new Big(previousTotalConverted).plus(convertedAmount).toString();
  }

  return {
    noData: transactions.length === 0,
    period: range.label,
    baseCurrency,
    transactionType,
    transactionCount: transactions.length,
    totalInBaseCurrency: formatMoney(totalConverted, baseCurrency),
    previousPeriod: {
      label: previousRange.label,
      totalInBaseCurrency: formatMoney(previousTotalConverted, baseCurrency),
      percentageChange: percentageChange(totalConverted, previousTotalConverted),
    },
    filtersApplied: {
      accountMatches: matchedAccounts?.map((account) => account.name) ?? null,
      categoryMatches: matchedCategories?.map((category) => category.name) ?? null,
    },
    averageTransactionInBaseCurrency:
      transactions.length > 0
        ? formatMoney(new Big(totalConverted).div(transactions.length).toString(), baseCurrency)
        : formatMoney("0", baseCurrency),
    largestTransaction,
    topCategories: sortBucketsDesc(Array.from(categoryBuckets.values()))
      .slice(0, limit)
      .map((category) => ({
        name: category.name,
        transactionCount: category.count,
        totalInBaseCurrency: formatMoney(category.converted, baseCurrency),
      })),
    topAccounts: sortBucketsDesc(Array.from(accountBuckets.values()))
      .slice(0, limit)
      .map((account) => ({
        name: account.name,
        transactionCount: account.count,
        totalInBaseCurrency: formatMoney(account.converted, baseCurrency),
      })),
    dailyTotals: Array.from(dailyBuckets.entries())
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .slice(-Math.min(limit, 7))
      .map(([date, bucket]) => ({
        date,
        totalInBaseCurrency: formatMoney(bucket.converted, baseCurrency),
      })),
    recentTransactions,
  };
}
