import Big from "big.js";

import { DebtStatus } from "@/modules/debts/debt.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { formatMoney } from "@/shared/utils/money";

import { convertToBaseCurrency, createExchangeRateResolver } from "./assistant-tool.utils";

export async function buildWorkspaceOverview(workspaceId: string) {
  await requireWorkspaceAccess(workspaceId);

  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      name: true,
      baseCurrency: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          members: true,
          accounts: true,
          debts: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace не найден");
  }

  const resolveRate = createExchangeRateResolver();
  const currentDate = new Date();

  const [accounts, openDebts] = await Promise.all([
    prisma.account.findMany({
      where: {
        workspaceId,
        archived: false,
      },
      select: {
        id: true,
        name: true,
        balance: true,
        currency: true,
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          order: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    prisma.debt.findMany({
      where: {
        workspaceId,
        status: DebtStatus.OPEN,
      },
      select: {
        personName: true,
        type: true,
        remainingAmount: true,
        currency: true,
        date: true,
      },
    }),
  ]);

  await resolveRate.preload([
    ...accounts.map((account) => ({
      date: currentDate,
      fromCurrency: account.currency,
      toCurrency: workspace.baseCurrency,
    })),
    ...openDebts.map((debt) => ({
      date: debt.date,
      fromCurrency: debt.currency,
      toCurrency: workspace.baseCurrency,
    })),
  ]);

  let totalBalanceInBaseCurrency = "0";

  for (const account of accounts) {
    const convertedBalance = await convertToBaseCurrency(
      account.balance,
      account.currency,
      workspace.baseCurrency,
      currentDate,
      resolveRate
    );

    totalBalanceInBaseCurrency = new Big(totalBalanceInBaseCurrency).plus(convertedBalance).toString();
  }

  let totalOpenDebtsInBaseCurrency = "0";

  for (const debt of openDebts) {
    const convertedDebt = await convertToBaseCurrency(
      debt.remainingAmount,
      debt.currency,
      workspace.baseCurrency,
      debt.date,
      resolveRate
    );

    totalOpenDebtsInBaseCurrency = new Big(totalOpenDebtsInBaseCurrency).plus(convertedDebt).toString();
  }

  return {
    workspace: {
      name: workspace.name,
      baseCurrency: workspace.baseCurrency,
      ownerName: workspace.owner.name,
      ownerEmail: workspace.owner.email,
    },
    counts: {
      members: workspace._count.members,
      accounts: workspace._count.accounts,
      debts: workspace._count.debts,
      openDebts: openDebts.length,
    },
    totalBalanceInBaseCurrency: formatMoney(totalBalanceInBaseCurrency, workspace.baseCurrency),
    totalOpenDebtsInBaseCurrency: formatMoney(totalOpenDebtsInBaseCurrency, workspace.baseCurrency),
    accounts: accounts.map((account) => ({
      name: account.name,
      balance: formatMoney(account.balance, account.currency),
      ownerName: account.owner?.name ?? null,
    })),
    largestOpenDebts: openDebts
      .map((debt) => ({
        personName: debt.personName,
        type: debt.type,
        remainingAmount: formatMoney(debt.remainingAmount, debt.currency),
      }))
      .slice(0, 5),
  };
}
