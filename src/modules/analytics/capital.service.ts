"use server";

import { Currency } from "@prisma/client";
import { getServerSession } from "next-auth";

import { getAccounts } from "@/modules/accounts/account.service";
import { getDebts } from "@/modules/debts/debt.service";
import { DebtStatus, DebtType } from "@/modules/debts/debt.constants";
import { authOptions } from "@/shared/lib/auth";
import { addMoney, subtractMoney } from "@/shared/utils/money";

import type { CapitalByCurrency, CapitalFilters } from "./capital.types";

export async function getWorkspaceCapital(
  workspaceId: string,
  filters: CapitalFilters = {}
): Promise<{ data: CapitalByCurrency } | { error: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const accountsResult = await getAccounts(workspaceId);
    if ("error" in accountsResult) {
      return { error: accountsResult.error };
    }

    let accounts = accountsResult.data;
    if (filters.accountIds && filters.accountIds.length > 0) {
      accounts = accounts.filter((account) => filters.accountIds!.includes(account.id));
    }

    const debtsResult = await getDebts(workspaceId, {
      status: DebtStatus.OPEN,
    });
    if ("error" in debtsResult) {
      return { error: "Не удалось загрузить долги" };
    }

    const debts = debtsResult.data;

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
