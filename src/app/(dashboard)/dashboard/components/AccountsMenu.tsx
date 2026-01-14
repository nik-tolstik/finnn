"use client";

import { Check, GripVertical, MoreVertical, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface AccountsMenuProps {
  isReorderMode: boolean;
  showAllAccounts: boolean;
  onReorderModeChange: (isReorderMode: boolean) => void;
  onShowAllAccountsChange: (show: boolean) => void;
  onCreateAccount: () => void;
  onCancelReorder: () => void;
  onSaveReorder: () => void;
}

export function AccountsMenu({
  isReorderMode,
  showAllAccounts,
  onReorderModeChange,
  onShowAllAccountsChange,
  onCreateAccount,
  onCancelReorder,
  onSaveReorder,
}: AccountsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (isReorderMode) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancelReorder} className="gap-2">
          <X className="h-4 w-4" />
          Отменить
        </Button>
        <Button size="sm" onClick={onSaveReorder} className="gap-2">
          <Check className="h-4 w-4" />
          Сохранить
        </Button>
      </div>
    );
  }

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-sm">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-54 p-1" align="end">
        <div className="space-y-1">
          <button
            onClick={() => {
              onCreateAccount();
              setMenuOpen(false);
            }}
            className={cn(
              "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
            )}
          >
            <Plus className="h-4 w-4" />
            Новый
          </button>
          <button
            onClick={() => {
              onReorderModeChange(true);
              setMenuOpen(false);
            }}
            className={cn(
              "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
            )}
          >
            <GripVertical className="h-4 w-4" />
            Изменить порядок
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
