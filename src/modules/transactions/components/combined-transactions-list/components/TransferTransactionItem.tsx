import type { LucideIcon } from "lucide-react";

import { getAccountIcon } from "@/shared/utils/account-icons";

import type { TransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import type { TransferDisplayInfo } from "../types";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface TransferTransactionItemProps {
  transaction: TransactionWithRelations;
  transferInfo: TransferDisplayInfo;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (transaction: TransactionWithRelations) => void;
}

export function TransferTransactionItem({
  transaction,
  transferInfo,
  workspaceName,
  WorkspaceIcon,
  onClick,
}: TransferTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "transaction",
      data: transaction,
    },
    workspaceName,
    {
      toAccountName: transferInfo.account.name,
      toAmount: transferInfo.amount,
      toCurrency: transferInfo.account.currency,
    }
  );
  const FromAccountIcon = getAccountIcon(transaction.account.icon);
  const ToAccountIcon = getAccountIcon(transferInfo.account.icon);

  return (
    <TransactionDescriptionLine
      segments={segments}
      icon={<TransactionActorAvatar account={transaction.account} WorkspaceIcon={WorkspaceIcon} />}
      accountChips={{
        accountFrom: {
          color: transaction.account.color,
          icon: <FromAccountIcon className="size-3.5" />,
        },
        accountTo: {
          color: transferInfo.account.color,
          icon: <ToAccountIcon className="size-3.5" />,
        },
      }}
      onClick={() => {
        onClick(transaction);
      }}
    />
  );
}
