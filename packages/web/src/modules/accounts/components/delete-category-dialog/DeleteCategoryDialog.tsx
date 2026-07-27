"use client";

import { CategoryIcon } from "@/shared/components/category-icon";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  categoryIcon?: string | null;
  categoryIconAssetId?: string | null;
  transactionCount: number;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  categoryName,
  categoryIcon,
  categoryIconAssetId,
  transactionCount,
  onConfirm,
  isDeleting,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Удалить категорию</span>
            <CategoryIcon icon={categoryIcon} iconAssetId={categoryIconAssetId} />
            <span>{categoryName}?</span>
          </DialogTitle>
          <DialogDescription>Удаление категории нельзя отменить.</DialogDescription>
          {transactionCount > 0 && (
            <Alert status="warning" className="mt-3">
              Эта категория используется в{" "}
              <span className="font-semibold">
                {transactionCount} {transactionCount === 1 ? "транзакции" : "транзакциях"}
              </span>
              .
            </Alert>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm} disabled={isDeleting} size="xl" variant="danger">
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
