import { formatMoney } from "@/shared/utils/money";

import type { DebtTransactionWithRelations } from "../../../debt.types";

interface EditDebtTransactionSummaryProps {
  debtTransaction: DebtTransactionWithRelations;
}

export function EditDebtTransactionSummary({ debtTransaction }: EditDebtTransactionSummaryProps) {
  return (
    <div className="rounded-lg bg-muted p-3 space-y-1">
      <div className="text-sm text-muted-foreground">Контрагент</div>
      <div className="font-medium">{debtTransaction.debt.personName}</div>
      <div className="text-sm text-muted-foreground">
        Остаток долга: {formatMoney(debtTransaction.debt.remainingAmount, debtTransaction.debt.currency)}
      </div>
      {debtTransaction.description?.trim() ? (
        <div className="pt-2">
          <div className="text-sm text-muted-foreground">Описание</div>
          <div className="whitespace-pre-wrap text-sm">{debtTransaction.description.trim()}</div>
        </div>
      ) : null}
    </div>
  );
}
