"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { deleteArchivedAccount } from "../../account.service";

interface DeleteArchivedAccountDialogProps {
  account: {
    id: string;
    name: string;
    workspaceId: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
}

export function DeleteArchivedAccountDialog({
  account,
  open,
  onOpenChange,
  onCloseComplete,
}: DeleteArchivedAccountDialogProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const result = await deleteArchivedAccount(account.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Счёт удалён");
        onOpenChange(false);
        await invalidateWorkspaceDomains(queryClient, account.workspaceId, ["accounts", "archivedAccounts"]);
      }
    } catch {
      toast.error("Не удалось удалить архивный счёт");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false} onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Удалить счёт из архива?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите навсегда удалить счёт &quot;{account.name}&quot;? Это действие нельзя отменить.
            Удаление доступно только для пустого архивного счёта без связанной финансовой истории.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
