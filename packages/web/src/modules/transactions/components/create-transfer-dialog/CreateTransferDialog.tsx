"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import type { Account } from "@/modules/accounts/account.types";
import type { Session } from "@/shared/lib/api-session-client";
import { useSession } from "@/shared/lib/api-session-client";
import { addAccountBalanceDelta, getTransferTransactionBalanceDeltas } from "@/shared/lib/balance-domain";
import {
  insertTransactionsInCache,
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
import type { CombinedTransaction, TransactionAccountWithOwner, TransactionUser } from "../../transaction.types";
import { TransferForm } from "../transfer-form/TransferForm";
import { TransferFormSubmitButton } from "../transfer-form-submit-button/TransferFormSubmitButton";

interface CreateTransferDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFromAccountId?: string;
}

function toTransactionUser(user: Session["user"] | undefined): TransactionUser | null {
  if (!user?.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
  };
}

function toTransactionAccount(
  account: (Account & { owner?: TransactionUser | null }) | undefined
): TransactionAccountWithOwner | null {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color,
    icon: account.icon,
    ownerId: account.ownerId,
    owner: account.owner ?? null,
  };
}

export function CreateTransferDialog({
  workspaceId,
  open,
  onOpenChange,
  defaultFromAccountId,
}: CreateTransferDialogProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
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
    const fromAccount = toTransactionAccount(accounts.find((item) => item.id === data.fromAccountId));
    const toAccount = toTransactionAccount(accounts.find((item) => item.id === data.toAccountId));
    if (!fromAccount || !toAccount) {
      return;
    }

    const optimisticNow = new Date();
    const optimisticTransfer: CombinedTransaction = {
      kind: "transferTransaction",
      data: {
        id: `optimistic-transfer-${optimisticNow.getTime()}`,
        workspaceId,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        createdById: session?.user?.id ?? null,
        amount: data.amount,
        toAmount: data.toAmount,
        description: data.description || null,
        date: data.date,
        createdAt: optimisticNow,
        updatedAt: optimisticNow,
        fromAccount,
        toAccount,
        createdBy: toTransactionUser(session?.user),
      },
    };

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          insertTransactionsInCache(context, [optimisticTransfer]);
        },
        onApplied: () => onOpenChange(false),
        mutation: () => createTransferTransaction(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }
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
