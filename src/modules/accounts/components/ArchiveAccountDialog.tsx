"use client";

import type { Account } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

import { archiveAccount } from "../account.service";

interface ArchiveAccountDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveAccountDialog({
  account,
  open,
  onOpenChange,
}: ArchiveAccountDialogProps) {
  const router = useRouter();
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
        router.refresh();
      }
    } catch {
      hasArchivedRef.current = false;
      toast.error("Произошла ошибка при архивировании");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Архивировать счёт?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уверены, что хотите архивировать счёт &quot;{account.name}&quot;?
            Счёт будет скрыт из списка, но не будет удалён из базы данных. Вы
            сможете восстановить его позже.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={isArchiving}
            type="button"
          >
            {isArchiving ? "Архивирование..." : "Архивировать"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
