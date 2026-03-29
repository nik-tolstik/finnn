"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  transactionCount: number;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  categoryName,
  transactionCount,
  onConfirm,
  isDeleting,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Удалить категорию?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить категорию &quot;{categoryName}&quot;?
            {transactionCount > 0 && (
              <span className="block mt-2 font-medium text-foreground">
                Эта категория используется в {transactionCount}{" "}
                {transactionCount === 1 ? "транзакции" : transactionCount < 5 ? "транзакциях" : "транзакциях"}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Отмена
            </Button>
          </DialogClose>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
