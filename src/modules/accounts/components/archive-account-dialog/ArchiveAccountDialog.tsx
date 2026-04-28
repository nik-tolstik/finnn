"use client";

import type { Account } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { archiveAccount } from "../../account.service";

interface ArchiveAccountDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
  onSuccess?: () => void;
}

export function ArchiveAccountDialog({
  account,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
}: ArchiveAccountDialogProps) {
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const hasArchivedRef = useRef(false);

  if (!open) {
    hasArchivedRef.current = false;
  }

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isArchiving || hasArchivedRef.current) return;

    hasArchivedRef.current = true;
    setIsArchiving(true);
    try {
      const result = await archiveAccount(account.id);

      if (result.error) {
        toast.error(result.error);
        hasArchivedRef.current = false;
      } else {
        toast.success("Счёт успешно архивирован");
        onOpenChange(false);
        await invalidateWorkspaceDomains(queryClient, account.workspaceId, [
          "accounts",
          "archivedAccounts",
          "transactions",
        ]);
        onSuccess?.();
      }
    } catch {
      hasArchivedRef.current = false;
      toast.error("Произошла ошибка при архивировании");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false} onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Архивировать счёт?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите архивировать счёт &quot;{account.name}&quot;? Счёт будет скрыт из списка, но не будет
            удалён из базы данных. Вы сможете восстановить его позже.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isArchiving} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleArchive} disabled={isArchiving} type="button">
            {isArchiving ? "Архивирование..." : "Архивировать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
