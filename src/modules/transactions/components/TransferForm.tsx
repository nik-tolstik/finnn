"use client";

import type { Account, Currency } from "@prisma/client";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";

import { useTransferAmountSync } from "@/modules/transactions/hooks/useTransferAmountSync";
import { AccountSelector } from "@/shared/components/AccountSelector";
import type { CreateTransferInput, UpdateTransferInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { addMoney, compareMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

type TransferFormData = CreateTransferInput | UpdateTransferInput;

interface TransferFormProps {
  workspaceId: string;
  form: UseFormReturn<TransferFormData>;
  accounts: Account[];
  onSubmit: (data: TransferFormData) => Promise<void>;
  originalAmount?: string;
}

export function TransferForm({ workspaceId, form, accounts, onSubmit, originalAmount }: TransferFormProps) {
  const fromAccountId = useWatch({
    control: form.control,
    name: "fromAccountId",
  });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const toAmount = useWatch({ control: form.control, name: "toAmount" });
  const date = useWatch({ control: form.control, name: "date" });

  const fromAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === fromAccountId);
  }, [accounts, fromAccountId]);

  const toAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === toAccountId);
  }, [accounts, toAccountId]);

  const { handleAmountChange, handleToAmountChange, resetSync } = useTransferAmountSync({
    form,
    fromCurrency: fromAccount?.currency as Currency | undefined,
    toCurrency: toAccount?.currency as Currency | undefined,
    date: date || new Date(),
  });

  const fromAccountBalanceBeforeTransfer = useMemo(() => {
    if (!fromAccount || !originalAmount) return null;
    return addMoney(fromAccount.balance, originalAmount);
  }, [fromAccount, originalAmount]);

  const previewFromAccount = useMemo(() => {
    if (!fromAccount || !amount) return fromAccount;
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) return fromAccount;

    const balanceToUse = fromAccountBalanceBeforeTransfer || fromAccount.balance;
    const newBalance = subtractMoney(balanceToUse, amount);

    return {
      ...fromAccount,
      balance: newBalance,
    };
  }, [fromAccount, amount, fromAccountBalanceBeforeTransfer]);

  const previewToAccount = useMemo(() => {
    if (!toAccount || !toAmount) return toAccount;
    const toAmountNum = parseFloat(toAmount);
    if (Number.isNaN(toAmountNum)) return toAccount;

    const newBalance = addMoney(toAccount.balance, toAmount);

    return {
      ...toAccount,
      balance: newBalance,
    };
  }, [toAccount, toAmount]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 min-w-0 overflow-x-hidden">
      <div className="space-y-2 min-w-0">
        <Label htmlFor="fromAccountId" className="wrap-break-word">
          Счёт отправителя <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={form.control}
          name="fromAccountId"
          render={({ field }) => (
            <AccountSelector
              workspaceId={workspaceId}
              account={previewFromAccount || fromAccount || null}
              onSelect={(account) => {
                field.onChange(account.id);
                if (account.id === toAccountId) {
                  form.setValue("toAccountId", "");
                }
                resetSync();
              }}
              excludeAccountIds={toAccountId ? [toAccountId] : []}
              label=""
              required
              error={form.formState.errors.fromAccountId?.message}
            />
          )}
        />
      </div>

      <div className="space-y-2 min-w-0">
        <Label htmlFor="amount" className="wrap-break-word">
          Сумма отправления <span className="text-destructive">*</span>
        </Label>
        <div className="relative min-w-0">
          {fromAccount && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
              {getCurrencySymbol(fromAccount.currency)}
            </span>
          )}
          <NumberInput
            id="amount"
            placeholder="0.00"
            className={cn(fromAccount ? "pl-9 pr-12" : "pr-12", "min-w-0 w-full")}
            {...form.register("amount", {
              onChange: (e) => {
                const value = e.target.value;
                if (value && parseFloat(value) < 0) {
                  e.target.value = "";
                }
                if (fromAccount && value) {
                  const amountValue = parseFloat(value);
                  const balanceToCheck = fromAccountBalanceBeforeTransfer || fromAccount.balance;
                  if (!Number.isNaN(amountValue) && compareMoney(amountValue, balanceToCheck) > 0) {
                    form.setError("amount", {
                      type: "manual",
                      message: `Сумма не может превышать баланс счёта (${balanceToCheck})`,
                    });
                  } else {
                    form.clearErrors("amount");
                  }
                }
                handleAmountChange(value);
              },
              validate: (value) => {
                if (!fromAccount || !value) return true;
                const amountValue = parseFloat(value);
                if (Number.isNaN(amountValue)) return true;
                const balanceToCheck = fromAccountBalanceBeforeTransfer || fromAccount.balance;
                if (compareMoney(amountValue, balanceToCheck) > 0) {
                  return `Сумма не может превышать баланс счёта (${balanceToCheck})`;
                }
                return true;
              },
            })}
            aria-invalid={form.formState.errors.amount ? "true" : "false"}
          />
          {fromAccount && parseFloat(fromAccountBalanceBeforeTransfer || fromAccount.balance) > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs shrink-0"
              onClick={() => {
                const maxAmount = fromAccountBalanceBeforeTransfer || fromAccount.balance;
                form.setValue("amount", maxAmount, { shouldValidate: true, shouldTouch: true });
              }}
            >
              Max
            </Button>
          )}
        </div>
        {form.formState.errors.amount && (
          <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
        )}
      </div>

      <div className="bg-accent rounded-lg p-2 w-fit mx-auto">
        <ArrowDown className="size-4" />
      </div>

      <div className="space-y-2 min-w-0">
        <Label htmlFor="toAccountId" className="wrap-break-word">
          Счёт получателя <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={form.control}
          name="toAccountId"
          render={({ field }) => (
            <AccountSelector
              workspaceId={workspaceId}
              account={previewToAccount || toAccount || null}
              onSelect={(account) => {
                field.onChange(account.id);
                if (account.id === fromAccountId) {
                  form.setValue("fromAccountId", "");
                }
                resetSync();
              }}
              excludeAccountIds={fromAccountId ? [fromAccountId] : []}
              label=""
              required
              error={form.formState.errors.toAccountId?.message}
            />
          )}
        />
      </div>

      <div className="space-y-2 min-w-0">
        <Label htmlFor="toAmount" className="wrap-break-word">
          Сумма получения {toAccount && `(${toAccount.currency})`} <span className="text-destructive">*</span>
        </Label>
        <div className="relative min-w-0">
          {toAccount && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              {getCurrencySymbol(toAccount.currency)}
            </span>
          )}
          <NumberInput
            id="toAmount"
            placeholder="0.00"
            className={cn(toAccount ? "pl-9" : "", "min-w-0 w-full")}
            {...form.register("toAmount", {
              onChange: (e) => {
                const value = e.target.value;
                if (value && parseFloat(value) < 0) {
                  e.target.value = "";
                }
                handleToAmountChange(value);
              },
            })}
            aria-invalid={form.formState.errors.toAmount ? "true" : "false"}
          />
        </div>
        {form.formState.errors.toAmount && (
          <p className="text-sm text-destructive">{form.formState.errors.toAmount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          placeholder="Описание перевода"
          rows={3}
          {...form.register("description")}
          aria-invalid={form.formState.errors.description ? "true" : "false"}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Дата и время</Label>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => <DateTimePicker date={field.value} onSelect={field.onChange} />}
        />
        {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
      </div>
    </form>
  );
}
