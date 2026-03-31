import { format } from "date-fns";

import {
  DEBT_TRANSACTION_FILTER_VALUE,
  PaymentTransactionType,
  TRANSFER_TRANSACTION_FILTER_VALUE,
} from "@/modules/transactions/transaction.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { formatMoney } from "@/shared/utils/money";

import type { RecentTransactionsInput } from "./assistant-tool.schemas";
import { normalizeLimit, resolveDateRange } from "./assistant-tool.utils";

export async function buildRecentTransactions(workspaceId: string, input: RecentTransactionsInput) {
  await requireWorkspaceAccess(workspaceId);

  const range = resolveDateRange(input);
  const limit = normalizeLimit(input.limit, 8, 20);
  const includePayments =
    input.kind === undefined ||
    input.kind === "all" ||
    input.kind === PaymentTransactionType.EXPENSE ||
    input.kind === PaymentTransactionType.INCOME;
  const includeTransfers = input.kind === "all" || input.kind === TRANSFER_TRANSACTION_FILTER_VALUE;
  const includeDebtTransactions = input.kind === "all" || input.kind === DEBT_TRANSACTION_FILTER_VALUE;

  const [payments, transfers, debtTransactions] = await Promise.all([
    includePayments
      ? prisma.paymentTransaction.findMany({
          where: {
            workspaceId,
            date: {
              gte: range.start,
              lte: range.end,
            },
            ...(input.kind === PaymentTransactionType.EXPENSE || input.kind === PaymentTransactionType.INCOME
              ? {
                  type: input.kind,
                }
              : {}),
          },
          include: {
            account: {
              select: {
                name: true,
                currency: true,
              },
            },
            category: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          take: limit,
        })
      : Promise.resolve([]),
    includeTransfers
      ? prisma.transferTransaction.findMany({
          where: {
            workspaceId,
            date: {
              gte: range.start,
              lte: range.end,
            },
          },
          include: {
            fromAccount: {
              select: {
                name: true,
                currency: true,
              },
            },
            toAccount: {
              select: {
                name: true,
                currency: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          take: limit,
        })
      : Promise.resolve([]),
    includeDebtTransactions
      ? prisma.debtTransaction.findMany({
          where: {
            workspaceId,
            date: {
              gte: range.start,
              lte: range.end,
            },
          },
          include: {
            debt: {
              select: {
                personName: true,
                currency: true,
              },
            },
            account: {
              select: {
                name: true,
                currency: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const items = [
    ...payments.map((transaction) => ({
      date: transaction.date,
      kind: transaction.type,
      title: transaction.category?.name ?? "Без категории",
      subtitle: transaction.description ?? null,
      amount: formatMoney(transaction.amount, transaction.account.currency),
      details: `Счёт: ${transaction.account.name}`,
    })),
    ...transfers.map((transaction) => ({
      date: transaction.date,
      kind: TRANSFER_TRANSACTION_FILTER_VALUE,
      title: "Перевод",
      subtitle: transaction.description ?? null,
      amount: `${formatMoney(transaction.amount, transaction.fromAccount.currency)} -> ${formatMoney(transaction.toAmount, transaction.toAccount.currency)}`,
      details: `${transaction.fromAccount.name} -> ${transaction.toAccount.name}`,
    })),
    ...debtTransactions.map((transaction) => ({
      date: transaction.date,
      kind: DEBT_TRANSACTION_FILTER_VALUE,
      title: `Долг: ${transaction.debt.personName}`,
      subtitle: transaction.type,
      amount: formatMoney(transaction.amount, transaction.debt.currency),
      details: transaction.account?.name ?? "Без счёта",
    })),
  ]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, limit)
    .map((item) => ({
      ...item,
      date: format(item.date, "dd.MM.yyyy"),
    }));

  return {
    period: range.label,
    items,
    totalReturned: items.length,
  };
}
