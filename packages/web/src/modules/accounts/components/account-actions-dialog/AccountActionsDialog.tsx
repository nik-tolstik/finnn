import { Archive, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { type ActionItem, ActionsDialog } from "@/shared/ui/actions-dialog";
import type { PopoverTriggerRenderProps } from "@/shared/ui/popover";

const MENU_CLOSE_DURATION_MS = 200;

interface AccountActionsDialogProps {
  account: Account;
  onCreateTransaction: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onArchive: () => void;
  trigger: (props: PopoverTriggerRenderProps) => ReactNode;
}

export function AccountActionsDialog({
  account,
  onEdit,
  onToggleVisibility,
  onArchive,
  onCreateTransaction,
  trigger,
}: AccountActionsDialogProps) {
  const deferredActionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (deferredActionTimeoutRef.current !== null) {
        window.clearTimeout(deferredActionTimeoutRef.current);
      }
    };
  }, []);

  const deferUntilMenuCloses = (action: () => void) => () => {
    if (deferredActionTimeoutRef.current !== null) {
      window.clearTimeout(deferredActionTimeoutRef.current);
    }

    deferredActionTimeoutRef.current = window.setTimeout(() => {
      deferredActionTimeoutRef.current = null;
      action();
    }, MENU_CLOSE_DURATION_MS);
  };

  const actions: ActionItem[] = [
    {
      id: "create-transaction",
      icon: <Plus className="h-3.5 w-3.5" />,
      label: "Транзакция",
      onSelect: deferUntilMenuCloses(onCreateTransaction),
    },
    {
      id: "edit",
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Изменить",
      onSelect: deferUntilMenuCloses(onEdit),
    },
    {
      id: "toggle-visibility",
      icon: account.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />,
      label: account.hidden ? "Показать" : "Скрыть",
      onSelect: deferUntilMenuCloses(onToggleVisibility),
    },
    {
      id: "archive",
      icon: <Archive className="h-3.5 w-3.5" />,
      label: "Архивировать",
      onSelect: deferUntilMenuCloses(onArchive),
      tone: "destructive",
    },
  ];

  return <ActionsDialog actions={actions} trigger={trigger} />;
}
