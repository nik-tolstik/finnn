import type { LucideIcon } from "lucide-react";

import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { Button } from "@/shared/ui/button";

import { TransactionsListSkeleton } from "../../transactions-list-skeleton/TransactionsListSkeleton";
import type {
  ActionableCombinedTransaction,
  PreparedCombinedTransaction,
  PreparedCombinedTransactionGroup,
} from "../types";
import { formatDateHeader } from "../utils/formatDateHeader";
import { CombinedTransactionItem } from "./CombinedTransactionItem";

function getTransactionKey(item: PreparedCombinedTransaction) {
  if (item.kind === "debtTransaction") {
    return `debt-${item.data.id}`;
  }

  if (item.kind === "transferTransaction") {
    return `transfer-${item.data.id}`;
  }

  return `payment-${item.data.id}`;
}

interface CombinedTransactionsViewProps {
  groups: PreparedCombinedTransactionGroup[];
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onTransactionClick: (transaction: ActionableCombinedTransaction) => void;
  onDebtTransactionClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function CombinedTransactionsView({
  groups,
  workspaceName,
  WorkspaceIcon,
  showLoadMore,
  onLoadMore,
  isLoadingMore,
  onTransactionClick,
  onDebtTransactionClick,
}: CombinedTransactionsViewProps) {
  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">Нет транзакций.</div>
      ) : (
        groups.map((group) => (
          <div key={group.date.toISOString()} className="space-y-3">
            <div className="sticky top-16 z-10 bg-background py-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {formatDateHeader(group.date)}
              </h3>
            </div>
            {group.items.map((item) => (
              <CombinedTransactionItem
                key={getTransactionKey(item)}
                item={item}
                workspaceName={workspaceName}
                WorkspaceIcon={WorkspaceIcon}
                onTransactionClick={onTransactionClick}
                onDebtTransactionClick={onDebtTransactionClick}
              />
            ))}
          </div>
        ))
      )}

      {isLoadingMore && <TransactionsListSkeleton count={10} />}

      {showLoadMore && onLoadMore && !isLoadingMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}
