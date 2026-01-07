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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Account } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { CreateTransactionTabsDialog } from "@/modules/transactions/components/CreateTransactionTabsDialog";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { AccountCard } from "@/shared/components/AccountCard";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

import { updateAccountsOrder } from "../account.service";

import { AccountActionsDialog } from "./AccountActionsDialog";
import { AccountsCardsSkeleton } from "./AccountsCardsSkeleton";
import { ArchiveAccountDialog } from "./ArchiveAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";

interface AccountsCardsProps {
  accounts: Account[];
  workspaceId: string;
  isLoading?: boolean;
  onReorderModeChange?: (isReorderMode: boolean) => void;
  reorderMode?: boolean;
  onCancelReorder?: () => void;
}

type ActionDialogData = {
  account: Account;
  onSuccess?: () => void;
  onCancel?: () => void;
};

interface SortableAccountCardProps {
  account: Account;
  onClick: () => void;
}

function SortableAccountCard({
  account,
  onClick,
  isReorderMode,
}: SortableAccountCardProps & { isReorderMode: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id, disabled: !isReorderMode });

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
        className={cn(
          "select-none touch-none",
          isReorderMode && "cursor-grab active:cursor-grabbing"
        )}
        style={{
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <AccountCard account={account} onClick={handleClick} />
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
    defaultTab?: TransactionType;
    onSuccess?: () => void;
    onCancel?: () => void;
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
  }, [
    items,
    originalItems,
    workspaceId,
    queryClient,
    router,
    onReorderModeChange,
  ]);

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

  return (
    <>
      <div className="relative">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((item) => item.id)}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,300px)]">
              {items.map((account) => (
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
        </DndContext>

        {!isReorderMode && (
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
        )}
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
