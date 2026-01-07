"use client";

import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AccountCard } from "@/shared/components/AccountCard";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogWindow, DialogDescription, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";

import { getArchivedAccounts, unarchiveAccount } from "../account.service";

interface ArchivedAccountsDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
}

export function ArchivedAccountsDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
}: ArchivedAccountsDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unarchivingIds, setUnarchivingIds] = useState<Set<string>>(new Set());

  const { data: archivedAccountsData, isLoading } = useQuery({
    queryKey: ["archivedAccounts", workspaceId],
    queryFn: () => getArchivedAccounts(workspaceId),
    enabled: open,
  });

  const archivedAccounts = archivedAccountsData?.data || [];

  const handleUnarchive = async (account: Account) => {
    if (unarchivingIds.has(account.id)) return;

    setUnarchivingIds((prev) => new Set(prev).add(account.id));

    try {
      const result = await unarchiveAccount(account.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Счёт удалён из архива");
        await queryClient.invalidateQueries({
          queryKey: ["accounts", workspaceId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["archivedAccounts", workspaceId],
        });
        router.refresh();
      }
    } catch {
      toast.error("Произошла ошибка при удалении из архива");
    } finally {
      setUnarchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(account.id);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Архивированные счета</DialogTitle>
          <DialogDescription>
            Список всех архивированных счетов. Вы можете удалить счёт из архива, чтобы восстановить его.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
            ) : archivedAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Нет архивированных счетов</div>
            ) : (
              <div className="space-y-3">
                {archivedAccounts.map((account) => (
                  <div key={account.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <AccountCard account={account} />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnarchive(account)}
                      disabled={unarchivingIds.has(account.id)}
                      className="gap-2 shrink-0"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
