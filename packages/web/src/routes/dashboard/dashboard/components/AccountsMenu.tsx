import { Eye, EyeOff, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";

import type {
  AccountDisplayGrouping,
  AccountDisplaySort,
} from "@/modules/accounts/components/accounts-cards/account-display";
import type { AccountDisplayPreferences } from "@/modules/accounts/hooks/useAccountDisplayPreferences";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

import { AccountGroupingOptions, AccountSortOptions } from "./AccountDisplayControls";

interface AccountsMenuProps {
  onCreateAccount: () => void;
  onGroupingChange: (grouping: AccountDisplayGrouping) => void;
  onShowAllAccountsChange: (showAllAccounts: boolean) => void;
  onSortChange: (sort: AccountDisplaySort) => void;
  preferences: AccountDisplayPreferences;
  showAllAccounts: boolean;
}

export function AccountsMenu({
  onCreateAccount,
  onGroupingChange,
  onShowAllAccountsChange,
  onSortChange,
  preferences,
  showAllAccounts,
}: AccountsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label="Опции счетов"
        className="md:hidden"
        onClick={() => setMenuOpen(true)}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>
      <DialogWindow mobilePosition="bottom" className="gap-4 rounded-t-2xl rounded-b-none pb-4">
        <DialogHeader className="px-5">
          <DialogTitle>Опции счетов</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex flex-col gap-3 px-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onCreateAccount();
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              )}
            >
              <Plus className="h-4 w-4" />
              Новый
            </button>
            <button
              type="button"
              onClick={() => {
                onShowAllAccountsChange(!showAllAccounts);
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm transition-colors hover:bg-accent"
              )}
            >
              {showAllAccounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showAllAccounts ? "Только мои счета" : "Показать все счета"}
            </button>
          </div>
          <div className="space-y-1">
            <AccountSortOptions
              preferences={preferences}
              onSortChange={onSortChange}
              onSelect={() => setMenuOpen(false)}
            />
            <AccountGroupingOptions
              preferences={preferences}
              onGroupingChange={onGroupingChange}
              onSelect={() => setMenuOpen(false)}
            />
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
