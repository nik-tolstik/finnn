import { DebtTransactionType, DebtType } from "@/modules/debts/debt.constants";
import type { DebtTransactionWithRelations } from "@/modules/debts/debt.types";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { getAccountIcon } from "@/shared/utils/account-icons";

import { getTransactionDescriptionSegments } from "../../../utils/transactionDescription";
import { TransactionDescriptionLine } from "../../transaction-description-line/TransactionDescriptionLine";

interface DebtTransactionItemProps {
  debtTransaction: DebtTransactionWithRelations;
  workspaceName: string;
  onClick: (debtTransaction: DebtTransactionWithRelations) => void;
}

export function DebtTransactionItem({ debtTransaction, workspaceName, onClick }: DebtTransactionItemProps) {
  const { segments } = getTransactionDescriptionSegments(
    {
      kind: "debtTransaction",
      data: debtTransaction,
    },
    workspaceName
  );
  const isAccountOwnerActor =
    (debtTransaction.debt.type === DebtType.LENT && debtTransaction.type !== DebtTransactionType.CLOSED) ||
    (debtTransaction.debt.type === DebtType.BORROWED && debtTransaction.type === DebtTransactionType.CLOSED);
  const DebtAccountIcon = debtTransaction.account ? getAccountIcon(debtTransaction.account.icon) : null;
  const actorAvatar =
    isAccountOwnerActor && debtTransaction.account?.owner ? (
      <UserDisplay
        name={debtTransaction.account.owner.name}
        email={debtTransaction.account.owner.email}
        image={debtTransaction.account.owner.image}
        showName={false}
        size="sm"
      />
    ) : (
      <UserDisplay name={debtTransaction.debt.personName} showName={false} size="sm" />
    );

  return (
    <TransactionDescriptionLine
      segments={segments}
      icon={actorAvatar}
      accountChips={
        debtTransaction.account && DebtAccountIcon
          ? {
              account: {
                color: debtTransaction.account.color,
                icon: <DebtAccountIcon className="size-3.5" />,
              },
            }
          : undefined
      }
      onClick={() => {
        onClick(debtTransaction);
      }}
    />
  );
}
