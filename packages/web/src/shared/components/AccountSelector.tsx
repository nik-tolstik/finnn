"use client";

import { ChevronRight, Plus, WalletCards } from "lucide-react";

import type { Account } from "@/modules/accounts/account.types";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { cn } from "@/shared/utils/cn";

import { AccountCard } from "./account-card/AccountCard";

interface AccountSelectorProps {
  workspaceId: string;
  account: Account | null;
  onSelect: (account: Account) => void;
  excludeAccountIds?: string[];
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  showOwner?: boolean;
}

export function AccountSelector({
  workspaceId,
  account,
  onSelect,
  excludeAccountIds = [],
  label,
  required = false,
  error,
  disabled = false,
  showOwner = false,
}: AccountSelectorProps) {
  const selectDialog = useDialogState<{ workspaceId: string }>();

  return (
    <>
      <div className="space-y-2">
        {label && (
          <div className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </div>
        )}
        {account ? (
          <AccountCard
            account={account}
            onClick={() => {
              if (!disabled) {
                selectDialog.openDialog({ workspaceId });
              }
            }}
            className={cn("min-h-[68px]", disabled ? "cursor-not-allowed opacity-50" : "")}
            contentClassName="min-h-[66px] justify-center"
            showOwner={showOwner}
          />
        ) : (
          <button
            type="button"
            className={cn(
              "group relative flex min-h-[68px] w-full items-center gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-background px-4 py-3 text-left text-card-foreground transition-[border-color,background-color,box-shadow]",
              "before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-primary/45 before:transition-colors",
              "hover:border-primary/45 hover:bg-accent/35 hover:shadow-xs hover:before:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            onClick={() => {
              if (!disabled) {
                selectDialog.openDialog({ workspaceId });
              }
            }}
            disabled={disabled}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <WalletCards className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-normal leading-none text-foreground">Выбрать счёт</span>
              <span className="truncate text-xs font-normal leading-none text-muted-foreground">Счёт не выбран</span>
            </span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors group-hover:border-primary/35 group-hover:text-primary">
              <Plus className="size-3.5 group-hover:hidden" />
              <ChevronRight className="hidden size-3.5 group-hover:block" />
            </span>
          </button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {selectDialog.mounted && (
        <SelectAccountDialog
          workspaceId={selectDialog.data.workspaceId}
          open={selectDialog.open}
          onOpenChange={selectDialog.closeDialog}
          onCloseComplete={selectDialog.unmountDialog}
          onSelect={onSelect}
          excludeAccountIds={excludeAccountIds}
        />
      )}
    </>
  );
}
