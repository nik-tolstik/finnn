import type { LucideIcon } from "lucide-react";

import { getAccountIcon } from "@/shared/utils/account-icons";

import type { PaymentTransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { getPaymentTransactionAmountDisplay } from "../utils/transactionAmountDisplay";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface RegularTransactionItemProps {
  transaction: PaymentTransactionWithRelations;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (transaction: PaymentTransactionWithRelations) => void;
}

export function RegularTransactionItem({
  transaction,
  workspaceName,
  WorkspaceIcon,
  onClick,
}: RegularTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "paymentTransaction",
      data: transaction,
    },
    workspaceName
  );
  const AccountIcon = getAccountIcon(transaction.account.icon);
  const amount = getPaymentTransactionAmountDisplay(transaction);

  return (
    <TransactionDescriptionLine
      segments={segments}
      footer={{
        icon: (
          <TransactionActorAvatar
            account={transaction.account}
            WorkspaceIcon={WorkspaceIcon}
            showName
            workspaceName={workspaceName}
          />
        ),
        chips: [
          {
            color: transaction.account.color,
            icon: <AccountIcon className="size-3.5" />,
            label: transaction.account.name,
          },
        ],
      }}
      amount={amount}
      descriptionPlacement="below"
      description={transaction.description?.trim() || undefined}
      onClick={() => {
        onClick(transaction);
      }}
    />
  );
}
