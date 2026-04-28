"use client";

import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redo2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Tooltip } from "@/shared/ui/tooltip";

import { getArchivedAccounts, unarchiveAccount } from "../../account.service";
import { DeleteArchivedAccountDialog } from "../delete-archived-account-dialog/DeleteArchivedAccountDialog";

type ArchivedAccount = Account & {
  owner?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  _count: {
    transactions: number;
    debts: number;
    debtTransactions: number;
  };
};

function getDeleteDisabledReason(account: ArchivedAccount) {
  const parts = [];

  if (account._count.transactions > 0) {
    parts.push(`транзакции (${account._count.transactions})`);
  }

  if (account._count.debts > 0) {
    parts.push(`долги (${account._count.debts})`);
  }

  if (account._count.debtTransactions > 0) {
    parts.push(`долговые операции (${account._count.debtTransactions})`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `Удаление недоступно: есть связанные ${parts.join(", ")}.`;
}

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
  const queryClient = useQueryClient();
  const deleteDialog = useDialogState<ArchivedAccount>();
  const [unarchivingIds, setUnarchivingIds] = useState<Set<string>>(new Set());

  const { data: archivedAccountsData, isLoading } = useQuery({
    queryKey: accountKeys.archived(workspaceId),
    queryFn: () => getArchivedAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const archivedAccounts = (archivedAccountsData?.data || []) as ArchivedAccount[];

  const handleUnarchive = async (account: ArchivedAccount) => {
    if (unarchivingIds.has(account.id)) return;

    setUnarchivingIds((prev) => new Set(prev).add(account.id));

    try {
      const result = await unarchiveAccount(account.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["accounts", "archivedAccounts", "transactions"]);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogWindow onCloseComplete={onCloseComplete}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Архивированные счета</DialogTitle>
            <DialogDescription>
              Список всех архивированных счетов. Вы можете восстановить пустой счёт или удалить его навсегда.
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
                  {archivedAccounts.map((account) => {
                    const deleteDisabledReason = getDeleteDisabledReason(account);

                    return (
                      <div key={account.id} className="flex items-center gap-4">
                        <div className="flex-1">
                          <AccountCard account={account} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnarchive(account)}
                            disabled={unarchivingIds.has(account.id)}
                            className="gap-2"
                          >
                            <Redo2 className="h-4 w-4" />
                          </Button>
                          {deleteDisabledReason ? (
                            <Tooltip content={deleteDisabledReason}>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-disabled="true"
                                aria-label="Удаление недоступно"
                                className="gap-2 text-destructive cursor-not-allowed opacity-50"
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteDialog.openDialog(account)}
                              className="gap-2 text-destructive hover:text-destructive"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </DialogWindow>
      </Dialog>

      {deleteDialog.mounted && (
        <DeleteArchivedAccountDialog
          account={deleteDialog.data}
          open={deleteDialog.open}
          onOpenChange={deleteDialog.closeDialog}
          onCloseComplete={deleteDialog.unmountDialog}
        />
      )}
    </>
  );
}
