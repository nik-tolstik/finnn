import { useMemo } from "react";

import type { CombinedTransaction } from "@/modules/transactions/transaction.types";

import { buildCombinedTransactionGroups } from "../utils/buildCombinedTransactionGroups";

export function useGroupedCombinedTransactions(transactions: CombinedTransaction[]) {
  return useMemo(() => buildCombinedTransactionGroups(transactions), [transactions]);
}
