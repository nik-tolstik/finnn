"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import { addAccountBalanceDelta, getDebtInitialAccountBalanceDelta } from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateDebtsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys } from "@/shared/lib/query-keys";
import { type UpdateDebtInput, updateDebtSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, compareMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { getDebtEditData, updateDebt } from "../../debt.api";
import { DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

interface EditDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function EditDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: EditDebtDialogProps) {
  const queryClient = useQueryClient();

  const {
    data: editData,
    isLoading: isLoadingAmount,
    isError: isEditDataError,
    error: editDataError,
  } = useQuery({
    queryKey: ["debtEditData", debt.id],
    queryFn: async () => {
      const result = await getDebtEditData(debt.id);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: open && !!debt?.id,
    staleTime: 0,
    retry: false,
  });

  const initialAccountId = editData?.account?.id;

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open && !!initialAccountId,
    staleTime: 5000,
  });

  const fullAccount = initialAccountId ? accountsData?.data?.find((acc) => acc.id === initialAccountId) : undefined;

  const form = useForm<UpdateDebtInput>({
    resolver: zodResolver(updateDebtSchema),
    defaultValues: {
      personName: debt.personName,
      amount: "",
      toAmount: "",
      date: new Date(debt.date),
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = form;

  useEffect(() => {
    if (open && debt?.id) {
      reset({
        personName: debt.personName,
        amount: editData?.initialAmount ?? "",
        toAmount: editData?.initialToAmount ?? "",
        date: editData?.initialDate ? new Date(editData.initialDate) : new Date(debt.date),
      });
    }
  }, [open, debt?.id, debt.personName, debt.date, editData, reset]);

  const onSubmit = async (data: UpdateDebtInput) => {
    if (fullAccount && fullAccount.currency !== currency && !data.toAmount) {
      toast.error("Укажите сумму в валюте счёта");
      return;
    }

    const amountDelta = subtractMoney(data.amount, editData?.initialAmount ?? debt.amount);
    const nextRemainingAmount = addMoney(debt.remainingAmount, amountDelta);
    const previousAccountAmount =
      fullAccount && fullAccount.currency !== currency
        ? editData?.initialToAmount || editData?.initialAmount || debt.amount
        : editData?.initialAmount || debt.amount;
    const nextAccountAmount =
      fullAccount && fullAccount.currency !== currency ? data.toAmount || data.amount : data.amount;
    const accountAmountDelta = subtractMoney(nextAccountAmount, previousAccountAmount);
    const balanceDeltas = new Map<string, string>();
    addAccountBalanceDelta(
      balanceDeltas,
      initialAccountId,
      getDebtInitialAccountBalanceDelta(debt.type, accountAmountDelta)
    );

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          updateDebtsInCache(context, [
            {
              id: debt.id,
              personName: data.personName,
              amount: data.amount,
              remainingAmount: nextRemainingAmount,
              date: data.date,
              status: compareMoney(nextRemainingAmount, "0") <= 0 ? "closed" : "open",
            },
          ]);
        },
        mutation: () => updateDebt(debt.id, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Долг обновлён");
      onOpenChange(false);
    } catch {
      toast.error("Не удалось обновить долг");
    }
  };

  const currency = editData?.currency ?? debt.currency;
  const amount = useWatch({ control, name: "amount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const date = useWatch({ control, name: "date" });
  const initialAmount = editData?.initialAmount ?? "";
  const currenciesMatch = !fullAccount || fullAccount.currency === currency;

  const { handleAmountChange, handleToAmountChange } = useCurrencyAmountSync({
    form,
    fromCurrency: currency,
    toCurrency: fullAccount?.currency,
    date,
  });

  const previewAccount = useMemo(() => {
    if (!fullAccount || !initialAccountId) return fullAccount;
    if (!amount || !initialAmount) return fullAccount;
    const previousAccountAmount = currenciesMatch ? initialAmount : editData?.initialToAmount || initialAmount;
    const nextAccountAmount = currenciesMatch ? amount : toAmount;
    if (!nextAccountAmount) return fullAccount;
    const amountNum = parseFloat(nextAccountAmount);
    const initialNum = parseFloat(previousAccountAmount);
    if (Number.isNaN(amountNum) || Number.isNaN(initialNum)) return fullAccount;
    const delta = subtractMoney(nextAccountAmount, previousAccountAmount);
    if (delta === "0") return fullAccount;
    const newBalance =
      debt.type === DebtType.LENT ? subtractMoney(fullAccount.balance, delta) : addMoney(fullAccount.balance, delta);
    return { ...fullAccount, balance: newBalance };
  }, [
    fullAccount,
    initialAccountId,
    amount,
    initialAmount,
    currenciesMatch,
    editData?.initialToAmount,
    toAmount,
    debt.type,
  ]);

  useEffect(() => {
    if (isEditDataError && editDataError?.message) {
      toast.error(editDataError.message);
    }
  }, [isEditDataError, editDataError?.message]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Редактировать долг</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {initialAccountId && (
              <div className="space-y-2">
                <Label>Счёт</Label>
                {previewAccount ? (
                  <AccountCard account={previewAccount} showOwner={false} />
                ) : (
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    {editData?.account?.name || "Счёт недоступен"}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="personName" required>
                {debt.type === DebtType.LENT ? "Кто должен" : "Кому должен"}
              </Label>
              <Input
                id="personName"
                placeholder={debt.type === DebtType.LENT ? "Имя должника" : "Имя кредитора"}
                {...register("personName")}
              />
              {errors.personName && <p className="text-sm text-destructive">{errors.personName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" required>
                Изначальная сумма
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(currency)}
                </span>
                <NumberInput
                  id="amount"
                  placeholder="0.00"
                  className="pl-9"
                  {...register("amount", {
                    onChange: (event) => handleAmountChange(event.target.value),
                  })}
                  disabled={isLoadingAmount && !isEditDataError}
                />
              </div>
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            {fullAccount && !currenciesMatch ? (
              <div className="space-y-2">
                <Label htmlFor="toAmount" required>
                  {debt.type === DebtType.LENT ? "Сумма списания" : "Сумма зачисления"} ({fullAccount.currency})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                    {getCurrencySymbol(fullAccount.currency)}
                  </span>
                  <NumberInput
                    id="toAmount"
                    placeholder="0.00"
                    className="pl-9"
                    {...register("toAmount", {
                      onChange: (event) => handleToAmountChange(event.target.value),
                    })}
                    disabled={isLoadingAmount && !isEditDataError}
                  />
                </div>
                {errors.toAmount && <p className="text-sm text-destructive">{errors.toAmount.message}</p>}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Дата</Label>
              <Controller
                control={control}
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
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
