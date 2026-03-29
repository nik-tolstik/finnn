"use client";

import type { Account } from "@prisma/client";

import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";

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
            className={disabled ? "opacity-50 cursor-not-allowed" : ""}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              if (!disabled) {
                selectDialog.openDialog({ workspaceId });
              }
            }}
            disabled={disabled}
          >
            Выбрать счёт
          </Button>
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
