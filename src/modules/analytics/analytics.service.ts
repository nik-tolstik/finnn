"use server";

import { getServerSession } from "next-auth";
import { addDays, eachDayOfInterval, format, isBefore, startOfDay } from "date-fns";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { addMoney, multiplyMoney, subtractMoney } from "@/shared/utils/money";

import { TransactionType } from "../transactions/transaction.constants";
import { getNBRBExchangeRates } from "./currency.service";
import type { CapitalDataPoint, CategoryStat } from "./analytics.types";

export async function getCapitalHistory(
  workspaceId: string,
  accountIds: string[] | undefined,
  dateFrom: Date,
  dateTo: Date
): Promise<{ data: CapitalDataPoint[] } | { error: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    const baseCurrency = workspace.baseCurrency || "BYN";

    const exchangeRatesResult = await getNBRBExchangeRates();
    if ("error" in exchangeRatesResult) {
      return { error: exchangeRatesResult.error };
    }
    const exchangeRates = exchangeRatesResult.data;

    const accountsWhere: any = {
      workspaceId,
      archived: false,
    };

    if (accountIds && accountIds.length > 0) {
      accountsWhere.id = { in: accountIds };
    }

    const accounts = await prisma.account.findMany({
      where: accountsWhere,
      orderBy: { createdAt: "asc" },
    });

    if (accounts.length === 0) {
      return { data: [] };
    }

    const dateFromStart = startOfDay(dateFrom);
    const dateToEnd = new Date(dateTo);
    dateToEnd.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        accountId: { in: accounts.map((a) => a.id) },
        date: { lte: dateToEnd },
      },
      select: {
        id: true,
        accountId: true,
        amount: true,
        type: true,
        date: true,
        transferFrom: {
          select: {
            id: true,
            toTransaction: {
              select: {
                id: true,
                accountId: true,
              },
            },
            toAmount: true,
            amount: true,
          },
        },
        transferTo: {
          select: {
            id: true,
            fromTransaction: {
              select: {
                id: true,
                accountId: true,
              },
            },
            amount: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    const accountCreatedDates = new Map<string, Date>();

    for (const account of accounts) {
      accountCreatedDates.set(account.id, new Date(account.createdAt));
    }

    const days = eachDayOfInterval({ start: dateFromStart, end: dateToEnd });
    const result: CapitalDataPoint[] = [];

    for (const day of days) {
      const accountBalances = new Map<string, string>();
      for (const account of accounts) {
        accountBalances.set(account.id, "0");
      }

      const dayStart = startOfDay(day);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const processedTransferIds = new Set<string>();

      for (const transaction of transactions) {
        const transactionDate = new Date(transaction.date);
        const accountId = transaction.accountId;
        const accountCreatedDate = accountCreatedDates.get(accountId)!;

        if (isBefore(transactionDate, accountCreatedDate)) {
          continue;
        }

        if (transactionDate > dayEnd) {
          break;
        }

        if (transaction.type === TransactionType.INCOME) {
          const currentBalance = accountBalances.get(accountId) || "0";
          accountBalances.set(accountId, addMoney(currentBalance, transaction.amount));
        } else if (transaction.type === TransactionType.EXPENSE) {
          const currentBalance = accountBalances.get(accountId) || "0";
          accountBalances.set(accountId, subtractMoney(currentBalance, transaction.amount));
        } else if (transaction.type === TransactionType.TRANSFER) {
          if (transaction.transferFrom && !processedTransferIds.has(transaction.id)) {
            processedTransferIds.add(transaction.id);
            const transfer = transaction.transferFrom;
            const toAccountId = transfer.toTransaction.accountId;
            const toAmount = transfer.toAmount || transaction.amount;

            const fromBalance = accountBalances.get(accountId) || "0";
            accountBalances.set(accountId, subtractMoney(fromBalance, transaction.amount));

            if (accounts.some((a) => a.id === toAccountId)) {
              const toBalance = accountBalances.get(toAccountId) || "0";
              accountBalances.set(toAccountId, addMoney(toBalance, toAmount));
            }
          } else if (transaction.transferTo && !processedTransferIds.has(transaction.id)) {
            processedTransferIds.add(transaction.id);
            const transfer = transaction.transferTo;
            const fromAccountId = transfer.fromTransaction.accountId;
            const fromAmount = transfer.amount;

            const toBalance = accountBalances.get(accountId) || "0";
            accountBalances.set(accountId, addMoney(toBalance, transaction.amount));

            if (accounts.some((a) => a.id === fromAccountId)) {
              const fromBalance = accountBalances.get(fromAccountId) || "0";
              accountBalances.set(fromAccountId, subtractMoney(fromBalance, fromAmount));
            }
          }
        }
      }

      let totalCapital = "0";
      for (const account of accounts) {
        const accountCreatedDate = accountCreatedDates.get(account.id)!;
        if (!isBefore(dayStart, accountCreatedDate)) {
          const balance = accountBalances.get(account.id) || "0";
          const accountCurrency = account.currency || "USD";

          let balanceInBaseCurrency = balance;
          if (accountCurrency !== baseCurrency) {
            const rate = exchangeRates[accountCurrency];
            if (rate && rate > 0) {
              balanceInBaseCurrency = multiplyMoney(balance, rate.toString());
            } else {
              continue;
            }
          }

          totalCapital = addMoney(totalCapital, balanceInBaseCurrency);
        }
      }

      result.push({
        date: new Date(day),
        capital: totalCapital,
      });
    }

    return { data: result };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить историю капитала" };
  }
}

async function getCategoryStatsByType(
  workspaceId: string,
  accountIds: string[] | undefined,
  dateFrom: Date,
  dateTo: Date,
  type: TransactionType.INCOME | TransactionType.EXPENSE
): Promise<{ data: CategoryStat[] } | { error: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    const baseCurrency = workspace.baseCurrency || "BYN";

    const exchangeRatesResult = await getNBRBExchangeRates();
    if ("error" in exchangeRatesResult) {
      return { error: exchangeRatesResult.error };
    }
    const exchangeRates = exchangeRatesResult.data;

    const dateFromStart = startOfDay(dateFrom);
    const dateToEnd = new Date(dateTo);
    dateToEnd.setHours(23, 59, 59, 999);

    const where: any = {
      workspaceId,
      type,
      date: {
        gte: dateFromStart,
        lte: dateToEnd,
      },
    };

    if (accountIds && accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        account: {
          select: {
            currency: true,
          },
        },
      },
    });

    const categoryMap = new Map<string, { name: string; amount: string; color: string | null }>();

    for (const transaction of transactions) {
      if (!transaction.categoryId) {
        continue;
      }

      const accountCurrency = transaction.account.currency || "USD";
      let amountInBaseCurrency = transaction.amount;

      if (accountCurrency !== baseCurrency) {
        const rate = exchangeRates[accountCurrency];
        if (rate && rate > 0) {
          amountInBaseCurrency = multiplyMoney(transaction.amount, rate.toString());
        } else {
          continue;
        }
      }

      const categoryId = transaction.categoryId;
      const existing = categoryMap.get(categoryId);

      if (existing) {
        categoryMap.set(categoryId, {
          name: existing.name,
          amount: addMoney(existing.amount, amountInBaseCurrency),
          color: existing.color,
        });
      } else {
        categoryMap.set(categoryId, {
          name: transaction.category?.name || "Без категории",
          amount: amountInBaseCurrency,
          color: transaction.category?.color || null,
        });
      }
    }

    const result: CategoryStat[] = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      amount: data.amount,
      color: data.color,
    }));

    result.sort((a, b) => {
      const amountA = parseFloat(a.amount);
      const amountB = parseFloat(b.amount);
      return amountB - amountA;
    });

    return { data: result };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить статистику по категориям" };
  }
}

export async function getCategoryStats(
  workspaceId: string,
  accountIds: string[] | undefined,
  dateFrom: Date,
  dateTo: Date
): Promise<{ data: CategoryStat[] } | { error: string }> {
  return getCategoryStatsByType(workspaceId, accountIds, dateFrom, dateTo, TransactionType.EXPENSE);
}

export async function getIncomeCategoryStats(
  workspaceId: string,
  accountIds: string[] | undefined,
  dateFrom: Date,
  dateTo: Date
): Promise<{ data: CategoryStat[] } | { error: string }> {
  return getCategoryStatsByType(workspaceId, accountIds, dateFrom, dateTo, TransactionType.INCOME);
}
