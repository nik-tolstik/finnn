import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useRef } from "react";
import { toast } from "sonner";

import type { Account } from "@/modules/accounts/account.types";
import { AccountActionsDialog } from "@/modules/accounts/components/account-actions-dialog/AccountActionsDialog";
import type {
  AccountDisplayGroup,
  AccountDisplayGrouping,
} from "@/modules/accounts/components/accounts-cards/account-display";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { runOptimisticWorkspaceMutation, updateAccountsInCache } from "@/shared/lib/optimistic-workspace-updates";
import { Badge } from "@/shared/ui/badge";

import { hideAccount, showAccount } from "../../account.api";
import { AccountsCardsSkeleton } from "../accounts-cards-skeleton/AccountsCardsSkeleton";

const AccountsCardsReorderView = lazy(() =>
  import("./AccountsCardsReorderView").then((module) => ({ default: module.AccountsCardsReorderView }))
);
const loadArchiveAccountDialog = () =>
  import("../archive-account-dialog/ArchiveAccountDialog").then((module) => ({
    default: module.ArchiveAccountDialog,
  }));
const ArchiveAccountDialog = lazy(loadArchiveAccountDialog);
const loadCreateTransactionDialog = () =>
  import("@/modules/transactions/components/create-transaction-dialog/CreateTransactionDialog").then((module) => ({
    default: module.CreateTransactionDialog,
  }));
const CreateTransactionDialog = lazy(loadCreateTransactionDialog);
const loadEditAccountDialog = () =>
  import("../edit-account-dialog/EditAccountDialog").then((module) => ({ default: module.EditAccountDialog }));
const EditAccountDialog = lazy(loadEditAccountDialog);

function preloadAccountDetailsDialogs() {
  void Promise.all([loadArchiveAccountDialog(), loadCreateTransactionDialog(), loadEditAccountDialog()]).catch(
    () => undefined
  );
}

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

type AccountDialogData = {
  account: AccountWithOwner;
};

type AccountActionDialogData = AccountDialogData & {
  anchor: HTMLElement;
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
  const queryClient = useQueryClient();
  const visibilityMutationIds = useRef(new Set<string>());
  const accountActionsDialog = useDialogState<AccountActionDialogData>();
  const createTransactionDialog = useDialogState<{
    workspaceId: string;
    defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
    account?: Account;
  }>();
  const editDialog = useDialogState<AccountDialogData>();
  const archiveDialog = useDialogState<AccountDialogData>();
  const archiveAfterEditRef = useRef<AccountWithOwner | null>(null);

  const handleToggleVisibility = async (account: AccountWithOwner) => {
    if (visibilityMutationIds.current.has(account.id)) {
      return;
    }

    accountActionsDialog.closeDialog();

    const nextHidden = !account.hidden;
    visibilityMutationIds.current.add(account.id);

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId: account.workspaceId,
        domains: ["accounts"],
        apply: (context) => {
          updateAccountsInCache(context, [{ id: account.id, hidden: nextHidden }]);
        },
        mutation: () => (nextHidden ? hideAccount(account.id) : showAccount(account.id)),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(nextHidden ? "Счёт скрыт" : "Счёт показан");
      }
    } catch {
      toast.error(nextHidden ? "Не удалось скрыть счёт" : "Не удалось показать счёт");
    } finally {
      visibilityMutationIds.current.delete(account.id);
    }
  };

  const openEditDialog = (account: AccountWithOwner) => {
    preloadAccountDetailsDialogs();
    editDialog.openDialog({ account });
  };

  const handleEditDialogCloseComplete = () => {
    editDialog.unmountDialog();

    const account = archiveAfterEditRef.current;
    archiveAfterEditRef.current = null;

    if (account) {
      archiveDialog.openDialog({ account });
    }
  };

  const handleArchiveFromEdit = (account: AccountWithOwner) => {
    archiveAfterEditRef.current = account;
    editDialog.closeDialog();
  };

  if (isLoading) {
    return <AccountsCardsSkeleton />;
  }

  if (reorderMode && reorderAccounts && onReorderAccountsChange) {
    return (
      <Suspense fallback={<AccountsCardsSkeleton />}>
        <AccountsCardsReorderView
          accounts={reorderAccounts}
          disabled={isReorderSaving}
          onAccountsChange={onReorderAccountsChange}
        />
      </Suspense>
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
                  onClick={(event) => {
                    preloadAccountDetailsDialogs();
                    accountActionsDialog.openDialog({ account, anchor: event.currentTarget });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {accountActionsDialog.mounted ? (
        <AccountActionsDialog
          account={accountActionsDialog.data.account}
          anchor={accountActionsDialog.data.anchor}
          open={accountActionsDialog.open}
          onCloseComplete={accountActionsDialog.unmountDialog}
          onOpenChange={accountActionsDialog.closeDialog}
          onEdit={() => openEditDialog(accountActionsDialog.data.account)}
          onToggleVisibility={() => {
            void handleToggleVisibility(accountActionsDialog.data.account);
          }}
          onArchive={() => {
            archiveDialog.openDialog({ account: accountActionsDialog.data.account });
          }}
          onCreateTransaction={() => {
            createTransactionDialog.openDialog({
              workspaceId,
              defaultType: PaymentTransactionType.EXPENSE,
              account: accountActionsDialog.data.account,
            });
          }}
        />
      ) : null}

      {editDialog.mounted ? (
        <Suspense fallback={null}>
          <EditAccountDialog
            account={editDialog.data.account}
            open={editDialog.open}
            onOpenChange={editDialog.closeDialog}
            onCloseComplete={handleEditDialogCloseComplete}
            onArchive={() => handleArchiveFromEdit(editDialog.data.account)}
            onToggleVisibility={() => {
              editDialog.closeDialog();
              void handleToggleVisibility(editDialog.data.account);
            }}
          />
        </Suspense>
      ) : null}

      {archiveDialog.mounted ? (
        <Suspense fallback={null}>
          <ArchiveAccountDialog
            account={archiveDialog.data.account}
            open={archiveDialog.open}
            onOpenChange={archiveDialog.closeDialog}
            onCloseComplete={archiveDialog.unmountDialog}
          />
        </Suspense>
      ) : null}

      {createTransactionDialog.mounted ? (
        <Suspense fallback={null}>
          <CreateTransactionDialog
            workspaceId={createTransactionDialog.data.workspaceId}
            open={createTransactionDialog.open}
            onOpenChange={createTransactionDialog.closeDialog}
            onCloseComplete={createTransactionDialog.unmountDialog}
            defaultType={createTransactionDialog.data.defaultType}
            account={createTransactionDialog.data.account}
          />
        </Suspense>
      ) : null}
    </>
  );
}
