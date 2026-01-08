"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountCard } from "@/shared/components/AccountCard";
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
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const accounts = accountsData?.data?.filter((acc) => !excludeAccountIds.includes(acc.id)) || [];

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
          <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto py-4">
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Нет доступных счетов</div>
            ) : (
              accounts.map((account) => (
                <AccountCard key={account.id} account={account} onClick={() => handleSelect(account)} />
              ))
            )}
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
