"use server";

import { DebtStatus, DebtType } from "@/modules/debts/debt.constants";
import { prisma } from "@/shared/lib/prisma";
import { requireWorkspaceAccess } from "@/shared/lib/server-access";
import { addMoney, subtractMoney } from "@/shared/utils/money";

import type { CapitalByCurrency, CapitalFilters } from "./capital.types";

export async function getWorkspaceCapital(
  workspaceId: string,
  filters: CapitalFilters = {}
): Promise<{ data: CapitalByCurrency } | { error: string }> {
  try {
    await requireWorkspaceAccess(workspaceId);

    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        archived: false,
        ...(filters.accountIds?.length
          ? {
              id: {
                in: filters.accountIds,
              },
            }
          : {}),
      },
      select: {
        balance: true,
        currency: true,
      },
    });

    const debts = await prisma.debt.findMany({
      where: {
        workspaceId,
        status: DebtStatus.OPEN,
      },
      select: {
        type: true,
        remainingAmount: true,
        currency: true,
      },
    });

    const capital: CapitalByCurrency = {
      USD: "0",
      EUR: "0",
      BYN: "0",
    };

    for (const account of accounts) {
      const accountCurrency = account.currency as keyof CapitalByCurrency;
      capital[accountCurrency] = addMoney(capital[accountCurrency], account.balance);
    }

    if (!filters.excludeDebts) {
      for (const debt of debts) {
        const debtCurrency = debt.currency as keyof CapitalByCurrency;
        
        if (debt.type === DebtType.LENT) {
          capital[debtCurrency] = addMoney(capital[debtCurrency], debt.remainingAmount);
        } else if (debt.type === DebtType.BORROWED) {
          capital[debtCurrency] = subtractMoney(capital[debtCurrency], debt.remainingAmount);
        }
      }
    }

    return { data: capital };
  } catch (error: any) {
    return { error: error.message || "Не удалось рассчитать капитал" };
  }
}
