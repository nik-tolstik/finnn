import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import type { PaymentTransactionWithRelations, TransferTransactionWithRelations } from "../../../transaction.types";
import type { ActionableCombinedTransaction, PreparedCombinedTransaction } from "../types";
import { DebtTransactionItem } from "./DebtTransactionItem";
import { RegularTransactionItem } from "./RegularTransactionItem";
import { TransferTransactionItem } from "./TransferTransactionItem";

interface CombinedTransactionItemProps {
  hideAmounts?: boolean;
  item: PreparedCombinedTransaction;
  workspaceName: string;
  onTransactionClick: (transaction: ActionableCombinedTransaction) => void;
  onDebtTransactionClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function CombinedTransactionItem({
  hideAmounts = false,
  item,
  workspaceName,
  onTransactionClick,
  onDebtTransactionClick,
}: CombinedTransactionItemProps) {
  if (item.kind === "debtTransaction") {
    return (
      <DebtTransactionItem
        debtTransaction={item.data}
        hideAmounts={hideAmounts}
        workspaceName={workspaceName}
        onClick={onDebtTransactionClick}
      />
    );
  }

  if (item.kind === "transferTransaction") {
    return (
      <TransferTransactionItem
        transaction={item.data}
        hideAmounts={hideAmounts}
        onClick={(transaction: TransferTransactionWithRelations) => {
          onTransactionClick({
            kind: "transferTransaction",
            data: transaction,
          });
        }}
      />
    );
  }

  return (
    <RegularTransactionItem
      transaction={item.data}
      hideAmounts={hideAmounts}
      workspaceName={workspaceName}
      onClick={(transaction: PaymentTransactionWithRelations) => {
        onTransactionClick({
          kind: "paymentTransaction",
          data: transaction,
        });
      }}
    />
  );
}
