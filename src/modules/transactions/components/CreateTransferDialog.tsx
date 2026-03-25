"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { createTransferSchema, type CreateTransferInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogWindow, DialogHeader, DialogTitle, DialogFooter, DialogContent } from "@/shared/ui/dialog";

import { createTransfer } from "../transaction.service";

import { TransferForm } from "./TransferForm";
import { TransferFormSubmitButton } from "./TransferFormSubmitButton";

interface CreateTransferDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFromAccountId?: string;
}

export function CreateTransferDialog({
  workspaceId,
  open,
  onOpenChange,
  defaultFromAccountId,
}: CreateTransferDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<CreateTransferInput>({
    resolver: zodResolver(createTransferSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: "",
      toAmount: "",
      description: "",
      date: new Date(),
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
    if (open) {
      form.reset({
        fromAccountId: defaultFromAccountId || "",
        toAccountId: "",
        amount: "",
        toAmount: "",
        description: "",
        date: new Date(),
      });
    }
  }, [open, form, defaultFromAccountId]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateTransferInput) => {
    const result = await createTransfer(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, [
        "transactions",
        "accounts",
        "capital",
        "analyticsCategory",
        "analyticsTotal",
      ]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать перевод</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <TransferForm workspaceId={workspaceId} form={form} accounts={accounts} onSubmit={onSubmit} />
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Отмена
          </Button>
          <TransferFormSubmitButton form={form} onSubmit={onSubmit} />
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
