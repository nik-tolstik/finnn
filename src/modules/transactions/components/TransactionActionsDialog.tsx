"use client";

import { Pencil, RotateCw, Trash2 } from "lucide-react";

import { ActionsDialog, type ActionItem } from "@/shared/ui/actions-dialog";

import { TransactionType } from "../transaction.constants";
import type { TransactionWithRelations } from "../transaction.types";

interface TransactionActionsDialogProps {
  transaction: TransactionWithRelations;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRepeat?: () => void;
}

export function TransactionActionsDialog({
  transaction,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onDelete,
  onRepeat,
}: TransactionActionsDialogProps) {
  const transactionType = transaction.type === TransactionType.TRANSFER ? "перевода" : "транзакции";
  const transactionLabel = transaction.type === TransactionType.TRANSFER ? "Перевод" : "Транзакция";
  const canRepeat = transaction.type !== TransactionType.TRANSFER && onRepeat;

  const actions: ActionItem[] = [
    {
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Редактировать",
      onClick: onEdit,
    },
  ];

  if (canRepeat) {
    actions.push({
      icon: <RotateCw className="h-3.5 w-3.5" />,
      label: "Повторить",
      onClick: onRepeat,
    });
  }

  actions.push({
    icon: <Trash2 className="h-3.5 w-3.5" />,
    label: "Удалить",
    onClick: onDelete,
    theme: "error",
  });

  return (
    <ActionsDialog
      title={`Действия с ${transactionType}`}
      description={`Выберите действие для ${transactionLabel.toLowerCase()}`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
