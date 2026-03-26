"use client";

import { Pencil, Trash2 } from "lucide-react";

import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";

import type { DebtTransactionWithRelations } from "../debt.types";

interface DebtTransactionActionsDialogProps {
  debtTransaction: DebtTransactionWithRelations;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function DebtTransactionActionsDialog({
  debtTransaction,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onDelete,
}: DebtTransactionActionsDialogProps) {
  const actions: ActionItem[] = [
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
  ];

  return (
    <ActionsDialog
      title="Действия с транзакцией долга"
      description={`Выберите действие для записи по долгу ${debtTransaction.debt.personName}`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
