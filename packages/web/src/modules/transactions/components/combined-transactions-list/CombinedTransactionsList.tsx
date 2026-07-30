import { lazy, Suspense } from "react";

import { CombinedTransactionsView } from "./components/CombinedTransactionsView";
import { useCombinedTransactionsController } from "./hooks/useCombinedTransactionsController";
import { useCombinedTransactionsWorkspace } from "./hooks/useCombinedTransactionsWorkspace";
import { useGroupedCombinedTransactions } from "./hooks/useGroupedCombinedTransactions";
import type { CombinedTransactionsListProps } from "./types";

const CombinedTransactionsDialogs = lazy(() =>
  import("./components/CombinedTransactionsDialogs").then((module) => ({
    default: module.CombinedTransactionsDialogs,
  }))
);

function DialogLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/18 backdrop-blur-sm" role="status">
      <div className="rounded-lg bg-dialog px-4 py-3 text-sm shadow-lg">Загрузка…</div>
    </div>
  );
}

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
  const hasMountedDialog = Object.values(controller.dialogs).some((dialog) => dialog.mounted);

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
      {hasMountedDialog ? (
        <Suspense fallback={<DialogLoadingFallback />}>
          <CombinedTransactionsDialogs controller={controller} />
        </Suspense>
      ) : null}
    </>
  );
}
