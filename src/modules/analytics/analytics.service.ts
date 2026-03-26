"use server";

import { Currency } from "@prisma/client";

import { getExchangeRate } from "@/modules/currency/exchange-rate.service";
import type { TransactionType } from "@/modules/transactions/transaction.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { addMoney, multiplyMoney } from "@/shared/utils/money";

export interface CategoryAnalytics {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  totalAmount: string;
  percentage: number;
}

export interface CategoryAnalyticsFilters {
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function getCategoryAnalytics(
  workspaceId: string,
  filters: CategoryAnalyticsFilters
): Promise<{ data: CategoryAnalytics[] } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    const baseCurrency = (workspace.baseCurrency as Currency) || Currency.BYN;

    const where: any = {
      workspaceId,
      type: filters.type,
    };

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        where.date.gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        where.date.lte = dateTo;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            currency: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    const categoryMap = new Map<string | null, { name: string; color: string | null; amount: string }>();

    for (const transaction of transactions) {
      const categoryId = transaction.categoryId;
      const categoryName = transaction.category?.name || "Без категории";
      const categoryColor = transaction.category?.color || null;

      const transactionCurrency = transaction.account.currency as Currency;
      let amountInBaseCurrency = transaction.amount;

      if (transactionCurrency !== baseCurrency) {
        const exchangeRateResult = await getExchangeRate(
          transaction.date,
          transactionCurrency,
          baseCurrency
        );

        if ("error" in exchangeRateResult) {
          console.warn(
            `Не удалось получить курс для транзакции ${transaction.id}: ${exchangeRateResult.error}`
          );
          continue;
        }

        amountInBaseCurrency = multiplyMoney(transaction.amount, exchangeRateResult.data.toString());
      }

      const existing = categoryMap.get(categoryId);
      if (existing) {
        existing.amount = addMoney(existing.amount, amountInBaseCurrency);
      } else {
        categoryMap.set(categoryId, {
          name: categoryName,
          color: categoryColor,
          amount: amountInBaseCurrency,
        });
      }
    }

    let totalAmount = "0";
    for (const entry of categoryMap.values()) {
      totalAmount = addMoney(totalAmount, entry.amount);
    }

    const analytics: CategoryAnalytics[] = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        categoryColor: data.color,
        totalAmount: data.amount,
        percentage: totalAmount === "0" ? 0 : (parseFloat(data.amount) / parseFloat(totalAmount)) * 100,
      }))
      .sort((a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount));

    return { data: analytics };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить аналитику" };
  }
}

export interface TotalAmountFilters {
  dateFrom?: Date;
  dateTo?: Date;
}

export async function getTotalAmount(
  workspaceId: string,
  type: TransactionType.INCOME | TransactionType.EXPENSE,
  filters: TotalAmountFilters
): Promise<{ data: string } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { baseCurrency: true },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    const baseCurrency = (workspace.baseCurrency as Currency) || Currency.BYN;

    const where: any = {
      workspaceId,
      type,
    };

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        const dateFrom = new Date(filters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        where.date.gte = dateFrom;
      }
      if (filters.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        where.date.lte = dateTo;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            currency: true,
          },
        },
      },
    });

    let totalAmount = "0";

    for (const transaction of transactions) {
      const transactionCurrency = transaction.account.currency as Currency;
      let amountInBaseCurrency = transaction.amount;

      if (transactionCurrency !== baseCurrency) {
        const exchangeRateResult = await getExchangeRate(
          transaction.date,
          transactionCurrency,
          baseCurrency
        );

        if ("error" in exchangeRateResult) {
          console.warn(
            `Не удалось получить курс для транзакции ${transaction.id}: ${exchangeRateResult.error}`
          );
          continue;
        }

        amountInBaseCurrency = multiplyMoney(transaction.amount, exchangeRateResult.data.toString());
      }

      totalAmount = addMoney(totalAmount, amountInBaseCurrency);
    }

    return { data: totalAmount };
  } catch (error: any) {
    return { error: error.message || "Не удалось получить общую сумму" };
  }
}
