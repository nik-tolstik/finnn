"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/SelectAccountDialog";
import { AccountCard } from "@/shared/components/AccountCard";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY, type Currency } from "@/shared/constants/currency";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys } from "@/shared/lib/query-keys";
import { createDebtSchema, type CreateDebtInput } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogWindow, DialogFooter, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select";
import { addMoney, subtractMoney, getCurrencySymbol } from "@/shared/utils/money";

import { DebtType } from "../debt.constants";
import { createDebt } from "../debt.service";

interface CreateDebtDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CreateDebtDialog({ workspaceId, open, onOpenChange, onCloseComplete }: CreateDebtDialogProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const selectAccountDialog = useDialogState();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);

  const defaultAccount = useMemo(() => {
    if (!accounts || !session?.user?.id) return undefined;
    const userAccounts = accounts.filter((acc) => acc.ownerId === session.user.id);
    return userAccounts[0];
  }, [accounts, session]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CreateDebtInput>({
    resolver: zodResolver(createDebtSchema),
    defaultValues: {
      type: DebtType.LENT,
      personName: "",
      amount: "",
      date: new Date(),
      useAccount: true,
      accountId: "",
      currency: DEFAULT_CURRENCY,
    },
  });

  const debtType = useWatch({ control, name: "type" });
  const useAccount = useWatch({ control, name: "useAccount" });
  const accountId = useWatch({ control, name: "accountId" });
  const currency = useWatch({ control, name: "currency" });
  const amount = useWatch({ control, name: "amount" });

  const selectedAccount = useMemo(() => {
    if (!accountId || !accounts.length) return undefined;
    return accounts.find((acc) => acc.id === accountId);
  }, [accountId, accounts]);

  const previewAccount = useMemo(() => {
    if (!selectedAccount || !useAccount || !amount) {
      return selectedAccount;
    }
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) return selectedAccount;

    let newBalance = selectedAccount.balance;
    if (debtType === DebtType.LENT) {
      newBalance = subtractMoney(selectedAccount.balance, amount);
    } else {
      newBalance = addMoney(selectedAccount.balance, amount);
    }

    return {
      ...selectedAccount,
      balance: newBalance,
    };
  }, [selectedAccount, useAccount, amount, debtType]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({
        type: DebtType.LENT,
        personName: "",
        amount: "",
        date: new Date(),
        useAccount: true,
        accountId: "",
        currency: DEFAULT_CURRENCY,
      });
    }
    prevOpenRef.current = open;
  }, [open, reset]);

  useEffect(() => {
    if (open && defaultAccount && (!accountId || accountId === "")) {
      setValue("accountId", defaultAccount.id, { shouldValidate: false });
    }
  }, [open, defaultAccount, accountId, setValue]);

  const onSubmit = async (data: CreateDebtInput) => {
    const result = await createDebt(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг создан");
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
    setValue("accountId", account.id, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Создать долг</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Тип долга</Label>
              <Segmented
                options={[
                  {
                    value: DebtType.LENT,
                    label: "Кредит",
                    icon: <ArrowDownLeft className="h-4 w-4" />,
                    selectedClassName: "text-success-primary",
                  },
                  {
                    value: DebtType.BORROWED,
                    label: "Дебет",
                    icon: <ArrowUpRight className="h-4 w-4" />,
                    selectedClassName: "text-error-primary",
                  },
                ]}
                value={debtType}
                onChange={(value) => setValue("type", value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personName">
                {debtType === DebtType.LENT ? "Кто должен" : "Кому должен"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="personName"
                placeholder={debtType === DebtType.LENT ? "Имя должника" : "Имя кредитора"}
                {...register("personName")}
              />
              {errors.personName && <p className="text-sm text-destructive">{errors.personName.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                control={control}
                name="useAccount"
                render={({ field }) => (
                  <Checkbox id="useAccount" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="useAccount" className="cursor-pointer">
                Использовать счёт
              </Label>
            </div>

            {useAccount ? (
              <div className="space-y-2">
                <Label>
                  {debtType === DebtType.LENT ? "С какого счёта" : "На какой счёт"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
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
            ) : (
              <div className="space-y-2">
                <Label>
                  Валюта <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select
                      options={CURRENCY_OPTIONS}
                      value={(field.value || DEFAULT_CURRENCY) as Currency}
                      onChange={(value) => field.onChange(value)}
                      multiple={false}
                    />
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">
                Сумма <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(
                    useAccount ? selectedAccount?.currency || DEFAULT_CURRENCY : currency || DEFAULT_CURRENCY
                  )}
                </span>
                <NumberInput id="amount" placeholder="0.00" className="pl-9" {...register("amount")} />
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
            {isSubmitting ? "Создание..." : "Создать"}
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
