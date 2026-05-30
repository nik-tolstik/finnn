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
}: CombinedTransactionsListProps) {
  const groups = useGroupedCombinedTransactions(transactions);
  const { workspaceName, WorkspaceIcon } = useCombinedTransactionsWorkspace({ workspaceId });
  const controller = useCombinedTransactionsController({ workspaceId });

  return (
    <>
      <CombinedTransactionsView
        groups={groups}
        workspaceName={workspaceName}
        WorkspaceIcon={WorkspaceIcon}
        showLoadMore={showLoadMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        onTransactionClick={controller.openTransactionActions}
        onDebtTransactionClick={controller.openDebtTransactionActions}
      />
      <CombinedTransactionsDialogs controller={controller} />
    </>
  );
}
