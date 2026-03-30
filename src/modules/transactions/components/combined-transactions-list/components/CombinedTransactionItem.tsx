import type { LucideIcon } from "lucide-react";

import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";

import type { TransactionWithRelations } from "../../../transaction.types";
import type { PreparedCombinedTransaction } from "../types";
import { DebtTransactionItem } from "./DebtTransactionItem";
import { RegularTransactionItem } from "./RegularTransactionItem";
import { TransferTransactionItem } from "./TransferTransactionItem";

interface CombinedTransactionItemProps {
  item: PreparedCombinedTransaction;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onTransactionClick: (transaction: TransactionWithRelations) => void;
  onDebtTransactionClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function CombinedTransactionItem({
  item,
  workspaceName,
  WorkspaceIcon,
  onTransactionClick,
  onDebtTransactionClick,
}: CombinedTransactionItemProps) {
  if (item.kind === "debtTransaction") {
    return (
      <DebtTransactionItem debtTransaction={item.data} workspaceName={workspaceName} onClick={onDebtTransactionClick} />
    );
  }

  if (item.kind === "transfer") {
    return (
      <TransferTransactionItem
        transaction={item.data}
        transferInfo={item.transferInfo}
        workspaceName={workspaceName}
        WorkspaceIcon={WorkspaceIcon}
        onClick={onTransactionClick}
      />
    );
  }

  return (
    <RegularTransactionItem
      transaction={item.data}
      workspaceName={workspaceName}
      WorkspaceIcon={WorkspaceIcon}
      onClick={onTransactionClick}
    />
  );
}
