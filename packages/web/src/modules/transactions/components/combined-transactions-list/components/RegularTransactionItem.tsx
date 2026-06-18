import { getAccountIcon } from "@/shared/utils/account-icons";

import type { PaymentTransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { getPaymentTransactionAmountDisplay } from "../utils/transactionAmountDisplay";
import { AiCreatedBadge } from "./AiCreatedBadge";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface RegularTransactionItemProps {
  transaction: PaymentTransactionWithRelations;
  workspaceName: string;
  onClick: (transaction: PaymentTransactionWithRelations) => void;
}

export function RegularTransactionItem({ transaction, workspaceName, onClick }: RegularTransactionItemProps) {
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
        icon: <TransactionActorAvatar account={transaction.account} showName workspaceName={workspaceName} />,
        badges: transaction.createdByAi ? [<AiCreatedBadge key="ai-created" />] : undefined,
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
