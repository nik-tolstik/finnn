"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { addAccountBalanceDelta, getDebtInitialAccountBalanceDelta } from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateDebtsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys } from "@/shared/lib/query-keys";
import { type AddToDebtInput, addToDebtSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, formatMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { addToDebt } from "../../debt.api";
import { DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";

interface AddToDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function AddToDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: AddToDebtDialogProps) {
  const queryClient = useQueryClient();
  const selectAccountDialog = useDialogState();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  const form = useForm<AddToDebtInput>({
    resolver: zodResolver(addToDebtSchema),
    defaultValues: {
      amount: "",
      toAmount: "",
      useAccount: false,
      accountId: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = form;

  const amount = useWatch({ control, name: "amount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const useAccount = useWatch({ control, name: "useAccount" });
  const accountId = useWatch({ control, name: "accountId" });
  const rateDate = useMemo(() => new Date(), []);

  const selectedAccount = useMemo(() => {
    if (!accountId) {
      return undefined;
    }

    return accounts.find((account) => account.id === accountId);
  }, [accountId, accounts]);

  const currenciesMatch = !selectedAccount || selectedAccount.currency === debt.currency;
  const accountAmount = currenciesMatch ? amount : toAmount;

  const { handleAmountChange, handleToAmountChange } = useCurrencyAmountSync({
    form,
    fromCurrency: debt.currency,
    toCurrency: useAccount ? selectedAccount?.currency : undefined,
    date: rateDate,
  });

  const previewAccount = useMemo(() => {
    if (!selectedAccount || !accountAmount) {
      return selectedAccount;
    }

    const amountNum = parseFloat(accountAmount);
    if (Number.isNaN(amountNum)) return selectedAccount;

    let newBalance = selectedAccount.balance;
    if (debt.type === DebtType.LENT) {
      if (parseFloat(selectedAccount.balance) < parseFloat(accountAmount)) {
        return selectedAccount;
      }
      newBalance = subtractMoney(selectedAccount.balance, accountAmount);
    } else {
      newBalance = addMoney(selectedAccount.balance, accountAmount);
    }

    return {
      ...selectedAccount,
      balance: newBalance,
    };
  }, [selectedAccount, accountAmount, debt.type]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({
        amount: "",
        toAmount: "",
        useAccount: false,
        accountId: "",
      });
    }
    prevOpenRef.current = open;
  }, [open, reset]);

  const onSubmit = async (data: AddToDebtInput) => {
    const submitData: AddToDebtInput = {
      ...data,
      accountId: data.useAccount ? data.accountId : undefined,
      toAmount: data.useAccount ? data.toAmount : undefined,
    };

    if (submitData.useAccount && !submitData.accountId) {
      toast.error("Выберите счёт");
      return;
    }

    if (submitData.useAccount && selectedAccount?.currency !== debt.currency && !submitData.toAmount) {
      toast.error("Укажите сумму в валюте счёта");
      return;
    }

    const balanceDeltas = new Map<string, string>();
    if (submitData.useAccount && submitData.accountId) {
      addAccountBalanceDelta(
        balanceDeltas,
        submitData.accountId,
        getDebtInitialAccountBalanceDelta(
          debt.type,
          selectedAccount?.currency !== debt.currency ? data.toAmount || data.amount : data.amount
        )
      );
    }

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
              amount: addMoney(debt.amount, data.amount),
              remainingAmount: addMoney(debt.remainingAmount, data.amount),
              status: "open",
            },
          ]);
        },
        mutation: () => addToDebt(debt.id, submitData),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Сумма добавлена к долгу");
      onOpenChange(false);
    } catch {
      toast.error("Не удалось добавить сумму к долгу");
    }
  };

  const handleAccountSelect = (account: Account) => {
    setValue("accountId", account.id, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{debt.type === DebtType.LENT ? "Дать ещё в долг" : "Взять ещё в долг"}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="text-sm text-muted-foreground">
                {debt.type === DebtType.LENT ? "Должник" : "Кредитор"}
              </div>
              <div className="font-medium">{debt.personName}</div>
              <div className="text-sm text-muted-foreground">
                Текущий долг: {formatMoney(debt.remainingAmount, debt.currency)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addAmount" required>
                Дополнительная сумма
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(debt.currency)}
                </span>
                <NumberInput
                  id="addAmount"
                  placeholder="0.00"
                  className="pl-9"
                  {...register("amount", {
                    onChange: (event) => handleAmountChange(event.target.value),
                  })}
                />
              </div>
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                control={control}
                name="useAccount"
                render={({ field }) => (
                  <Checkbox id="addUseAccount" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="addUseAccount" className="cursor-pointer">
                Использовать счёт
              </Label>
            </div>

            {useAccount ? (
              <>
                <div className="space-y-2">
                  <Label required>{debt.type === DebtType.LENT ? "Списать со счёта" : "Зачислить на счёт"}</Label>
                  {previewAccount && accountId ? (
                    <AccountCard
                      account={previewAccount}
                      onClick={() => selectAccountDialog.openDialog(null)}
                      showOwner={false}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => selectAccountDialog.openDialog(null)}
                    >
                      Выбрать счёт
                    </Button>
                  )}
                  {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
                </div>

                {selectedAccount && !currenciesMatch ? (
                  <div className="space-y-2">
                    <Label htmlFor="addToAmount" required>
                      {debt.type === DebtType.LENT ? "Сумма списания" : "Сумма зачисления"} ({selectedAccount.currency})
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                        {getCurrencySymbol(selectedAccount.currency)}
                      </span>
                      <NumberInput
                        id="addToAmount"
                        placeholder="0.00"
                        className="pl-9"
                        {...register("toAmount", {
                          onChange: (event) => handleToAmountChange(event.target.value),
                        })}
                      />
                    </div>
                    {errors.toAmount && <p className="text-sm text-destructive">{errors.toAmount.message}</p>}
                  </div>
                ) : null}
              </>
            ) : null}
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Добавление..." : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogWindow>

      {selectAccountDialog.mounted && (
        <SelectAccountDialog
          workspaceId={workspaceId}
          open={selectAccountDialog.open}
          onOpenChange={selectAccountDialog.closeDialog}
          onCloseComplete={selectAccountDialog.unmountDialog}
          onSelect={handleAccountSelect}
        />
      )}
    </Dialog>
  );
}
