"use client";

import type { Account } from "@prisma/client";
import { Archive, Pencil, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface AccountActionsDialogProps {
  account: Account;
  open: boolean;
  onCloseComplete: () => void;
  onOpenChange: (open: boolean) => void;
  onCreateTransaction: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function ActionButton({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 text-left transition-colors cursor-pointer"
    >
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <div className="font-medium">{children}</div>
    </button>
  );
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[400px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Действия со счётом</DialogTitle>
          <DialogDescription>
            Выберите действие для счёта &quot;{account.name}&quot;
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-4">
          <ActionButton
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={onCreateTransaction}
          >
            Добавить транзакцию
          </ActionButton>
          <ActionButton
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={onEdit}
          >
            Изменить
          </ActionButton>
          <ActionButton
            icon={<Archive className="h-3.5 w-3.5" />}
            onClick={onArchive}
          >
            Архивировать
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
