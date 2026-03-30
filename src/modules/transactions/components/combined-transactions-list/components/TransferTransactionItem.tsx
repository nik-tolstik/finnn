import type { LucideIcon } from "lucide-react";

import { getAccountIcon } from "@/shared/utils/account-icons";

import type { TransferTransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface TransferTransactionItemProps {
  transaction: TransferTransactionWithRelations;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (transaction: TransferTransactionWithRelations) => void;
}

export function TransferTransactionItem({
  transaction,
  workspaceName,
  WorkspaceIcon,
  onClick,
}: TransferTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "transferTransaction",
      data: transaction,
    },
    workspaceName
  );
  const FromAccountIcon = getAccountIcon(transaction.fromAccount.icon);
  const ToAccountIcon = getAccountIcon(transaction.toAccount.icon);

  return (
    <TransactionDescriptionLine
      segments={segments}
      icon={<TransactionActorAvatar account={transaction.fromAccount} WorkspaceIcon={WorkspaceIcon} />}
      accountChips={{
        accountFrom: {
          color: transaction.fromAccount.color,
          icon: <FromAccountIcon className="size-3.5" />,
        },
        accountTo: {
          color: transaction.toAccount.color,
          icon: <ToAccountIcon className="size-3.5" />,
        },
      }}
      onClick={() => {
        onClick(transaction);
      }}
    />
  );
}
