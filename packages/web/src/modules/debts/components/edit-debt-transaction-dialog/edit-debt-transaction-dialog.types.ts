import type { Account, User } from "@prisma/client";

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
  owner: Pick<User, "id" | "name" | "email" | "image"> | null;
};
