"use client";

import { CombinedTransactionsDialogs } from "./components/CombinedTransactionsDialogs";
import { CombinedTransactionsView } from "./components/CombinedTransactionsView";
import { useCombinedTransactionsController } from "./hooks/useCombinedTransactionsController";
import { useCombinedTransactionsWorkspace } from "./hooks/useCombinedTransactionsWorkspace";
import { useGroupedCombinedTransactions } from "./hooks/useGroupedCombinedTransactions";
import type { CombinedTransactionsListProps } from "./types";

export function CombinedTransactionsList({
  transactions,
  showLoadMore,
  onLoadMore,
  workspaceId,
  isLoadingMore,
  showDateHeaders,
}: CombinedTransactionsListProps) {
  const groups = useGroupedCombinedTransactions(transactions);
  const { workspaceName } = useCombinedTransactionsWorkspace({ workspaceId });
  const controller = useCombinedTransactionsController({ workspaceId });

  return (
    <>
      <CombinedTransactionsView
        groups={groups}
        workspaceName={workspaceName}
        showLoadMore={showLoadMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        showDateHeaders={showDateHeaders}
        onTransactionClick={controller.openTransactionActions}
        onDebtTransactionClick={controller.openDebtTransactionActions}
      />
      <CombinedTransactionsDialogs controller={controller} />
    </>
  );
}
