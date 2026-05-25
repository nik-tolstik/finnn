"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Account } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { updateAccountsOrder } from "@/modules/accounts/account.service";
import { resolveViewerUserId } from "@/modules/accounts/account-visibility";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { runOptimisticWorkspaceMutation, updateAccountsInCache } from "@/shared/lib/optimistic-workspace-updates";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";

type AccountWithOwner = Account & {
  owner?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

interface AccountsCardsReorderViewProps {
  accounts: AccountWithOwner[];
  initialCurrentUserId?: string;
  workspaceId: string;
  onCancelReorder?: () => void;
  onReorderModeChange?: (isReorderMode: boolean) => void;
}

interface SortableAccountCardProps {
  account: AccountWithOwner;
}

function SortableAccountCard({ account }: SortableAccountCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
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

  return (
    <div ref={setNodeRef} style={style} className="w-full min-w-0">
      <div
        {...attributes}
        {...listeners}
        className={cn("w-full min-w-0 select-none touch-none cursor-grab active:cursor-grabbing")}
        style={{
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
      >
        <AccountCard account={account} showOwner={false} />
      </div>
    </div>
  );
}

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
        owner: { id: string; name: string | null; email: string; image: string | null } | null;
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

export function AccountsCardsReorderView({
  accounts,
  initialCurrentUserId,
  workspaceId,
  onCancelReorder,
  onReorderModeChange,
}: AccountsCardsReorderViewProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [items, setItems] = useState(accounts);
  const [originalItems, setOriginalItems] = useState(accounts);
  const viewerUserId = resolveViewerUserId(session?.user?.id, initialCurrentUserId);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setItems(accounts);
    setOriginalItems(accounts);
  }, [accounts]);

  const sortedOwners = useMemo(() => groupAccountsByOwner(items, viewerUserId), [items, viewerUserId]);

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

      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleSaveReorder = useCallback(async () => {
    const accountOrders = items.map((account, index) => ({
      id: account.id,
      order: index,
    }));

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["accounts", "transactions", "archivedAccounts"],
        apply: (context) => {
          updateAccountsInCache(
            context,
            accountOrders.map((accountOrder) => ({
              id: accountOrder.id,
              order: accountOrder.order,
            }))
          );
        },
        mutation: () =>
          updateAccountsOrder(workspaceId, {
            accountOrders,
          }),
      });

      if (result.error) {
        toast.error(result.error);
        setItems(originalItems);
        return;
      }

      setOriginalItems(items);
      onReorderModeChange?.(false);
      return;
    } catch {
      setItems(originalItems);
      toast.error("Не удалось изменить порядок счетов");
    }
  }, [items, originalItems, workspaceId, queryClient, onReorderModeChange]);

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
    window.addEventListener("cancelReorder", handleCancelReorder);
    return () => {
      window.removeEventListener("cancelReorder", handleCancelReorder);
    };
  }, [handleCancelReorder]);

  return (
    <div className="relative">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                <SortableContext items={ownerAccounts.map((account) => account.id)}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {ownerAccounts.map((account) => (
                      <SortableAccountCard key={account.id} account={account} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
