"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { addAccountBalanceDelta, getTransferTransactionBalanceDeltas } from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys } from "@/shared/lib/query-keys";
import {
  type CreateTransferTransactionInput,
  createTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { createTransferTransaction } from "../../transaction.service";
import { TransferForm } from "../transfer-form/TransferForm";
import { TransferFormSubmitButton } from "../transfer-form-submit-button/TransferFormSubmitButton";

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
  const form = useForm<CreateTransferTransactionInput>({
    resolver: zodResolver(createTransferTransactionSchema),
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

  const onSubmit = async (data: CreateTransferTransactionInput) => {
    const balanceDeltas = new Map<string, string>();
    const transferDeltas = getTransferTransactionBalanceDeltas(data.amount, data.toAmount);
    addAccountBalanceDelta(balanceDeltas, data.fromAccountId, transferDeltas.fromDelta);
    addAccountBalanceDelta(balanceDeltas, data.toAccountId, transferDeltas.toDelta);

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => updateAccountBalancesInCache(context, balanceDeltas),
        mutation: () => createTransferTransaction(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
    } catch {
      toast.error("Не удалось создать перевод");
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
