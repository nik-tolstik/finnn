"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { type UpdateDebtTransactionInput, updateDebtTransactionSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, compareMoney, formatMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { DebtTransactionType, DebtType } from "../debt.constants";
import { updateDebtTransaction } from "../debt.service";
import type { DebtTransactionWithRelations } from "../debt.types";

interface EditDebtTransactionDialogProps {
  debtTransaction: DebtTransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onSuccess?: () => void;
}

function getTransactionTitle(transactionType: string) {
  return transactionType === DebtTransactionType.CLOSED
    ? "Редактировать погашение долга"
    : "Редактировать добавление к долгу";
}

function getTransactionDescription(transactionType: string) {
  return transactionType === DebtTransactionType.CLOSED
    ? "Измените параметры погашения долга."
    : "Измените сумму и дату добавления к долгу.";
}

function getDebtTransactionAccountAmount(transaction: { amount: string; toAmount?: string | null; type: string }) {
  return transaction.type === DebtTransactionType.CLOSED
    ? transaction.toAmount || transaction.amount
    : transaction.amount;
}

function getDebtTransactionBalanceDelta(
  debtType: string,
  transaction: {
    type: string;
    amount: string;
    toAmount?: string | null;
  }
) {
  const accountAmount = getDebtTransactionAccountAmount(transaction);

  if (transaction.type === DebtTransactionType.CLOSED) {
    return debtType === DebtType.LENT ? accountAmount : subtractMoney("0", accountAmount);
  }

  return debtType === DebtType.LENT ? subtractMoney("0", accountAmount) : accountAmount;
}

export function EditDebtTransactionDialog({
  debtTransaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
}: EditDebtTransactionDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<UpdateDebtTransactionInput>({
    resolver: zodResolver(updateDebtTransactionSchema),
    defaultValues: {
      amount: debtTransaction.amount,
      toAmount: debtTransaction.toAmount || "",
      accountId: debtTransaction.accountId || "",
      date: new Date(debtTransaction.date),
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  useEffect(() => {
    if (open) {
      form.reset({
        amount: debtTransaction.amount,
        toAmount: debtTransaction.toAmount || "",
        accountId: debtTransaction.accountId || "",
        date: new Date(debtTransaction.date),
      });
    }
  }, [open, form, debtTransaction]);

  const amount = useWatch({ control: form.control, name: "amount" });
  const toAmount = useWatch({ control: form.control, name: "toAmount" });
  const accountId = useWatch({ control: form.control, name: "accountId" });

  const selectedAccount = useMemo(() => {
    if (!accountId) return undefined;
    return accounts.find((account) => account.id === accountId);
  }, [accountId, accounts]);

  const currenciesMatch = useMemo(() => {
    if (!selectedAccount) {
      return true;
    }

    return selectedAccount.currency === debtTransaction.debt.currency;
  }, [selectedAccount, debtTransaction.debt.currency]);

  const previewAccount = useMemo(() => {
    if (!selectedAccount) {
      return selectedAccount;
    }

    const nextAmount = amount || debtTransaction.amount;
    const nextToAmount =
      debtTransaction.type === DebtTransactionType.CLOSED ? (currenciesMatch ? null : toAmount || null) : null;

    if (
      compareMoney(nextAmount || "0", "0") <= 0 ||
      (debtTransaction.type === DebtTransactionType.CLOSED &&
        !currenciesMatch &&
        (!nextToAmount || compareMoney(nextToAmount, "0") <= 0))
    ) {
      return selectedAccount;
    }

    const oldBalanceDelta =
      debtTransaction.accountId === selectedAccount.id
        ? getDebtTransactionBalanceDelta(debtTransaction.debt.type, debtTransaction)
        : "0";
    const nextBalanceDelta = getDebtTransactionBalanceDelta(debtTransaction.debt.type, {
      type: debtTransaction.type,
      amount: nextAmount,
      toAmount: nextToAmount,
    });
    const nextBalance = addMoney(selectedAccount.balance, subtractMoney(nextBalanceDelta, oldBalanceDelta));

    if (compareMoney(nextBalance, "0") < 0) {
      return selectedAccount;
    }

    return {
      ...selectedAccount,
      balance: nextBalance,
    };
  }, [selectedAccount, amount, toAmount, currenciesMatch, debtTransaction]);

  const onSubmit = async (data: UpdateDebtTransactionInput) => {
    if (debtTransaction.type === DebtTransactionType.CLOSED) {
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
    } else {
      toast.success("Транзакция долга обновлена");
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["debts", "transactions", "accounts"]);
      onSuccess?.();
    }
  };

  const debtAmountLabel =
    debtTransaction.type === DebtTransactionType.CLOSED
      ? currenciesMatch || !selectedAccount
        ? `Сумма к закрытию (${debtTransaction.debt.currency})`
        : debtTransaction.debt.type === DebtType.LENT
          ? `Сумма получения (${debtTransaction.debt.currency})`
          : `Сумма к закрытию (${debtTransaction.debt.currency})`
      : `Сумма (${debtTransaction.debt.currency})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{getTransactionTitle(debtTransaction.type)}</DialogTitle>
          <DialogDescription>{getTransactionDescription(debtTransaction.type)}</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="text-sm text-muted-foreground">Контрагент</div>
              <div className="font-medium">{debtTransaction.debt.personName}</div>
              <div className="text-sm text-muted-foreground">
                Остаток долга: {formatMoney(debtTransaction.debt.remainingAmount, debtTransaction.debt.currency)}
              </div>
            </div>

            {debtTransaction.type === DebtTransactionType.ADDED && debtTransaction.accountId ? (
              <div className="space-y-2">
                <Label>Счёт</Label>
                {previewAccount ? (
                  <AccountCard account={previewAccount} showOwner={false} />
                ) : debtTransaction.account ? (
                  <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    {debtTransaction.account.name}
                  </div>
                ) : null}
              </div>
            ) : null}

            {debtTransaction.type === DebtTransactionType.CLOSED ? (
              <div className="space-y-2">
                <Controller
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <AccountSelector
                      workspaceId={workspaceId}
                      account={previewAccount || selectedAccount || null}
                      onSelect={(account) => field.onChange(account.id)}
                      label={debtTransaction.debt.type === DebtType.LENT ? "Счёт для зачисления" : "Счёт для списания"}
                      required
                      error={form.formState.errors.accountId?.message}
                    />
                  )}
                />
                {accountId && !selectedAccount && debtTransaction.account ? (
                  <p className="text-sm text-muted-foreground">
                    Текущий счёт "{debtTransaction.account.name}" недоступен для выбора. Выберите другой счёт.
                  </p>
                ) : null}
              </div>
            ) : null}

            {debtTransaction.type === DebtTransactionType.CLOSED && !currenciesMatch && selectedAccount ? (
              <div className="space-y-2">
                <Label htmlFor="toAmount">
                  Сумма отправления ({selectedAccount.currency}) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
                    {getCurrencySymbol(selectedAccount.currency)}
                  </span>
                  <NumberInput id="toAmount" placeholder="0.00" className="pl-9" {...form.register("toAmount")} />
                </div>
                {form.formState.errors.toAmount ? (
                  <p className="text-sm text-destructive">{form.formState.errors.toAmount.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="amount">
                {debtAmountLabel} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm font-medium text-muted-foreground">
                  {getCurrencySymbol(debtTransaction.debt.currency)}
                </span>
                <NumberInput id="amount" placeholder="0.00" className="pl-9" {...form.register("amount")} />
              </div>
              {form.formState.errors.amount ? (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Дата</Label>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => <DateTimePicker date={field.value} onSelect={field.onChange} />}
              />
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
