import { DebtStatus, DebtType } from "../../debt.constants";

export const DEBT_DIALOG_DEFAULT_OPERATION = "close" as const;

export type DebtDialogOperation = "close" | "add" | "transaction";

interface DebtDialogConfigDebt {
  status: string;
  type: string;
}

export interface DebtDialogOperationOption {
  label: string;
  value: DebtDialogOperation;
}

export function getDebtDialogOperationOptions(debt: DebtDialogConfigDebt): DebtDialogOperationOption[] {
  if (debt.status !== DebtStatus.OPEN) {
    return [];
  }

  return [
    { value: "close", label: "Погасить" },
    { value: "add", label: debt.type === DebtType.LENT ? "Дать ещё" : "Взять ещё" },
    { value: "transaction", label: "Транзакция" },
  ];
}

export function getDebtDialogCapabilities(debt: DebtDialogConfigDebt) {
  const hasOperations = debt.status === DebtStatus.OPEN;

  return {
    canDelete: true,
    canEdit: hasOperations,
    hasOperations,
  };
}
