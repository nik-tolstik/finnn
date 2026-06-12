"use client";

import { useEffect, useMemo, useState } from "react";

import type { Account } from "@/modules/accounts/account.types";
import { CreateTransactionDialog } from "@/modules/transactions/components/create-transaction-dialog";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { useSession } from "@/shared/lib/api-session-client";
import { Badge } from "@/shared/ui/badge";

import { getVisibleAccounts, resolveViewerUserId } from "../../account-visibility";
import { AccountActionsDialog } from "../account-actions-dialog/AccountActionsDialog";
import { AccountsCardsSkeleton } from "../accounts-cards-skeleton/AccountsCardsSkeleton";
import { ArchiveAccountDialog } from "../archive-account-dialog/ArchiveAccountDialog";
import { EditAccountDialog } from "../edit-account-dialog/EditAccountDialog";
import { AccountsCardsReorderView } from "./AccountsCardsReorderView";

type AccountWithOwner = Account & {
  owner?: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  } | null;
};

interface AccountsCardsProps {
  accounts: AccountWithOwner[];
  initialCurrentUserId?: string;
  workspaceId: string;
  isLoading?: boolean;
  onReorderModeChange?: (isReorderMode: boolean) => void;
  reorderMode?: boolean;
  onCancelReorder?: () => void;
  showAllAccounts?: boolean;
  onShowAllAccountsChange?: (show: boolean) => void;
}

type ActionDialogData = {
  account: AccountWithOwner;
};

function groupAccountsByOwner(items: AccountWithOwner[], viewerUserId?: string | null) {
  const accountsByOwner = items.reduce(
    (acc, account) => {
      const ownerId = account.ownerId || "__no_owner__";
      const ownerName = account.owner?.name || account.owner?.email || "Общие";
      if (!acc[ownerId]) {
        acc[ownerId] = {
          owner: account.owner
            ? {
                id: account.owner.id,
                name: account.owner.name,
                email: account.owner.email,
                image: account.owner.image,
              }
            : null,
          ownerName,
          accounts: [],
        };
      }
      acc[ownerId].accounts.push(account);
      return acc;
    },
    {} as Record<
      string,
      {
        owner: { id: string; name: string | null; email?: string | null; image: string | null } | null;
        ownerName: string;
        accounts: AccountWithOwner[];
      }
    >
  );

  return Object.values(accountsByOwner).sort((a, b) => {
    if (!viewerUserId) {
      if (!a.owner && b.owner) return 1;
      if (a.owner && !b.owner) return -1;
      if (!a.owner && !b.owner) return 0;
      return (a.owner?.name || a.owner?.email || "").localeCompare(b.owner?.name || b.owner?.email || "");
    }

    const aIsCurrentUser = a.owner?.id === viewerUserId;
    const bIsCurrentUser = b.owner?.id === viewerUserId;
    const aIsShared = !a.owner;
    const bIsShared = !b.owner;

    if (aIsCurrentUser && !bIsCurrentUser) return -1;
    if (!aIsCurrentUser && bIsCurrentUser) return 1;
    if (aIsShared && !bIsShared && !bIsCurrentUser) return 1;
    if (!aIsShared && bIsShared && !aIsCurrentUser) return -1;
    if (aIsShared && bIsShared) return 0;
    return (a.owner?.name || a.owner?.email || "").localeCompare(b.owner?.name || b.owner?.email || "");
  });
}

export function AccountsCards({
  accounts,
  initialCurrentUserId,
  workspaceId,
  isLoading,
  onReorderModeChange,
  reorderMode = false,
  onCancelReorder,
  showAllAccounts: showAllAccountsProp,
  onShowAllAccountsChange,
}: AccountsCardsProps) {
  const { data: session } = useSession();
  const [showAllAccountsLocal, setShowAllAccountsLocal] = useState(false);
  const accountActionsDialog = useDialogState<{ account: Account }>();

  const showAllAccounts = showAllAccountsProp ?? showAllAccountsLocal;
  const setShowAllAccounts = onShowAllAccountsChange ?? setShowAllAccountsLocal;
  const createTransactionDialog = useDialogState<{
    workspaceId: string;
    defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
    account?: Account;
  }>();
  const editDialog = useDialogState<ActionDialogData>();
  const archiveDialog = useDialogState<ActionDialogData>();
  const viewerUserId = resolveViewerUserId(session?.user?.id, initialCurrentUserId);

  const filteredAccounts = useMemo(() => {
    return getVisibleAccounts(accounts, viewerUserId, showAllAccounts);
  }, [accounts, showAllAccounts, viewerUserId]);

  const sortedOwners = useMemo(
    () => groupAccountsByOwner(filteredAccounts, viewerUserId),
    [filteredAccounts, viewerUserId]
  );

  useEffect(() => {
    if (!reorderMode) {
      setShowAllAccounts(false);
    }
  }, [reorderMode, setShowAllAccounts]);

  if (isLoading) {
    return <AccountsCardsSkeleton />;
  }

  if (reorderMode) {
    return (
      <AccountsCardsReorderView
        accounts={filteredAccounts}
        initialCurrentUserId={initialCurrentUserId}
        workspaceId={workspaceId}
        onCancelReorder={onCancelReorder}
        onReorderModeChange={onReorderModeChange}
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        {sortedOwners.map(({ owner, accounts: ownerAccounts }) => {
          const ownerId = owner?.id || "__no_owner__";

          return (
            <div key={ownerId} className="space-y-3">
              {sortedOwners.length > 1 && (
                <div className="flex items-center gap-2">
                  {owner ? (
                    <UserDisplay name={owner.name} email={owner.email} image={owner.image} size="sm" showName />
                  ) : (
                    <span className="text-sm font-medium">Общие</span>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {ownerAccounts.length}
                  </Badge>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ownerAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    showOwner={false}
                    onClick={() => {
                      accountActionsDialog.openDialog({ account });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
