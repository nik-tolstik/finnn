import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { removeDebtsFromCache, runOptimisticWorkspaceMutation } from "@/shared/lib/optimistic-workspace-updates";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { formatMoney } from "@/shared/utils/money";

import { deleteDebt } from "../../debt.api";
import { DebtStatus } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

interface DeleteDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

interface DeleteDebtPanelProps {
  debt: DebtWithRelations;
  workspaceId: string;
  onComplete: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function DeleteDebtPanel({ debt, workspaceId, onComplete, onSubmittingChange }: DeleteDebtPanelProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    onSubmittingChange?.(isDeleting);
  }, [isDeleting, onSubmittingChange]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions", "accounts"],
        apply: (context) => removeDebtsFromCache(context, [debt.id]),
        mutation: () => deleteDebt(debt.id),
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Долг удалён");
        onComplete();
      }
    } catch {
      toast.error("Не удалось удалить долг");
    } finally {
      setIsDeleting(false);
    }
  };

  const deletionAmount = debt.status === DebtStatus.CLOSED ? debt.amount : debt.remainingAmount;

  return (
    <>
      <DialogContent>
        <DialogDescription>
          Вы уверены, что хотите удалить долг {debt.personName} на сумму {formatMoney(deletionAmount, debt.currency)}?
          Вместе с ним будет удалена связанная история. Это действие нельзя отменить.
        </DialogDescription>
      </DialogContent>
      <DialogFooter>
        <Button onClick={handleDelete} disabled={isDeleting} size="xl" type="button" variant="danger">
          {isDeleting ? "Удаление..." : "Удалить"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function DeleteDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: DeleteDebtDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Удалить долг?</DialogTitle>
        </DialogHeader>
        <DeleteDebtPanel debt={debt} workspaceId={workspaceId} onComplete={() => onOpenChange(false)} />
      </DialogWindow>
    </Dialog>
  );
}
