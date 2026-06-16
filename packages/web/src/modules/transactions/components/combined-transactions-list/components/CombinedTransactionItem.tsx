import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import type { PaymentTransactionWithRelations, TransferTransactionWithRelations } from "../../../transaction.types";
import type { ActionableCombinedTransaction, PreparedCombinedTransaction } from "../types";
import { DebtTransactionItem } from "./DebtTransactionItem";
import { RegularTransactionItem } from "./RegularTransactionItem";
import { TransferTransactionItem } from "./TransferTransactionItem";

interface CombinedTransactionItemProps {
  item: PreparedCombinedTransaction;
  workspaceName: string;
  onTransactionClick: (transaction: ActionableCombinedTransaction) => void;
  onDebtTransactionClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function CombinedTransactionItem({
  item,
  workspaceName,
  onTransactionClick,
  onDebtTransactionClick,
}: CombinedTransactionItemProps) {
  if (item.kind === "debtTransaction") {
    return (
      <DebtTransactionItem debtTransaction={item.data} workspaceName={workspaceName} onClick={onDebtTransactionClick} />
    );
  }

  if (item.kind === "transferTransaction") {
    return (
      <TransferTransactionItem
        transaction={item.data}
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
