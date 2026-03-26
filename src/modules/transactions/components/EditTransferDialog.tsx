"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { type UpdateTransferInput, updateTransferSchema } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";

import { updateTransfer } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";
import { TransferForm } from "./TransferForm";
import { TransferFormSubmitButton } from "./TransferFormSubmitButton";

interface EditTransferDialogProps {
  transaction: TransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onSuccess?: () => void;
}

export function EditTransferDialog({
  transaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
}: EditTransferDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<UpdateTransferInput>({
    resolver: zodResolver(updateTransferSchema),
    defaultValues: {
      fromAccountId: transaction.account.id,
      toAccountId: transaction.transferFrom?.toTransaction.account.id || "",
      amount: transaction.amount,
      toAmount: transaction.transferFrom?.toAmount || "",
      description: transaction.description || "",
      date: new Date(transaction.date),
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => {
    return accountsData?.data || [];
  }, [accountsData?.data]);

  useEffect(() => {
    if (open && transaction.transferFrom) {
      form.reset({
        fromAccountId: transaction.account.id,
        toAccountId: transaction.transferFrom.toTransaction.account.id,
        amount: transaction.amount,
        toAmount: transaction.transferFrom.toAmount,
        description: transaction.description || "",
        date: new Date(transaction.date),
      });
    }
  }, [open, form, transaction]);

  const onSubmit = async (data: UpdateTransferInput) => {
    const result = await updateTransfer(transaction.id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["transactions", "accounts"]);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Редактировать перевод</DialogTitle>
          <DialogDescription>Измените параметры перевода</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <TransferForm
            workspaceId={workspaceId}
            form={form}
            accounts={accounts}
            onSubmit={onSubmit}
            originalAmount={transaction.amount}
          />
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <TransferFormSubmitButton
            form={form}
            onSubmit={onSubmit}
            submitLabel="Сохранить"
            submittingLabel="Сохранение..."
          />
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
