import { Archive, Eye, EyeOff, Pencil, Plus } from "lucide-react";

import type { Account } from "@/modules/accounts/account.types";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";

interface AccountActionsDialogProps {
  account: Account;
  anchor: HTMLElement | null;
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
  anchor,
  open,
  onCloseComplete,
  onOpenChange,
  onEdit,
  onToggleVisibility,
  onArchive,
  onCreateTransaction,
}: AccountActionsDialogProps) {
  const actions: ActionItem[] = [
    {
      id: "create-transaction",
      icon: <Plus className="h-3.5 w-3.5" />,
      label: "Транзакция",
      onSelect: onCreateTransaction,
    },
    {
      id: "edit",
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Изменить",
      onSelect: onEdit,
    },
    {
      id: "toggle-visibility",
      icon: account.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />,
      label: account.hidden ? "Показать" : "Скрыть",
      onSelect: onToggleVisibility,
    },
    {
      id: "archive",
      icon: <Archive className="h-3.5 w-3.5" />,
      label: "Архивировать",
      onSelect: onArchive,
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
      mobileActionsClassName="gap-2"
      mobileContentClassName="px-6 pt-3 pb-6"
      mobileContext={<AccountCard account={account} showOwner={false} />}
    />
  );
}
