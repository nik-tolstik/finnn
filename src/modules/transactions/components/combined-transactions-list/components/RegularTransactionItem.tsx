import type { LucideIcon } from "lucide-react";

import { getAccountIcon } from "@/shared/utils/account-icons";

import type { TransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface RegularTransactionItemProps {
  transaction: TransactionWithRelations;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (transaction: TransactionWithRelations) => void;
}

export function RegularTransactionItem({
  transaction,
  workspaceName,
  WorkspaceIcon,
  onClick,
}: RegularTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "transaction",
      data: transaction,
    },
    workspaceName
  );
  const AccountIcon = getAccountIcon(transaction.account.icon);

  return (
    <TransactionDescriptionLine
      segments={segments}
      icon={<TransactionActorAvatar account={transaction.account} WorkspaceIcon={WorkspaceIcon} />}
      accountChips={{
        account: {
          color: transaction.account.color,
          icon: <AccountIcon className="size-3.5" />,
        },
      }}
      description={transaction.description?.trim() || undefined}
      onClick={() => {
        onClick(transaction);
      }}
    />
  );
}
