"use client";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import type { ScheduledPayment } from "../scheduled-payment.types";
import { getScheduledPaymentAmountLabel } from "../scheduled-payment.utils";

interface DeleteScheduledPaymentDialogProps {
  isDeleting: boolean;
  onCloseComplete?: () => void;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  payment: ScheduledPayment;
}

export function DeleteScheduledPaymentDialog({
  isDeleting,
  onCloseComplete,
  onConfirm,
  onOpenChange,
  open,
  payment,
}: DeleteScheduledPaymentDialogProps) {
  const handleDelete = async () => {
    try {
      await onConfirm();
    } catch {
      // Parent mutation owns the user-facing toast.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Удалить платёж?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить «{payment.name}» на сумму {getScheduledPaymentAmountLabel(payment)}? История
            оплат, пропусков и напоминаний по этой платёжке тоже будет удалена.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isDeleting} onClick={() => onOpenChange(false)} variant="outline">
            Отмена
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
