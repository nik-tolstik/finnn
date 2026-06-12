import type { LucideIcon } from "lucide-react";

import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { getAccountIcon } from "@/shared/utils/account-icons";

import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";
import { getDebtTransactionAmountDisplay } from "../utils/transactionAmountDisplay";
import { TransactionActorAvatar } from "./TransactionActorAvatar";

interface DebtTransactionItemProps {
  debtTransaction: DebtTransactionWithRelations;
  workspaceName: string;
  WorkspaceIcon: LucideIcon;
  onClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function DebtTransactionItem({
  debtTransaction,
  workspaceName,
  WorkspaceIcon,
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
  const DebtAccountIcon = debtTransaction.account ? getAccountIcon(debtTransaction.account.icon) : null;
  const actorAvatar = debtTransaction.account ? (
    <TransactionActorAvatar
      account={debtTransaction.account}
      WorkspaceIcon={WorkspaceIcon}
      showName
      workspaceName={workspaceName}
    />
  ) : (
    <UserDisplay name={debtTransaction.debt.personName} showName size="sm" />
  );

  return (
    <TransactionDescriptionLine
      segments={segments}
      footer={{
        icon: actorAvatar,
        chips:
          debtTransaction.account && DebtAccountIcon
            ? [
                {
                  color: debtTransaction.account.color,
                  icon: <DebtAccountIcon className="size-3.5" />,
                  label: debtTransaction.account.name,
                },
              ]
            : undefined,
        trailing: amount.secondaryText
          ? {
              text: amount.secondaryText,
              className: amount.secondaryClassName,
            }
          : undefined,
      }}
      amount={amount}
      onClick={() => {
        onClick(debtTransaction);
      }}
    />
  );
}
