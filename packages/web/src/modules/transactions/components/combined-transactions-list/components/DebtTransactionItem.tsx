import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { AccountIcon } from "@/shared/utils/account-icons";

import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { concealTransactionAmountDisplay, getDebtTransactionAmountDisplay } from "../utils/transactionAmountDisplay";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface DebtTransactionItemProps {
  debtTransaction: DebtTransactionWithRelations;
  hideAmounts?: boolean;
  workspaceName: string;
  onClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function DebtTransactionItem({
  debtTransaction,
  hideAmounts = false,
  workspaceName,
  onClick,
}: DebtTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "debtTransaction",
      data: debtTransaction,
    },
    workspaceName
  );
  const amount = getDebtTransactionAmountDisplay(debtTransaction);
  const displayedAmount = hideAmounts ? concealTransactionAmountDisplay(amount) : amount;
  const actorAvatar = debtTransaction.account ? (
    <TransactionActorAvatar account={debtTransaction.account} showName workspaceName={workspaceName} />
  ) : (
    <UserDisplay name={debtTransaction.debt.personName} showName size="sm" />
  );

  return (
    <TransactionDescriptionLine
      segments={segments}
      footer={{
        icon: actorAvatar,
        chips: debtTransaction.account
          ? [
              {
                color: debtTransaction.account.color,
                icon: (
                  <AccountIcon
                    iconName={debtTransaction.account.icon}
                    accountColor={debtTransaction.account.color}
                    accountName={debtTransaction.account.name}
                    className="size-3.5"
                  />
                ),
                label: debtTransaction.account.name,
              },
            ]
          : undefined,
        trailing: displayedAmount.secondaryText
          ? {
              text: displayedAmount.secondaryText,
              className: displayedAmount.secondaryClassName,
            }
          : undefined,
      }}
      amount={displayedAmount}
      descriptionPlacement="below"
      description={debtTransaction.description?.trim() || undefined}
      onClick={() => {
        onClick(debtTransaction);
      }}
    />
  );
}
