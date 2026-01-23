"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogWindow,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatMoney } from "@/shared/utils/money";

import { deleteDebt } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";

interface DeleteDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDebtDialog({ debt, workspaceId, open, onOpenChange }: DeleteDebtDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteDebt(debt.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Долг удалён");
        onOpenChange(false);
        await queryClient.invalidateQueries({ queryKey: ["debts", workspaceId] });
        router.refresh();
      }
    } catch {
      toast.error("Не удалось удалить долг");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Удалить долг?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить долг {debt.personName} на сумму{" "}
            {formatMoney(debt.remainingAmount, debt.currency)}? Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Отмена
            </Button>
          </DialogClose>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
