import Big from "big.js";
import { format } from "date-fns";

import { DebtStatus, DebtType } from "@/modules/debts/debt.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { formatMoney } from "@/shared/utils/money";

import type { DebtsOverviewInput } from "./assistant-tool.schemas";
import { convertToBaseCurrency, createExchangeRateResolver, normalizeLimit } from "./assistant-tool.utils";

export async function buildDebtsOverview(workspaceId: string, baseCurrency: string, input: DebtsOverviewInput) {
  await requireWorkspaceAccess(workspaceId);

  const resolveRate = createExchangeRateResolver();
  const limit = normalizeLimit(input.limit, 8, 20);
  const statusFilter = input.status ?? "open";
  const typeFilter = input.type ?? "all";

  const debts = await prisma.debt.findMany({
    where: {
      workspaceId,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    },
    include: { account: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { date: "desc" }],
    take: 100,
  });

  let totalRemainingInBaseCurrency = "0";
  let lentRemainingInBaseCurrency = "0";
  let borrowedRemainingInBaseCurrency = "0";

  const items = [];

  for (const debt of debts) {
    const amountToConvert = debt.status === DebtStatus.OPEN ? debt.remainingAmount : debt.amount;
    const convertedAmount = await convertToBaseCurrency(
      amountToConvert,
      debt.currency,
      baseCurrency,
      debt.date,
      resolveRate
    );

    totalRemainingInBaseCurrency = new Big(totalRemainingInBaseCurrency).plus(convertedAmount).toString();

    if (debt.type === DebtType.LENT) {
      lentRemainingInBaseCurrency = new Big(lentRemainingInBaseCurrency).plus(convertedAmount).toString();
    }

    if (debt.type === DebtType.BORROWED) {
      borrowedRemainingInBaseCurrency = new Big(borrowedRemainingInBaseCurrency).plus(convertedAmount).toString();
    }

    items.push({
      personName: debt.personName,
      status: debt.status,
      type: debt.type,
      amount: formatMoney(debt.amount, debt.currency),
      remainingAmount: formatMoney(debt.remainingAmount, debt.currency),
      accountName: debt.account?.name ?? null,
      date: format(debt.date, "dd.MM.yyyy"),
      amountInBaseCurrency: formatMoney(convertedAmount, baseCurrency),
    });
  }

  return {
    statusFilter,
    typeFilter,
    baseCurrency,
    totalCount: debts.length,
    totalInBaseCurrency: formatMoney(totalRemainingInBaseCurrency, baseCurrency),
    lentInBaseCurrency: formatMoney(lentRemainingInBaseCurrency, baseCurrency),
    borrowedInBaseCurrency: formatMoney(borrowedRemainingInBaseCurrency, baseCurrency),
    items: items.slice(0, limit),
  };
}
