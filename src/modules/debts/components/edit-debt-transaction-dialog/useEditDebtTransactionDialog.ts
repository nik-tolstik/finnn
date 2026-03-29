"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { type UpdateDebtTransactionInput, updateDebtTransactionSchema } from "@/shared/lib/validations/debt";

import { DebtTransactionType } from "../../debt.constants";
import { updateDebtTransaction } from "../../debt.service";
import type {
  EditDebtTransactionDialogAccount,
  EditDebtTransactionDialogProps,
} from "./edit-debt-transaction-dialog.types";
import {
  getEditDebtAmountLabel,
  getEditDebtTransactionDefaultValues,
  getEditDebtTransactionDescription,
  getEditDebtTransactionTitle,
  getPreviewDebtTransactionAccount,
} from "./edit-debt-transaction-dialog.utils";

type UseEditDebtTransactionDialogProps = Pick<
  EditDebtTransactionDialogProps,
  "debtTransaction" | "workspaceId" | "open" | "onOpenChange" | "onSuccess"
>;

export function useEditDebtTransactionDialog({
  debtTransaction,
  workspaceId,
  open,
  onOpenChange,
  onSuccess,
}: UseEditDebtTransactionDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<UpdateDebtTransactionInput>({
    resolver: zodResolver(updateDebtTransactionSchema),
    defaultValues: getEditDebtTransactionDefaultValues(debtTransaction),
  });

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  useEffect(() => {
    if (open) {
      form.reset(getEditDebtTransactionDefaultValues(debtTransaction));
    }
  }, [open, form, debtTransaction]);

  const accounts = (accountsData?.data ?? []) as EditDebtTransactionDialogAccount[];
  const amount = useWatch({ control: form.control, name: "amount" });
  const toAmount = useWatch({ control: form.control, name: "toAmount" });
  const accountId = useWatch({ control: form.control, name: "accountId" });

  const selectedAccount = useMemo(() => {
    if (!accountId) {
      return undefined;
    }

    return accounts.find((account) => account.id === accountId);
  }, [accountId, accounts]);

  const isClosedTransaction = debtTransaction.type === DebtTransactionType.CLOSED;
  const isAddedTransaction = debtTransaction.type === DebtTransactionType.ADDED;
  const currenciesMatch = !selectedAccount || selectedAccount.currency === debtTransaction.debt.currency;

  const previewAccount = useMemo(
    () =>
      getPreviewDebtTransactionAccount({
        debtTransaction,
        selectedAccount,
        amount,
        toAmount,
        currenciesMatch,
      }),
    [debtTransaction, selectedAccount, amount, toAmount, currenciesMatch]
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    if (isClosedTransaction) {
      if (!data.accountId) {
        toast.error("Выберите счёт");
        return;
      }

      if (!currenciesMatch && !data.toAmount) {
        toast.error("Укажите сумму отправления");
        return;
      }
    }

    const result = await updateDebtTransaction(debtTransaction.id, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Транзакция долга обновлена");
    onOpenChange(false);
    await invalidateWorkspaceDomains(queryClient, workspaceId, ["debts", "transactions", "accounts"]);
    onSuccess?.();
  });

  return {
    form,
    handleSubmit,
    dialogTitle: getEditDebtTransactionTitle(debtTransaction.type),
    dialogDescription: getEditDebtTransactionDescription(debtTransaction.type),
    debtAmountLabel: getEditDebtAmountLabel({
      debtTransaction,
      selectedAccount,
      currenciesMatch,
    }),
    selectedAccount,
    previewAccount,
    currenciesMatch,
    isClosedTransaction,
    isAddedTransaction,
    currentAccountUnavailable: Boolean(isClosedTransaction && accountId && !selectedAccount && debtTransaction.account),
  };
}
