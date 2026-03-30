import { isSameDay, startOfDay } from "date-fns";

import type { CombinedTransaction } from "@/modules/transactions/transaction.types";

import type { PreparedCombinedTransaction, PreparedCombinedTransactionGroup } from "../types";

export function buildCombinedTransactionGroups(
  transactions: CombinedTransaction[]
): PreparedCombinedTransactionGroup[] {
  if (transactions.length === 0) {
    return [];
  }

  const groups: PreparedCombinedTransactionGroup[] = [];
  let currentDate: Date | null = null;
  let currentItems: PreparedCombinedTransaction[] = [];

  const pushCurrentGroup = () => {
    if (currentDate && currentItems.length > 0) {
      groups.push({
        date: currentDate,
        items: currentItems,
      });
    }
  };

  for (const transaction of transactions) {
    const transactionDate = startOfDay(new Date(transaction.data.date));

    if (!currentDate) {
      currentDate = transactionDate;
      currentItems = [transaction];
      continue;
    }

    if (!isSameDay(currentDate, transactionDate)) {
      pushCurrentGroup();
      currentDate = transactionDate;
      currentItems = [transaction];
      continue;
    }

    currentItems.push(transaction);
  }

  pushCurrentGroup();

  return groups;
}
