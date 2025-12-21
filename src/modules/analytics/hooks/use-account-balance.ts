"use client";

import { useQuery } from "@tanstack/react-query";
import { getAccountBalanceHistory } from "../actions";

export function useAccountBalanceHistory(
  accountId: string,
  startDate?: Date,
  endDate?: Date
) {
  return useQuery({
    queryKey: ["account-balance-history", accountId, startDate, endDate],
    queryFn: () => getAccountBalanceHistory(accountId, startDate, endDate),
    enabled: !!accountId,
  });
}

