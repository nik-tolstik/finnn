"use client";

import { Check, Pencil, SkipForward, Trash2 } from "lucide-react";

import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";

import type { ScheduledPayment } from "../scheduled-payment.types";

interface ScheduledPaymentActionsDialogProps {
  open: boolean;
  payment: ScheduledPayment;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  onMarkPaid: () => void;
  onSkip: () => void;
}

export function ScheduledPaymentActionsDialog({
  open,
  payment,
  onCloseComplete,
  onOpenChange,
  onDelete,
  onEdit,
  onMarkPaid,
  onSkip,
}: ScheduledPaymentActionsDialogProps) {
  const actions: ActionItem[] = [
    {
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Редактировать",
      onClick: onEdit,
    },
    {
      icon: <Check className="h-3.5 w-3.5" />,
      label: "Оплачено",
      onClick: onMarkPaid,
    },
    {
      icon: <SkipForward className="h-3.5 w-3.5" />,
      label: "Пропустить",
      onClick: onSkip,
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
      title="Действия с платежом"
      description={`Выберите действие для платежа ${payment.name}`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
