"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { closeDebtSchema, type CloseDebtInput } from "@/shared/lib/validations/debt";
import { closeDebt } from "../actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Debt, Account } from "@prisma/client";

interface DebtWithAccount extends Debt {
  account: Pick<Account, "id" | "name" | "currency">;
}

interface CloseDebtDialogProps {
  debt: DebtWithAccount;
  workspaceId: string;
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
  }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloseDebtDialog({
  debt,
  workspaceId,
  accounts,
  open,
  onOpenChange,
}: CloseDebtDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<CloseDebtInput>({
    resolver: zodResolver(closeDebtSchema),
    defaultValues: {
      paidAmount: "",
      useAccount: false,
      accountId: "",
    },
  });

  const useAccount = watch("useAccount");
  const accountId = watch("accountId");

  const onSubmit = async (data: CloseDebtInput) => {
    const result = await closeDebt(debt.id, workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг успешно закрыт");
      reset();
      onOpenChange(false);
      router.refresh();
    }
  };

  const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    RUB: "₽",
    BYN: "Br",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
  };

  const currencySymbol = currencySymbols[debt.account.currency] || debt.account.currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Закрыть долг</DialogTitle>
          <DialogDescription>
            {debt.type === "lent"
              ? `Сколько денег вернул ${debt.debtorName}?`
              : `Сколько денег вы вернули ${debt.debtorName}?`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paidAmount">
              Сумма возврата <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="paidAmount"
                type="number"
                step="0.01"
                {...register("paidAmount")}
                placeholder={`0.00 ${currencySymbol}`}
                aria-invalid={errors.paidAmount ? "true" : "false"}
              />
            </div>
            {errors.paidAmount && (
              <p className="text-sm text-destructive">
                {errors.paidAmount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Остаток долга: {parseFloat(debt.amount).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} {currencySymbol}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useAccount"
                checked={useAccount}
                onCheckedChange={(checked) => {
                  setValue("useAccount", checked === true);
                  if (!checked) {
                    setValue("accountId", "");
                  }
                }}
              />
              <Label
                htmlFor="useAccount"
                className="text-sm font-normal cursor-pointer"
              >
                Использовать счёт
              </Label>
            </div>

            {useAccount && (
              <>
                <Label htmlFor="closeAccountId">
                  {debt.type === "lent" ? "На какой счёт" : "С какого счёта"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={accountId}
                  onValueChange={(value) => setValue("accountId", value)}
                >
                  <SelectTrigger id="closeAccountId" className="w-full">
                    <SelectValue placeholder="Выберите счёт" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <CreditCard className="size-4" />
                          <span>{account.name}</span>
                          <span className="text-muted-foreground">
                            ({account.currency})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.accountId && (
                  <p className="text-sm text-destructive">
                    {errors.accountId.message}
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Закрытие..." : "Закрыть долг"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

