"use server";

import type { Currency, Prisma } from "@prisma/client";
import Big from "big.js";

import { preloadExchangeRates } from "@/modules/currency/exchange-rate.service";
import { DebtStatus, DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import {
  shouldIncludeDebtTransactions,
  type TransactionViewFilters,
} from "@/modules/transactions/components/transactions-filters";
import { toDateString } from "@/modules/transactions/components/transactions-filters/utils/date";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import type {
  CombinedTransaction,
  PaymentTransactionWithRelations,
  TransferTransactionWithRelations,
} from "@/modules/transactions/transaction.types";
import { filterCombinedTransactions } from "@/modules/transactions/utils/combined-transaction-filtering";
import { getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { formatMoney } from "@/shared/utils/money";

import type {
  AnalyticsDateRange,
  AnalyticsDebtByPerson,
  AnalyticsExpenseCategory,
  AnalyticsLargestMovement,
  AnalyticsOverviewResult,
} from "./analytics.types";
import {
  applyAnalyticsDateRangeToFilters,
  buildInclusiveDateRangeDates,
  getPreviousPeriodPercentageChange,
  resolveAnalyticsDateRange,
  resolvePreviousAnalyticsDateRange,
} from "./analytics.utils";

const accountWithOwnerSelect = {
  id: true,
  name: true,
  currency: true,
  color: true,
  icon: true,
  ownerId: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} satisfies Prisma.AccountSelect;

const categorySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

type ConvertedMovement = AnalyticsLargestMovement & {
  sortAmountInBaseCurrency: string;
};

type RateRequest = {
  date: Date;
  fromCurrency: Currency;
  toCurrency: Currency;
};

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
    throw new Error(`Курс для ${fromCurrency}/${toCurrency} на ${normalizeRateDate(date).toISOString()} не найден`);
  }

  return new Big(amount).times(rate).toString();
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

function toCurrencyEnum(currency: string) {
  return currency as Currency;
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

function getDebtTransactionCashImpact(transaction: DebtTransactionWithRelations) {
  const amount =
    transaction.type === DebtTransactionType.CLOSED ? transaction.toAmount || transaction.amount : transaction.amount;
  const currency =
    transaction.type === DebtTransactionType.CLOSED && transaction.toAmount
      ? toCurrencyEnum(transaction.account?.currency ?? transaction.debt.currency)
      : toCurrencyEnum(transaction.debt.currency);

  return {
    amount,
    currency,
  };
}

function getDebtMovementLabels(transaction: DebtTransactionWithRelations) {
  const actionLabel =
    transaction.type === DebtTransactionType.CREATED
      ? "Создание долга"
      : transaction.type === DebtTransactionType.ADDED
        ? "Увеличение долга"
        : "Погашение долга";

  const debtTypeLabel = transaction.debt.type === DebtType.LENT ? "Вы дали в долг" : "Вы взяли в долг";
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
    kindLabel: transaction.type === PaymentTransactionType.INCOME ? "Доход" : "Расход",
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

export async function getAnalyticsOverview(
  workspaceId: string,
  filters: TransactionViewFilters = {}
): Promise<AnalyticsOverviewResult | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const workspaceSummaryResult = await getWorkspaceSummary(workspaceId);

    if ("error" in workspaceSummaryResult || !workspaceSummaryResult.data) {
      return { error: workspaceSummaryResult.error || "Не удалось загрузить рабочий стол" };
    }

    const baseCurrency = workspaceSummaryResult.data.baseCurrency;
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
    ] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: {
          account: {
            select: accountWithOwnerSelect,
          },
          category: {
            select: categorySelect,
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.transferTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, effectiveRange),
        include: {
          fromAccount: {
            select: accountWithOwnerSelect,
          },
          toAccount: {
            select: accountWithOwnerSelect,
          },
        },
        orderBy: { date: "desc" },
      }),
      includeDebtTransactions
        ? prisma.debtTransaction.findMany({
            where: {
              ...buildCurrentRangeWhere(workspaceId, effectiveRange),
              debt: {
                is: {
                  workspaceId,
                },
              },
            },
            include: {
              debt: {
                select: {
                  id: true,
                  workspaceId: true,
                  type: true,
                  personName: true,
                  amount: true,
                  remainingAmount: true,
                  currency: true,
                  accountId: true,
                  date: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              account: {
                select: accountWithOwnerSelect,
              },
            },
            orderBy: { date: "desc" },
          })
        : Promise.resolve([] as DebtTransactionWithRelations[]),
      prisma.paymentTransaction.findMany({
        where: buildCurrentRangeWhere(workspaceId, previousRange),
        include: {
          account: {
            select: accountWithOwnerSelect,
          },
          category: {
            select: categorySelect,
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.debt.findMany({
        where: {
          workspaceId,
          status: DebtStatus.OPEN,
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
    ]);

    const currentCombined: CombinedTransaction[] = [
      ...currentPaymentTransactions.map((transaction) => ({ kind: "paymentTransaction" as const, data: transaction })),
      ...currentTransferTransactions.map((transaction) => ({
        kind: "transferTransaction" as const,
        data: transaction,
      })),
      ...currentDebtTransactions.map((transaction) => ({ kind: "debtTransaction" as const, data: transaction })),
    ];
    const previousCombined: CombinedTransaction[] = previousPaymentTransactions.map((transaction) => ({
      kind: "paymentTransaction" as const,
      data: transaction,
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

    const rateRequests: RateRequest[] = [
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
    ];
    const rates = await preloadExchangeRates(rateRequests);

    const timeSeries = new Map(
      buildInclusiveDateRangeDates(effectiveRange).map((date) => {
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

    let incomeTotal = "0";
    let expenseTotal = "0";
    let previousIncomeTotal = "0";
    let previousExpenseTotal = "0";
    let transferTotal = "0";
    let openDebtTotal = "0";

    let incomeCount = 0;
    let expenseCount = 0;

    const expenseCategories = new Map<string, Omit<AnalyticsExpenseCategory, "sharePercent">>();
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

      if (transaction.type === PaymentTransactionType.INCOME) {
        incomeTotal = new Big(incomeTotal).plus(amountInBaseCurrency).toString();
        incomeCount += 1;

        if (dayBucket) {
          dayBucket.incomeTotalInBaseCurrency = new Big(dayBucket.incomeTotalInBaseCurrency)
            .plus(amountInBaseCurrency)
            .toString();
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

      if (transaction.type === PaymentTransactionType.INCOME) {
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
        if (debt.type === DebtType.LENT) {
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
        const lentAmount = debt.type === DebtType.LENT ? amountInBaseCurrency : "0";
        const borrowedAmount = debt.type === DebtType.BORROWED ? amountInBaseCurrency : "0";

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
      expenseCategories: expenseCategoryRows,
      debtsByPerson: debtRows,
      largestMovements,
    };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить аналитику" };
  }
}
