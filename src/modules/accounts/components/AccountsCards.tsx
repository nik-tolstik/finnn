"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Account } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { CreateTransactionDialog } from "@/modules/transactions/components/CreateTransactionDialog";
import { CreateTransferDialog } from "@/modules/transactions/components/CreateTransferDialog";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { AccountCard } from "@/shared/components/AccountCard";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { getAvatarColor } from "@/shared/utils/avatar-colors";
import { cn } from "@/shared/utils/cn";

import { updateAccountsOrder } from "../account.service";

import { AccountActionsDialog } from "./AccountActionsDialog";
import { AccountsCardsSkeleton } from "./AccountsCardsSkeleton";
import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

type AccountWithOwner = Account & {
  owner?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

interface AccountsCardsProps {
  accounts: AccountWithOwner[];
  workspaceId: string;
  isLoading?: boolean;
  onReorderModeChange?: (isReorderMode: boolean) => void;
  reorderMode?: boolean;
  onCancelReorder?: () => void;
}

type ActionDialogData = {
  account: AccountWithOwner;
};

interface SortableAccountCardProps {
  account: AccountWithOwner;
  onClick: () => void;
}

function SortableAccountCard({
  account,
  onClick,
  isReorderMode,
}: SortableAccountCardProps & { isReorderMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
    disabled: !isReorderMode,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const style = mounted
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  const handleClick = () => {
    if (!isReorderMode) {
      onClick();
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...(isReorderMode ? { ...attributes, ...listeners } : {})}
        className={cn("select-none touch-none", isReorderMode && "cursor-grab active:cursor-grabbing")}
        style={{
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <AccountCard account={account} onClick={handleClick} showOwner={false} />
      </div>
    </div>
  );
}

export function AccountsCards({
  accounts,
  workspaceId,
  isLoading,
  onReorderModeChange,
  reorderMode = false,
  onCancelReorder,
}: AccountsCardsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [items, setItems] = useState(accounts);
  const [originalItems, setOriginalItems] = useState(accounts);
  const isReorderMode = reorderMode;
  const accountActionsDialog = useDialogState<{ account: Account }>();
  const transactionTabsDialog = useDialogState<{
    workspaceId: string;
    defaultAccountId?: string;
    defaultType?: TransactionType.INCOME | TransactionType.EXPENSE;
  }>();
  const transferDialog = useDialogState<{
    workspaceId: string;
    defaultFromAccountId?: string;
  }>();
  const editDialog = useDialogState<ActionDialogData>();
  const archiveDialog = useDialogState<ActionDialogData>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(accounts);
    if (!isReorderMode) {
      setOriginalItems(accounts);
    }
  }, [accounts, isReorderMode]);

  useEffect(() => {
    if (isReorderMode) {
      setOriginalItems(items);
    }
  }, [isReorderMode, items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeAccount = items.find((item) => item.id === active.id);
      const overAccount = items.find((item) => item.id === over.id);

      if (!activeAccount || !overAccount) return;

      const activeOwnerId = activeAccount.ownerId || "__no_owner__";
      const overOwnerId = overAccount.ownerId || "__no_owner__";

      if (activeOwnerId !== overOwnerId) {
        return;
      }

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
    }
  };

  const handleSaveReorder = useCallback(async () => {
    const accountOrders = items.map((account, index) => ({
      id: account.id,
      order: index,
    }));

    const orderedItems = items.map((account, index) => ({
      ...account,
      order: index,
    }));

    queryClient.setQueryData(["accounts", workspaceId], { data: orderedItems });

    const result = await updateAccountsOrder(workspaceId, {
      accountOrders,
    });

    if (result.error) {
      toast.error(result.error);
      setItems(originalItems);
      queryClient.setQueryData(["accounts", workspaceId], {
        data: originalItems,
      });
    } else {
      toast.success("Порядок счетов сохранён");
      setOriginalItems(items);
      onReorderModeChange?.(false);
      router.refresh();
    }
  }, [items, originalItems, workspaceId, queryClient, router, onReorderModeChange]);

  useEffect(() => {
    const handleSave = async () => {
      await handleSaveReorder();
    };
    window.addEventListener("saveReorder", handleSave);
    return () => {
      window.removeEventListener("saveReorder", handleSave);
    };
  }, [handleSaveReorder]);

  const handleCancelReorder = useCallback(() => {
    setItems(originalItems);
    onReorderModeChange?.(false);
    onCancelReorder?.();
  }, [originalItems, onReorderModeChange, onCancelReorder]);

  useEffect(() => {
    const handleCancel = () => {
      handleCancelReorder();
    };
    window.addEventListener("cancelReorder", handleCancel);
    return () => {
      window.removeEventListener("cancelReorder", handleCancel);
    };
  }, [handleCancelReorder]);

  if (isLoading) {
    return <AccountsCardsSkeleton />;
  }

  const accountsByOwner = items.reduce(
    (acc, account) => {
      const ownerId = account.ownerId || "__no_owner__";
      const ownerName = account.owner?.name || account.owner?.email || "Без владельца";
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
        owner: { id: string; name: string | null; email: string; image: string | null } | null;
        ownerName: string;
        accounts: typeof items;
      }
    >
  );

  const sortedOwners = Object.values(accountsByOwner).sort((a, b) => {
    if (!a.owner && b.owner) return 1;
    if (a.owner && !b.owner) return -1;
    if (!a.owner && !b.owner) return 0;
    return (a.owner?.name || a.owner?.email || "").localeCompare(b.owner?.name || b.owner?.email || "");
  });

  return (
    <>
      <div className="relative">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {sortedOwners.map(({ owner, ownerName, accounts: ownerAccounts }) => {
              const ownerId = owner?.id || "__no_owner__";
              return (
                <div key={ownerId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {owner?.image ? (
                      <Image
                        src={owner.image}
                        alt={ownerName}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-medium"
                        style={{
                          backgroundColor: getAvatarColor(owner?.name || owner?.email || "U"),
                        }}
                      >
                        {(() => {
                          const displayName = owner?.name || owner?.email || "U";
                          const initials = displayName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2);
                          return initials;
                        })()}
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-muted-foreground tracking-wider">
                      {ownerName}
                    </h3>
                  </div>
                  <SortableContext items={ownerAccounts.map((account) => account.id)}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,300px)]">
                      {ownerAccounts.map((account) => (
                        <SortableAccountCard
                          key={account.id}
                          account={account}
                          isReorderMode={isReorderMode}
                          onClick={() => {
                            accountActionsDialog.openDialog({ account });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
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
            transactionTabsDialog.openDialog({
              workspaceId,
              defaultAccountId: accountActionsDialog.data.account.id,
              defaultType: TransactionType.EXPENSE,
            });
            accountActionsDialog.closeDialog();
          }}
          onCreateTransfer={() => {
            transferDialog.openDialog({
              workspaceId,
              defaultFromAccountId: accountActionsDialog.data.account.id,
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

      {transactionTabsDialog.mounted && (
        <CreateTransactionDialog
          workspaceId={transactionTabsDialog.data.workspaceId}
          open={transactionTabsDialog.open}
          onOpenChange={transactionTabsDialog.closeDialog}
          onCloseComplete={transactionTabsDialog.unmountDialog}
          defaultAccountId={transactionTabsDialog.data.defaultAccountId}
          defaultType={transactionTabsDialog.data.defaultType}
        />
      )}

      {transferDialog.mounted && (
        <CreateTransferDialog
          workspaceId={transferDialog.data.workspaceId}
          open={transferDialog.open}
          onOpenChange={transferDialog.closeDialog}
          defaultFromAccountId={transferDialog.data.defaultFromAccountId}
        />
      )}
    </>
  );
}
