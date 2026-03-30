import { isSameDay, startOfDay } from "date-fns";

import { TransactionType } from "@/modules/transactions/transaction.constants";
import type { CombinedTransaction, TransactionWithRelations } from "@/modules/transactions/transaction.types";

import type { PreparedCombinedTransaction, PreparedCombinedTransactionGroup, TransferDisplayInfo } from "../types";

function getTransferDisplayInfo(
  transaction: TransactionWithRelations,
  processedTransferIds: Set<string>
): TransferDisplayInfo | null {
  // Transfers are stored as two linked transactions, but the list should render only the source side.
  if (transaction.transferTo || processedTransferIds.has(transaction.id) || !transaction.transferFrom) {
    return null;
  }

  processedTransferIds.add(transaction.transferFrom.toTransaction.id);

  return {
    account: transaction.transferFrom.toTransaction.account,
    amount: transaction.transferFrom.toAmount,
  };
}

function prepareCombinedTransaction(
  item: CombinedTransaction,
  processedTransferIds: Set<string>
): PreparedCombinedTransaction | null {
  if (item.kind === "debtTransaction") {
    return item;
  }

  if (item.data.type !== TransactionType.TRANSFER) {
    return item;
  }

  const transferInfo = getTransferDisplayInfo(item.data, processedTransferIds);

  if (!transferInfo) {
    return null;
  }

  return {
    kind: "transfer",
    data: item.data,
    transferInfo,
  };
}

export function buildCombinedTransactionGroups(
  transactions: CombinedTransaction[]
): PreparedCombinedTransactionGroup[] {
  if (transactions.length === 0) {
    return [];
  }

  const processedTransferIds = new Set<string>();
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
    const preparedTransaction = prepareCombinedTransaction(transaction, processedTransferIds);

    if (!currentDate) {
      currentDate = transactionDate;
      currentItems = preparedTransaction ? [preparedTransaction] : [];
      continue;
    }

    if (!isSameDay(currentDate, transactionDate)) {
      pushCurrentGroup();
      currentDate = transactionDate;
      currentItems = preparedTransaction ? [preparedTransaction] : [];
      continue;
    }

    if (preparedTransaction) {
      currentItems.push(preparedTransaction);
    }
  }

  pushCurrentGroup();

  return groups;
}
