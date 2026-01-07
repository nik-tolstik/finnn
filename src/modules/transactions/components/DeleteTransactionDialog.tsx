"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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

import { deleteTransaction } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

interface DeleteTransactionDialogProps {
  transaction: TransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTransactionDialog({
  transaction,
  workspaceId,
  open,
  onOpenChange,
}: DeleteTransactionDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteTransaction(transaction.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Транзакция успешно удалена");
        onOpenChange(false);
        // Инвалидируем кэш транзакций для обновления списка
        await queryClient.invalidateQueries({
          queryKey: ["transactions", workspaceId],
        });
        // Инвалидируем кэш счетов для обновления баланса
        await queryClient.invalidateQueries({
          queryKey: ["accounts", workspaceId],
        });
        router.refresh();
      }
    } catch {
      toast.error("Не удалось удалить транзакцию");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Удалить транзакцию?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите удалить транзакцию от{" "}
            {format(new Date(transaction.date), "dd.MM.yyyy", { locale: ru })}{" "}
            на сумму{" "}
            {formatMoney(transaction.amount, transaction.account.currency)}? Это
            действие нельзя отменить.
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
