"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уверены, что хотите удалить категорию &quot;{categoryName}&quot;?
            {transactionCount > 0 && (
              <span className="block mt-2 font-medium text-foreground">
                Эта категория используется в {transactionCount}{" "}
                {transactionCount === 1
                  ? "транзакции"
                  : transactionCount < 5
                    ? "транзакциях"
                    : "транзакциях"}
                .
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
