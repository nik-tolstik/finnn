"use client";

import type { Account } from "@prisma/client";
import { Archive, Pencil, Plus } from "lucide-react";

import { ActionsDialog } from "@/shared/ui/actions-dialog";

interface AccountActionsDialogProps {
  account: Account;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onCreateTransaction: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function AccountActionsDialog({
  account,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onArchive,
  onCreateTransaction,
}: AccountActionsDialogProps) {
  return (
    <ActionsDialog
      title="Действия со счётом"
      description={`Выберите действие для счёта "${account.name}"`}
      open={open}
      onCloseComplete={onCloseComplete}
      onOpenChange={onOpenChange}
      actions={[
        {
          icon: <Plus className="h-3.5 w-3.5" />,
          label: "Добавить транзакцию",
          onClick: onCreateTransaction,
        },
        {
          icon: <Pencil className="h-3.5 w-3.5" />,
          label: "Изменить",
          onClick: onEdit,
        },
        {
          icon: <Archive className="h-3.5 w-3.5" />,
          label: "Архивировать",
          onClick: onArchive,
        },
      ]}
    />
  );
}
