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
  hideAmounts?: boolean;
  workspaceName: string;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  showDateHeaders?: boolean;
  onTransactionClick: (transaction: ActionableCombinedTransaction) => void;
  onDebtTransactionClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function CombinedTransactionsView({
  groups,
  hideAmounts = false,
  workspaceName,
  showLoadMore,
  onLoadMore,
  isLoadingMore,
  showDateHeaders = true,
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
            {showDateHeaders ? (
              <div className="bg-background py-2">
                <h3 className="text-sm font-medium text-muted-foreground">{formatDateHeader(group.date)}</h3>
              </div>
            ) : null}
            {group.items.map((item) => (
              <div
                key={getTransactionKey(item)}
                className="rounded-xl shadow-[var(--transaction-card-shadow)] [contain-intrinsic-size:auto_96px] [content-visibility:auto] dark:shadow-sm"
              >
                <CombinedTransactionItem
                  hideAmounts={hideAmounts}
                  item={item}
                  workspaceName={workspaceName}
                  onTransactionClick={onTransactionClick}
                  onDebtTransactionClick={onDebtTransactionClick}
                />
              </div>
            ))}
          </div>
        ))
      )}

      {isLoadingMore && <TransactionsListSkeleton count={10} />}

      {showLoadMore && onLoadMore && !isLoadingMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onLoadMore}>
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}
