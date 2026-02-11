"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { addToDebtSchema, type AddToDebtInput } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogWindow, DialogFooter, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { NumberInput } from "@/shared/ui/number-input";
import { Label } from "@/shared/ui/label";
import { addMoney, subtractMoney, formatMoney, getCurrencySymbol } from "@/shared/utils/money";

import { DebtType } from "../debt.constants";
import { addToDebt } from "../debt.service";
import type { DebtWithRelations } from "../debt.types";

interface AddToDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function AddToDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: AddToDebtDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: open && !!debt.accountId,
    staleTime: 5000,
  });

  const fullAccount = debt.accountId
    ? accountsData?.data?.find((acc) => acc.id === debt.accountId)
    : undefined;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<AddToDebtInput>({
    resolver: zodResolver(addToDebtSchema),
    defaultValues: {
      amount: "",
      useAccount: !!debt.accountId,
    },
  });

  const amount = useWatch({ control, name: "amount" });

  const previewAccount = useMemo(() => {
    if (!fullAccount || !amount) {
      return fullAccount;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) return fullAccount;

    let newBalance = fullAccount.balance;
    if (debt.type === DebtType.LENT) {
      if (parseFloat(fullAccount.balance) < parseFloat(amount)) {
        return fullAccount;
      }
      newBalance = subtractMoney(fullAccount.balance, amount);
    } else {
      newBalance = addMoney(fullAccount.balance, amount);
    }

    return {
      ...fullAccount,
      balance: newBalance,
    };
  }, [fullAccount, amount, debt.type]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({
        amount: "",
        useAccount: !!debt.accountId,
      });
    }
    prevOpenRef.current = open;
  }, [open, reset, debt.accountId]);

  const onSubmit = async (data: AddToDebtInput) => {
    const submitData: AddToDebtInput = {
      ...data,
      useAccount: !!debt.accountId,
    };
    const result = await addToDebt(debt.id, submitData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Сумма добавлена к долгу");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["debts", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["accounts", workspaceId] }),
      ]);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{debt.type === DebtType.LENT ? "Дать ещё в долг" : "Взять ещё в долг"}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form className="space-y-4">
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
              <Label htmlFor="addAmount">
                Дополнительная сумма <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(debt.currency)}
                </span>
                <NumberInput
                  id="addAmount"
                  placeholder="0.00"
                  className="pl-9"
                  {...register("amount")}
                />
              </div>
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            {debt.accountId && previewAccount && (
              <div className="space-y-2">
                <Label>
                  {debt.type === DebtType.LENT ? "Списать со счёта" : "Зачислить на счёт"}
                </Label>
                <AccountCard account={previewAccount} showOwner={false} />
              </div>
            )}
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
    </Dialog>
  );
}
