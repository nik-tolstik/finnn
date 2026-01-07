"use client";

import { Pencil, Trash2 } from "lucide-react";

import { ActionsDialog } from "@/shared/ui/actions-dialog";

import { TransactionType } from "../transaction.constants";
import type { TransactionWithRelations } from "../transaction.types";

interface TransactionActionsDialogProps {
  transaction: TransactionWithRelations;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransactionActionsDialog({
  transaction,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onDelete,
}: TransactionActionsDialogProps) {
  const transactionType =
    transaction.type === TransactionType.TRANSFER ? "перевода" : "транзакции";
  const transactionLabel =
    transaction.type === TransactionType.TRANSFER ? "Перевод" : "Транзакция";

  return (
    <ActionsDialog
      title={`Действия с ${transactionType}`}
      description={`Выберите действие для ${transactionLabel.toLowerCase()}`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={[
        {
          icon: <Pencil className="h-3.5 w-3.5" />,
          label: "Редактировать",
          onClick: onEdit,
        },
        {
          icon: <Trash2 className="h-3.5 w-3.5" />,
          label: "Удалить",
          onClick: onDelete,
          theme: "error",
        },
      ]}
    />
  );
}
