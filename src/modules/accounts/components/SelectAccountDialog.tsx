"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { accountKeys } from "@/shared/lib/query-keys";
import { Dialog, DialogWindow, DialogDescription, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";

interface SelectAccountDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
  onSelect: (account: Account) => void;
  excludeAccountIds?: string[];
  title?: string;
  description?: string;
}

export function SelectAccountDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSelect,
  excludeAccountIds = [],
  title = "Выберите счёт",
  description = "Выберите счёт из списка",
}: SelectAccountDialogProps) {
  const { data: session } = useSession();
  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accountsByOwner = useMemo(() => {
    const filtered = accountsData?.data?.filter((acc) => !excludeAccountIds.includes(acc.id)) || [];
    const currentUserId = session?.user?.id;

    const grouped = filtered.reduce(
      (acc, account) => {
        const ownerId = account.ownerId || "__no_owner__";
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
          accounts: typeof filtered;
        }
      >
    );

    const sortedGroups = Object.values(grouped).sort((a, b) => {
      if (!currentUserId) {
        if (!a.owner && b.owner) return 1;
        if (a.owner && !b.owner) return -1;
        if (!a.owner && !b.owner) return 0;
        return (a.owner?.name || a.owner?.email || "").localeCompare(b.owner?.name || b.owner?.email || "");
      }

      const aIsCurrentUser = a.owner?.id === currentUserId;
      const bIsCurrentUser = b.owner?.id === currentUserId;
      const aIsShared = !a.owner;
      const bIsShared = !b.owner;

      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
      if (aIsShared && !bIsShared && !bIsCurrentUser) return 1;
      if (!aIsShared && bIsShared && !aIsCurrentUser) return -1;
      if (aIsShared && bIsShared) return 0;
      return (a.owner?.name || a.owner?.email || "").localeCompare(b.owner?.name || b.owner?.email || "");
    });

    return sortedGroups;
  }, [accountsData?.data, excludeAccountIds, session?.user?.id]);

  const handleSelect = (account: Account) => {
    onSelect(account);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:max-w-[400px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4">
            {accountsByOwner.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Нет доступных счетов</div>
            ) : (
              accountsByOwner.map((group) => (
                <div key={group.owner?.id || "__no_owner__"} className="flex flex-col gap-3">
                  {group.owner ? (
                    <UserDisplay
                      name={group.owner.name}
                      email={group.owner.email}
                      image={group.owner.image}
                      size="sm"
                      showName={true}
                    />
                  ) : (
                    <span className="text-sm font-medium">Общие</span>
                  )}
                  <div className="flex flex-col gap-2">
                    {group.accounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onClick={() => handleSelect(account)}
                        showOwner={false}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
