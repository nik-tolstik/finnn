import { Archive, Eye, EyeOff, Pencil, Plus } from "lucide-react";

import type { Account } from "@/modules/accounts/account.types";
import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";
import { AccountIcon } from "@/shared/utils/account-icons";
import { formatMoney } from "@/shared/utils/money";

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
      label: "Добавить транзакцию",
      onSelect: onCreateTransaction,
      emphasis: "primary",
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
      separate: true,
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
      mobileContentClassName="px-6 pb-6"
      mobileContext={
        <span className="flex min-w-0 items-center gap-2">
          <AccountIcon
            iconName={account.icon}
            accountColor={account.color}
            accountName={account.name}
            className="size-5 shrink-0"
          />
          <span className="truncate">{account.name}</span>
          <span aria-hidden="true">•</span>
          <span className="shrink-0">{formatMoney(account.balance, account.currency)}</span>
        </span>
      }
      mobileTitle={<span className="text-3xl leading-9 tracking-[-0.02em]">Действия</span>}
    />
  );
}
