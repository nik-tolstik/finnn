"use client";

import { Pencil, RotateCw, Trash2 } from "lucide-react";

import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";

interface TransactionActionsDialogProps {
  transactionKind: "paymentTransaction" | "transferTransaction";
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRepeat?: () => void;
}

export function TransactionActionsDialog({
  transactionKind,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onDelete,
  onRepeat,
}: TransactionActionsDialogProps) {
  const isTransferTransaction = transactionKind === "transferTransaction";
  const transactionType = isTransferTransaction ? "перевода" : "транзакции";
  const transactionLabel = isTransferTransaction ? "Перевод" : "Транзакция";
  const canRepeat = !isTransferTransaction && onRepeat;

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
