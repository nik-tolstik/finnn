import { CombinedTransactionsDialogs } from "./components/CombinedTransactionsDialogs";
import { CombinedTransactionsView } from "./components/CombinedTransactionsView";
import { useCombinedTransactionsController } from "./hooks/useCombinedTransactionsController";
import { useCombinedTransactionsWorkspace } from "./hooks/useCombinedTransactionsWorkspace";
import { useGroupedCombinedTransactions } from "./hooks/useGroupedCombinedTransactions";
import type { CombinedTransactionsListProps } from "./types";

export function CombinedTransactionsList({
  hideAmounts = false,
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
  const hasMountedDialog = Object.values(controller.dialogs).some((dialog) => dialog.mounted);

  return (
    <>
      <CombinedTransactionsView
        groups={groups}
        hideAmounts={hideAmounts}
        workspaceName={workspaceName}
        showLoadMore={showLoadMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        showDateHeaders={showDateHeaders}
        onTransactionClick={controller.openTransactionDialog}
        onDebtTransactionClick={controller.openDebtTransactionDialog}
      />
      {hasMountedDialog ? <CombinedTransactionsDialogs controller={controller} /> : null}
    </>
  );
}
