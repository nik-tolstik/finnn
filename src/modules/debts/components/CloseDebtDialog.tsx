"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/SelectAccountDialog";
import { AccountCard } from "@/shared/components/AccountCard";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { closeDebtSchema, type CloseDebtInput } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogWindow, DialogFooter, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, subtractMoney, compareMoney, formatMoney, getCurrencySymbol } from "@/shared/utils/money";

import { DebtType } from "../debt.constants";
import { closeDebt } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";

interface CloseDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CloseDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: CloseDebtDialogProps) {
  const queryClient = useQueryClient();
  const selectAccountDialog = useDialogState();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CloseDebtInput>({
    resolver: zodResolver(closeDebtSchema),
    defaultValues: {
      amount: debt.remainingAmount,
      toAmount: "",
      accountId: debt.accountId || "",
      useAccount: true,
    },
  });

  const amount = useWatch({ control, name: "amount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const accountId = useWatch({ control, name: "accountId" });

  const selectedAccount = useMemo(() => {
    if (!accountId || !accounts.length) return undefined;
    return accounts.find((acc) => acc.id === accountId);
  }, [accountId, accounts]);

  const currenciesMatch = useMemo(() => {
    if (!selectedAccount) return true;
    return selectedAccount.currency === debt.currency;
  }, [selectedAccount, debt.currency]);

  const previewAccount = useMemo(() => {
    if (!selectedAccount) {
      return selectedAccount;
    }

    if (!currenciesMatch) {
      if (!toAmount) {
        return selectedAccount;
      }
      const toAmountNum = parseFloat(toAmount);
      if (Number.isNaN(toAmountNum)) return selectedAccount;

      let newBalance = selectedAccount.balance;
      if (debt.type === DebtType.LENT) {
        newBalance = addMoney(selectedAccount.balance, toAmount);
      } else {
        if (compareMoney(toAmount, selectedAccount.balance) > 0) {
          return selectedAccount;
        }
        newBalance = subtractMoney(selectedAccount.balance, toAmount);
      }

      return {
        ...selectedAccount,
        balance: newBalance,
      };
    }

    if (!amount) {
      return selectedAccount;
    }
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) return selectedAccount;

    let newBalance = selectedAccount.balance;
    if (debt.type === DebtType.LENT) {
      newBalance = addMoney(selectedAccount.balance, amount);
    } else {
      if (compareMoney(amount, selectedAccount.balance) > 0) {
        return selectedAccount;
      }
      newBalance = subtractMoney(selectedAccount.balance, amount);
    }

    return {
      ...selectedAccount,
      balance: newBalance,
    };
  }, [selectedAccount, amount, toAmount, currenciesMatch, debt.type]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({
        amount: debt.remainingAmount,
        toAmount: "",
        accountId: debt.accountId || "",
        useAccount: true,
      });
    }
    prevOpenRef.current = open;
  }, [open, reset, debt.remainingAmount, debt.accountId]);

  const onSubmit = async (data: CloseDebtInput) => {
    if (!currenciesMatch && !data.toAmount) {
      toast.error("Укажите сумму получения");
      return;
    }

    const submitData: CloseDebtInput = {
      ...data,
      useAccount: true,
    };
    const result = await closeDebt(debt.id, submitData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг закрыт");
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, [
        "debts",
        "transactions",
        "accounts",
        "capital",
      ]);
    }
  };

  const handleAccountSelect = (account: Account) => {
    setValue("accountId", account.id, { shouldValidate: true });
    if (account.currency === debt.currency) {
      setValue("toAmount", "");
    }
  };

  const handleCloseAll = () => {
    setValue("amount", debt.remainingAmount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Закрыть долг</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="text-sm text-muted-foreground">
                {debt.type === DebtType.LENT ? "Должник" : "Кредитор"}
              </div>
              <div className="font-medium">{debt.personName}</div>
              <div className="text-sm text-muted-foreground">
                Остаток: {formatMoney(debt.remainingAmount, debt.currency)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">
                {debt.type === DebtType.LENT ? "Счёт для зачисления" : "Счёт для списания"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              {selectedAccount && accountId ? (
                <AccountCard
                  account={previewAccount || selectedAccount}
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

            {!currenciesMatch && selectedAccount ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="toAmount">
                    Сумма отправления ({selectedAccount.currency}) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                      {getCurrencySymbol(selectedAccount.currency)}
                    </span>
                    <NumberInput
                      id="toAmount"
                      placeholder="0.00"
                      className="pl-9"
                      {...register("toAmount", {
                        required: !currenciesMatch ? "Сумма отправления обязательна" : false,
                      })}
                    />
                  </div>
                  {errors.toAmount && <p className="text-sm text-destructive">{errors.toAmount.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Сумма получения ({debt.currency}) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                      {getCurrencySymbol(debt.currency)}
                    </span>
                    <NumberInput id="amount" placeholder="0.00" className="pl-9 pr-16" {...register("amount")} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                      onClick={handleCloseAll}
                    >
                      Всё
                    </Button>
                  </div>
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Сумма к закрытию ({debt.currency}) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                    {getCurrencySymbol(debt.currency)}
                  </span>
                  <NumberInput id="amount" placeholder="0.00" className="pl-9 pr-16" {...register("amount")} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                    onClick={handleCloseAll}
                  >
                    Всё
                  </Button>
                </div>
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>
            )}
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Закрытие..." : "Закрыть долг"}
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
