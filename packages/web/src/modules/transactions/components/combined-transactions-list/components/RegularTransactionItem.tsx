import { CategoryIcon } from "@/shared/components/category-icon";
import { AccountIcon } from "@/shared/utils/account-icons";

import type { PaymentTransactionWithRelations } from "../../../transaction.types";
import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { concealTransactionAmountDisplay, getPaymentTransactionAmountDisplay } from "../utils/transactionAmountDisplay";
import { AiCreatedBadge } from "./AiCreatedBadge";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface RegularTransactionItemProps {
  hideAmounts?: boolean;
  transaction: PaymentTransactionWithRelations;
  workspaceName: string;
  onClick: (transaction: PaymentTransactionWithRelations) => void;
}

export function RegularTransactionItem({
  hideAmounts = false,
  transaction,
  workspaceName,
  onClick,
}: RegularTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "paymentTransaction",
      data: transaction,
    },
    workspaceName
  );
  const amount = getPaymentTransactionAmountDisplay(transaction);
  const displayedAmount = hideAmounts ? concealTransactionAmountDisplay(amount) : amount;

  return (
    <TransactionDescriptionLine
      segments={segments}
      categoryIcon={
        transaction.category ? (
          <CategoryIcon
            icon={transaction.category.icon}
            iconAssetId={transaction.category.iconAssetId}
            className="size-4"
          />
        ) : undefined
      }
      footer={{
        icon: <TransactionActorAvatar account={transaction.account} showName workspaceName={workspaceName} />,
        badges: transaction.createdByAi ? [<AiCreatedBadge key="ai-created" />] : undefined,
        chips: [
          {
            color: transaction.account.color,
            icon: (
              <AccountIcon
                iconName={transaction.account.icon}
                accountColor={transaction.account.color}
                accountName={transaction.account.name}
                className="size-3.5"
              />
            ),
            label: transaction.account.name,
          },
        ],
      }}
      amount={displayedAmount}
      descriptionPlacement="below"
      description={transaction.description?.trim() || undefined}
      onClick={() => {
        onClick(transaction);
      }}
    />
  );
}
