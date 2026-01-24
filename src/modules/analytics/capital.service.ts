"use server";

import { Currency } from "@prisma/client";
import { getServerSession } from "next-auth";

import { getAccounts } from "@/modules/accounts/account.service";
import { getDebts } from "@/modules/debts/debt.service";
import { DebtStatus, DebtType } from "@/modules/debts/debt.constants";
import { getExchangeRate } from "@/modules/currency/exchange-rate.service";
import { authOptions } from "@/shared/lib/auth";
import { addMoney, multiplyMoney, subtractMoney } from "@/shared/utils/money";

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    let debts = debtsResult.data;
    if (filters.debtType && filters.debtType !== "all") {
      const debtType = filters.debtType === "lent" ? DebtType.LENT : DebtType.BORROWED;
      debts = debts.filter((debt) => debt.type === debtType);
    }

    const targetCurrencies: Currency[] = [Currency.USD, Currency.EUR, Currency.BYN];
    const capital: CapitalByCurrency = {
      USD: "0",
      EUR: "0",
      BYN: "0",
    };

    for (const targetCurrency of targetCurrencies) {
      let totalCapital = "0";

      for (const account of accounts) {
        const accountCurrency = account.currency as Currency;
        let balanceInTargetCurrency = account.balance;

        if (accountCurrency !== targetCurrency) {
          const exchangeRateResult = await getExchangeRate(today, accountCurrency, targetCurrency);
          if ("error" in exchangeRateResult) {
            console.warn(
              `Не удалось получить курс для счёта ${account.id}: ${exchangeRateResult.error}`
            );
            continue;
          }
          balanceInTargetCurrency = multiplyMoney(account.balance, exchangeRateResult.data.toString());
        }

        totalCapital = addMoney(totalCapital, balanceInTargetCurrency);
      }

      for (const debt of debts) {
        const debtCurrency = debt.currency as Currency;
        let debtAmountInTargetCurrency = debt.remainingAmount;

        if (debtCurrency !== targetCurrency) {
          const exchangeRateResult = await getExchangeRate(today, debtCurrency, targetCurrency);
          if ("error" in exchangeRateResult) {
            console.warn(
              `Не удалось получить курс для долга ${debt.id}: ${exchangeRateResult.error}`
            );
            continue;
          }
          debtAmountInTargetCurrency = multiplyMoney(
            debt.remainingAmount,
            exchangeRateResult.data.toString()
          );
        }

        if (debt.type === DebtType.LENT) {
          totalCapital = addMoney(totalCapital, debtAmountInTargetCurrency);
        } else if (debt.type === DebtType.BORROWED) {
          totalCapital = subtractMoney(totalCapital, debtAmountInTargetCurrency);
        }
      }

      capital[targetCurrency] = totalCapital;
    }

    return { data: capital };
  } catch (error: any) {
    return { error: error.message || "Не удалось рассчитать капитал" };
  }
}
