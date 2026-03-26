"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { updateDebtSchema, type UpdateDebtInput } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogWindow, DialogFooter, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { DebtType } from "../debt.constants";
import { getDebtEditData, updateDebt } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";

interface EditDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function EditDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: EditDebtDialogProps) {
  const queryClient = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open && !!debt.accountId,
    staleTime: 5000,
  });

  const fullAccount = debt.accountId ? accountsData?.data?.find((acc) => acc.id === debt.accountId) : undefined;

  const { data: editData, isLoading: isLoadingAmount, isError: isEditDataError, error: editDataError } = useQuery({
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<UpdateDebtInput>({
    resolver: zodResolver(updateDebtSchema),
    defaultValues: {
      personName: debt.personName,
      amount: "",
      date: new Date(debt.date),
    },
  });

  useEffect(() => {
    if (open && debt?.id) {
      reset({
        personName: debt.personName,
        amount: editData?.initialAmount ?? "",
        date: editData?.initialDate ? new Date(editData.initialDate) : new Date(debt.date),
      });
    }
  }, [open, debt?.id, debt.personName, debt.date, editData, reset]);

  const onSubmit = async (data: UpdateDebtInput) => {
    const result = await updateDebt(debt.id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг обновлён");
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, [
        "debts",
        "transactions",
        "accounts",
        "capital",
      ]);
    }
  };

  const currency = editData?.currency ?? debt.currency;
  const amount = useWatch({ control, name: "amount" });
  const initialAmount = editData?.initialAmount ?? "";

  const previewAccount = useMemo(() => {
    if (!fullAccount || !debt.accountId) return fullAccount;
    if (!amount || !initialAmount) return fullAccount;
    const amountNum = parseFloat(amount);
    const initialNum = parseFloat(initialAmount);
    if (Number.isNaN(amountNum) || Number.isNaN(initialNum)) return fullAccount;
    const delta = subtractMoney(amount, initialAmount);
    if (delta === "0") return fullAccount;
    const newBalance =
      debt.type === DebtType.LENT
        ? subtractMoney(fullAccount.balance, delta)
        : addMoney(fullAccount.balance, delta);
    return { ...fullAccount, balance: newBalance };
  }, [fullAccount, debt.accountId, debt.type, amount, initialAmount]);

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
            {debt.account && (
              <div className="space-y-2">
                <Label>Счёт</Label>
                {previewAccount ? (
                  <AccountCard account={previewAccount} showOwner={false} />
                ) : (
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    {debt.account.name}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="personName">
                {debt.type === DebtType.LENT ? "Кто должен" : "Кому должен"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="personName"
                placeholder={debt.type === DebtType.LENT ? "Имя должника" : "Имя кредитора"}
                {...register("personName")}
              />
              {errors.personName && <p className="text-sm text-destructive">{errors.personName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Изначальная сумма <span className="text-destructive">*</span>
                {isLoadingAmount && <span className="text-muted-foreground text-sm font-normal ml-1">(загрузка…)</span>}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(currency)}
                </span>
                <NumberInput id="amount" placeholder="0.00" className="pl-9" {...register("amount")} disabled={isLoadingAmount && !isEditDataError} />
              </div>
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

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
