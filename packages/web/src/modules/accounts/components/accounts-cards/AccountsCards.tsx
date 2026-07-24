"use client";

import type { Account } from "@/modules/accounts/account.types";
import type {
  AccountDisplayGroup,
  AccountDisplayGrouping,
} from "@/modules/accounts/components/accounts-cards/account-display";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Badge } from "@/shared/ui/badge";

import { AccountActionsDialog } from "../account-actions-dialog/AccountActionsDialog";
import { AccountsCardsSkeleton } from "../accounts-cards-skeleton/AccountsCardsSkeleton";
import { ArchiveAccountDialog } from "../archive-account-dialog/ArchiveAccountDialog";
import { EditAccountDialog } from "../edit-account-dialog/EditAccountDialog";
import { AccountsCardsReorderView } from "./AccountsCardsReorderView";

type AccountWithOwner = Account & {
  owner: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  } | null;
};

interface AccountsCardsProps {
  groups: AccountDisplayGroup<AccountWithOwner>[];
  grouping: AccountDisplayGrouping;
  isLoading?: boolean;
  isReorderSaving?: boolean;
  onReorderAccountsChange?: (accounts: AccountWithOwner[]) => void;
  reorderAccounts?: AccountWithOwner[] | null;
  reorderMode?: boolean;
  workspaceId: string;
}

type ActionDialogData = {
  account: AccountWithOwner;
};

function AccountGroupHeader({ group }: { group: AccountDisplayGroup<AccountWithOwner> }) {
  return (
    <div className="flex items-center gap-2">
      {group.owner ? (
        <UserDisplay name={group.owner.name} email={group.owner.email} image={group.owner.image} size="sm" showName />
      ) : (
        <span className="text-sm font-medium">{group.label}</span>
      )}
      <Badge variant="secondary" className="text-xs">
        {group.count}
      </Badge>
    </div>
  );
}

export function AccountsCards({
  groups,
  grouping,
  isLoading,
  isReorderSaving = false,
  onReorderAccountsChange,
  reorderAccounts,
  reorderMode = false,
  workspaceId,
}: AccountsCardsProps) {
  const accountActionsDialog = useDialogState<ActionDialogData>();
  const createTransactionDialog = useDialogState<{
    workspaceId: string;
    defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
    account?: Account;
  }>();
  const editDialog = useDialogState<ActionDialogData>();
  const archiveDialog = useDialogState<ActionDialogData>();

  if (isLoading) {
    return <AccountsCardsSkeleton />;
  }

  if (reorderMode && reorderAccounts && onReorderAccountsChange) {
    return (
      <AccountsCardsReorderView
        accounts={reorderAccounts}
        disabled={isReorderSaving}
        onAccountsChange={onReorderAccountsChange}
      />
    );
  }

  const shouldShowGroupHeaders = grouping !== "none" && groups.length > 1;
  const shouldShowOwnerOnCard = grouping !== "owner";

  return (
    <>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id} className="space-y-3">
            {shouldShowGroupHeaders ? <AccountGroupHeader group={group} /> : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  showOwner={shouldShowOwnerOnCard}
                  onClick={() => {
                    accountActionsDialog.openDialog({ account });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {accountActionsDialog.mounted && (
        <AccountActionsDialog
          account={accountActionsDialog.data.account}
          open={accountActionsDialog.open}
          onCloseComplete={accountActionsDialog.unmountDialog}
          onEdit={() => {
            editDialog.openDialog({
              account: accountActionsDialog.data.account,
            });
            accountActionsDialog.closeDialog();
          }}
          onArchive={() => {
            archiveDialog.openDialog({
              account: accountActionsDialog.data.account,
            });
            accountActionsDialog.closeDialog();
          }}
          onOpenChange={accountActionsDialog.closeDialog}
          onCreateTransaction={() => {
            createTransactionDialog.openDialog({
              workspaceId,
              defaultType: PaymentTransactionType.EXPENSE,
              account: accountActionsDialog.data.account,
            });
            accountActionsDialog.closeDialog();
          }}
        />
      )}

      {editDialog.mounted && (
        <EditAccountDialog
          account={editDialog.data.account}
          open={editDialog.open}
          onOpenChange={editDialog.closeDialog}
          onCloseComplete={editDialog.unmountDialog}
        />
      )}

      {archiveDialog.mounted && (
        <ArchiveAccountDialog
          account={archiveDialog.data.account}
          open={archiveDialog.open}
          onOpenChange={archiveDialog.closeDialog}
          onCloseComplete={archiveDialog.unmountDialog}
        />
      )}

      {createTransactionDialog.mounted && (
        <CreateTransactionDialog
          workspaceId={createTransactionDialog.data.workspaceId}
          open={createTransactionDialog.open}
          onOpenChange={createTransactionDialog.closeDialog}
          onCloseComplete={createTransactionDialog.unmountDialog}
          defaultType={createTransactionDialog.data.defaultType}
          account={createTransactionDialog.data.account}
        />
      )}
    </>
  );
}
