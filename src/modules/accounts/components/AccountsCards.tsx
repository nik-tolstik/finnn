"use client";

import type { Account } from "@prisma/client";
import { Plus } from "lucide-react";

import { TransactionType } from "@/modules/transactions/transaction.constants";
import { CreateTransactionTabsDialog } from "@/modules/transactions/components/CreateTransactionTabsDialog";
import { AccountCard } from "@/shared/components/AccountCard";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

import { AccountActionsDialog } from "./AccountActionsDialog";
import { AccountsCardsSkeleton } from "./AccountsCardsSkeleton";
import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

interface AccountsCardsProps {
  accounts: Account[];
  workspaceId: string;
  isLoading?: boolean;
}

type ActionDialogData = {
  account: Account;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AccountsCards({
  accounts,
  workspaceId,
  isLoading,
}: AccountsCardsProps) {
  const accountActionsDialog = useDialogState<{ account: Account }>();
  const transactionTabsDialog = useDialogState<{
    workspaceId: string;
    defaultAccountId?: string;
    defaultTab?: TransactionType;
    onSuccess?: () => void;
    onCancel?: () => void;
  }>();
  const editDialog = useDialogState<ActionDialogData>();
  const archiveDialog = useDialogState<ActionDialogData>();

  const createAccountDialog = useDialogState();

  if (isLoading) {
    return <AccountsCardsSkeleton />;
  }

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,300px)]">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onClick={() => {
                accountActionsDialog.openDialog({ account });
              }}
            />
          ))}
          <Card
            className={cn(
              "group relative transition-all hover:shadow-md cursor-pointer border-dashed hover:border-primary hover:bg-accent/50"
            )}
            onClick={() => createAccountDialog.openDialog(null)}
          >
            <div className="flex items-center justify-center h-full w-full">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
          </Card>
        </div>

        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          onClick={() =>
            transactionTabsDialog.openDialog({
              workspaceId,
              defaultTab: TransactionType.EXPENSE,
              onSuccess: () => {
                accountActionsDialog.closeDialog();
              },
            })
          }
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {accountActionsDialog.mounted && (
        <AccountActionsDialog
          account={accountActionsDialog.data.account}
          open={accountActionsDialog.open}
          onCloseComplete={accountActionsDialog.unmountDialog}
          onEdit={() => {
            editDialog.openDialog({
              account: accountActionsDialog.data.account,
              onSuccess: () => {
                accountActionsDialog.closeDialog();
              },
            });
          }}
          onArchive={() => {
            archiveDialog.openDialog({
              account: accountActionsDialog.data.account,
              onSuccess: () => {
                accountActionsDialog.closeDialog();
              },
            });
          }}
          onOpenChange={accountActionsDialog.closeDialog}
          onCreateTransaction={() => {
            transactionTabsDialog.openDialog({
              workspaceId,
              defaultAccountId: accountActionsDialog.data.account.id,
              defaultTab: TransactionType.EXPENSE,
              onSuccess: () => {
                accountActionsDialog.closeDialog();
              },
            });
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

      {createAccountDialog.mounted && (
        <CreateAccountDialog
          workspaceId={workspaceId}
          open={createAccountDialog.open}
          onOpenChange={createAccountDialog.closeDialog}
          onCloseComplete={createAccountDialog.unmountDialog}
        />
      )}

      {transactionTabsDialog.mounted && (
        <CreateTransactionTabsDialog
          workspaceId={transactionTabsDialog.data.workspaceId}
          open={transactionTabsDialog.open}
          onOpenChange={transactionTabsDialog.closeDialog}
          onCloseComplete={transactionTabsDialog.unmountDialog}
          defaultAccountId={transactionTabsDialog.data.defaultAccountId}
          defaultTab={transactionTabsDialog.data.defaultTab}
        />
      )}
    </>
  );
}
