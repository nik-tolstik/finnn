import type { Account, UserReference } from "@/modules/accounts/account.types";

import type { DebtTransactionWithRelations } from "../../debt.types";

export interface EditDebtTransactionDialogProps {
  debtTransaction: DebtTransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onSuccess?: () => void;
}

export type EditDebtTransactionDialogAccount = Account & {
  owner: UserReference | null;
};
