"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";

import { ActionsDialog, type ActionItem } from "@/shared/ui/actions-dialog";

import { DebtType, DebtStatus } from "../debt.constants";
import type { DebtWithRelations } from "../debt.types";

interface DebtActionsDialogProps {
  debt: DebtWithRelations;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onAddMore: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function DebtActionsDialog({
  debt,
  open,
  onCloseComplete,
  onOpenChange,
  onClose,
  onAddMore,
  onDelete,
  onEdit,
}: DebtActionsDialogProps) {
  const isOpen = debt.status === DebtStatus.OPEN;

  const actions: ActionItem[] = [];

  if (isOpen) {
    actions.push({
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Редактировать",
      onClick: onEdit,
    });

    actions.push({
      icon: <Check className="h-3.5 w-3.5" />,
      label: "Закрыть долг",
      onClick: onClose,
    });

    actions.push({
      icon: <Plus className="h-3.5 w-3.5" />,
      label: debt.type === DebtType.LENT ? "Дать ещё" : "Взять ещё",
      onClick: onAddMore,
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
      title="Действия с долгом"
      description={`Выберите действие для долга ${debt.personName}`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
