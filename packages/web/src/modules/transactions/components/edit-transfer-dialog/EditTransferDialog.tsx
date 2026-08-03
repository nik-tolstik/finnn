import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { addAccountBalanceDelta, getTransferTransactionBalanceDeltas } from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateTransactionsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys } from "@/shared/lib/query-keys";
import {
  type UpdateTransferTransactionInput,
  updateTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";
import {
  Dialog,
  type DialogAction,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { subtractMoney } from "@/shared/utils/money";

import { updateTransferTransaction } from "../../transaction.api";
import type {
  CombinedTransaction,
  TransactionAccountWithOwner,
  TransactionUser,
  TransferTransactionWithRelations,
} from "../../transaction.types";
import { TransferForm } from "../transfer-form/TransferForm";
import { TransferFormSubmitButton } from "../transfer-form-submit-button/TransferFormSubmitButton";

interface EditTransferDialogProps {
  transferTransaction: TransferTransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

function toTransactionAccount(
  account: (Account & { owner?: TransactionUser | null }) | TransactionAccountWithOwner | undefined
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

export function EditTransferDialog({
  transferTransaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
  onDelete,
}: EditTransferDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<UpdateTransferTransactionInput>({
    resolver: zodResolver(updateTransferTransactionSchema),
    mode: "onChange",
    defaultValues: {
      fromAccountId: transferTransaction.fromAccount.id,
      toAccountId: transferTransaction.toAccount.id,
      amount: transferTransaction.amount,
      toAmount: transferTransaction.toAmount,
      description: transferTransaction.description || "",
      date: new Date(transferTransaction.date),
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
        fromAccountId: transferTransaction.fromAccount.id,
        toAccountId: transferTransaction.toAccount.id,
        amount: transferTransaction.amount,
        toAmount: transferTransaction.toAmount,
        description: transferTransaction.description || "",
        date: new Date(transferTransaction.date),
      });
    }
  }, [open, form, transferTransaction]);

  const onSubmit = async (data: UpdateTransferTransactionInput) => {
    const balanceDeltas = new Map<string, string>();
    const oldDeltas = getTransferTransactionBalanceDeltas(transferTransaction.amount, transferTransaction.toAmount);
    const nextDeltas = getTransferTransactionBalanceDeltas(data.amount, data.toAmount);
    addAccountBalanceDelta(balanceDeltas, transferTransaction.fromAccountId, subtractMoney("0", oldDeltas.fromDelta));
    addAccountBalanceDelta(balanceDeltas, transferTransaction.toAccountId, subtractMoney("0", oldDeltas.toDelta));
    addAccountBalanceDelta(balanceDeltas, data.fromAccountId, nextDeltas.fromDelta);
    addAccountBalanceDelta(balanceDeltas, data.toAccountId, nextDeltas.toDelta);
    const nextFromAccount = toTransactionAccount(
      accounts.find((account) => account.id === data.fromAccountId) ??
        (transferTransaction.fromAccount.id === data.fromAccountId ? transferTransaction.fromAccount : undefined)
    );
    const nextToAccount = toTransactionAccount(
      accounts.find((account) => account.id === data.toAccountId) ??
        (transferTransaction.toAccount.id === data.toAccountId ? transferTransaction.toAccount : undefined)
    );
    if (!nextFromAccount || !nextToAccount) {
      return;
    }

    const optimisticTransfer: CombinedTransaction = {
      kind: "transferTransaction",
      data: {
        ...transferTransaction,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        toAmount: data.toAmount,
        description: data.description || null,
        date: data.date,
        createdByAi: false,
        updatedAt: new Date(),
        fromAccount: nextFromAccount,
        toAccount: nextToAccount,
      },
    };

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          updateTransactionsInCache(context, [optimisticTransfer]);
        },
        onApplied: () => onOpenChange(false),
        mutation: () => updateTransferTransaction(transferTransaction.id, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onSuccess?.();
    } catch {
      toast.error("Не удалось обновить перевод");
    }
  };

  const actions: DialogAction[] = onDelete
    ? [
        {
          id: "delete",
          icon: <Trash2 />,
          label: "Удалить",
          onSelect: onDelete,
          tone: "destructive",
          disabled: form.formState.isSubmitting,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow
        className="sm:w-[500px]"
        closeButtonDisabled={form.formState.isSubmitting}
        actions={actions}
        onCloseComplete={onCloseComplete}
      >
        <DialogHeader>
          <DialogTitle className="truncate">Редактировать перевод</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <TransferForm
            workspaceId={workspaceId}
            form={form}
            accounts={accounts}
            onSubmit={onSubmit}
            originalAmount={transferTransaction.amount}
          />
        </DialogContent>
        <DialogFooter>
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
