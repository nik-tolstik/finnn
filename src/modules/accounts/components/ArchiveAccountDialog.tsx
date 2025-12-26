"use client";

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
import { archiveAccount } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import type { Account } from "@prisma/client";

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
    } catch (error) {
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
            Вы уверены, что хотите архивировать счёт "{account.name}"? Счёт
            будет скрыт из списка, но не будет удалён из базы данных. Вы
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

