import { Check, Pencil, SkipForward, Trash2 } from "lucide-react";

import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";

interface ScheduledPaymentActionsDialogProps {
  anchor: HTMLElement | null;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  onMarkPaid: () => void;
  onSkip: () => void;
}

export function ScheduledPaymentActionsDialog({
  anchor,
  open,
  onCloseComplete,
  onOpenChange,
  onDelete,
  onEdit,
  onMarkPaid,
  onSkip,
}: ScheduledPaymentActionsDialogProps) {
  const actions: ActionItem[] = [
    {
      id: "edit",
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Редактировать",
      onSelect: onEdit,
    },
    {
      id: "mark-paid",
      icon: <Check className="h-3.5 w-3.5" />,
      label: "Оплачено",
      onSelect: onMarkPaid,
    },
    {
      id: "skip",
      icon: <SkipForward className="h-3.5 w-3.5" />,
      label: "Пропустить",
      onSelect: onSkip,
    },
    {
      id: "delete",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      label: "Удалить",
      onSelect: onDelete,
      tone: "destructive",
    },
  ];

  return (
    <ActionsDialog
      anchor={anchor}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={actions}
    />
  );
}
