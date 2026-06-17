"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { CURRENCY_OPTIONS, type Currency, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { useSession } from "@/shared/lib/api-session-client";
import { addAccountBalanceDelta, getDebtInitialAccountBalanceDelta } from "@/shared/lib/balance-domain";
import {
  insertDebtsInCache,
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys } from "@/shared/lib/query-keys";
import { type CreateDebtInput, createDebtSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select";
import { getCurrencySymbol } from "@/shared/utils/money";

import { createDebt } from "../../debt.api";
import { DebtType } from "../../debt.constants";
import {
  getCreateDebtDefaultValues,
  getCreateDebtPreviewAccount,
  getDefaultDebtAccount,
} from "./create-debt-dialog.utils";

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
    return getDefaultDebtAccount(accounts, session?.user?.id);
  }, [accounts, session?.user?.id]);

  const form = useForm<CreateDebtInput>({
    resolver: zodResolver(createDebtSchema),
    defaultValues: getCreateDebtDefaultValues(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = form;

  const debtType = useWatch({ control, name: "type" });
  const useAccount = useWatch({ control, name: "useAccount" });
  const accountId = useWatch({ control, name: "accountId" });
  const currency = useWatch({ control, name: "currency" });
  const amount = useWatch({ control, name: "amount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const date = useWatch({ control, name: "date" });

  const selectedAccount = useMemo(() => {
    if (!accountId || !accounts.length) return undefined;
    return accounts.find((acc) => acc.id === accountId);
  }, [accountId, accounts]);

  const debtCurrency = (currency || DEFAULT_CURRENCY) as Currency;
  const currenciesMatch = !selectedAccount || selectedAccount.currency === debtCurrency;
  const accountAmount = currenciesMatch ? amount : toAmount;

  const { handleAmountChange, handleToAmountChange } = useCurrencyAmountSync({
    form,
    fromCurrency: debtCurrency,
    toCurrency: useAccount ? selectedAccount?.currency : undefined,
    date,
  });

  const previewAccount = useMemo(() => {
    return getCreateDebtPreviewAccount({ selectedAccount, useAccount, amount, accountAmount, debtType });
  }, [selectedAccount, useAccount, amount, accountAmount, debtType]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(getCreateDebtDefaultValues());
    }
    prevOpenRef.current = open;
  }, [open, reset]);

  useEffect(() => {
    if (open && defaultAccount && (!accountId || accountId === "")) {
      setValue("accountId", defaultAccount.id, { shouldValidate: false });
    }
  }, [open, defaultAccount, accountId, setValue]);

  const onSubmit = async (data: CreateDebtInput) => {
    const selectedAccountIsCrossCurrency =
      data.useAccount && selectedAccount && selectedAccount.currency !== data.currency;

    if (selectedAccountIsCrossCurrency && !data.toAmount) {
      toast.error("Укажите сумму в валюте счёта");
      return;
    }

    const balanceDeltas = new Map<string, string>();
    if (data.useAccount && data.accountId) {
      const accountSideAmount = selectedAccountIsCrossCurrency ? data.toAmount : data.amount;
      addAccountBalanceDelta(
        balanceDeltas,
        data.accountId,
        getDebtInitialAccountBalanceDelta(data.type, accountSideAmount || data.amount)
      );
    }

    const optimisticDebt = {
      id: `optimistic-debt-${Date.now()}`,
      workspaceId,
      type: data.type,
      personName: data.personName,
      amount: data.amount,
      remainingAmount: data.amount,
      currency: data.currency,
      status: "open",
      date: data.date,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          insertDebtsInCache(context, [optimisticDebt]);
        },
        mutation: () => createDebt(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Долг создан");
      onOpenChange(false);
    } catch {
      toast.error("Не удалось создать долг");
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
                    label: "Дать в долг",
                    icon: <ArrowDownLeft className="h-4 w-4" />,
                    selectedClassName: "text-success",
                  },
                  {
                    value: DebtType.BORROWED,
                    label: "Взять в долг",
                    icon: <ArrowUpRight className="h-4 w-4" />,
                    selectedClassName: "text-destructive",
                  },
                ]}
                value={debtType}
                onChange={(value) => setValue("type", value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personName" required>
                {debtType === DebtType.LENT ? "Кто должен" : "Кому должен"}
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

            <div className="space-y-2">
              <Label required>Валюта долга</Label>
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
              {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
            </div>

            {useAccount ? (
              <div className="space-y-2">
                <Label required>{debtType === DebtType.LENT ? "С какого счёта" : "На какой счёт"} </Label>
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
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="amount" required>
                Сумма долга
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                  {getCurrencySymbol(debtCurrency)}
                </span>
                <NumberInput
                  id="amount"
                  placeholder="0.00"
                  className="pl-9"
                  {...register("amount", {
                    onChange: (event) => handleAmountChange(event.target.value),
                  })}
                />
              </div>
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

            {useAccount && selectedAccount && !currenciesMatch ? (
              <div className="space-y-2">
                <Label htmlFor="toAmount" required>
                  {debtType === DebtType.LENT ? "Сумма списания" : "Сумма зачисления"} ({selectedAccount.currency})
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
                      onChange: (event) => handleToAmountChange(event.target.value),
                    })}
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
