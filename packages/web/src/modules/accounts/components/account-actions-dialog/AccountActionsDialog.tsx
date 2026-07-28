"use client";

import { Archive, Eye, EyeOff, Pencil, Plus } from "lucide-react";

import type { Account } from "@/modules/accounts/account.types";
import { ActionsDialog } from "@/shared/ui/actions-dialog";

interface AccountActionsDialogProps {
  account: Account;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onCreateTransaction: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onArchive: () => void;
}

export function AccountActionsDialog({
  account,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onToggleVisibility,
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
          label: "Добавить",
          onClick: onCreateTransaction,
        },
        {
          icon: <Pencil className="h-3.5 w-3.5" />,
          label: "Изменить",
          onClick: onEdit,
        },
        {
          icon: account.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />,
          label: account.hidden ? "Показать" : "Скрыть",
          onClick: onToggleVisibility,
        },
        {
          icon: <Archive className="h-3.5 w-3.5" />,
          label: "Архивировать",
          onClick: onArchive,
          theme: "error",
        },
      ]}
    />
  );
}
