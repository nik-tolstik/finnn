"use client";

import type { Account } from "@prisma/client";
import { ArrowDown } from "lucide-react";
import { useMemo } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";

import { AccountSelector } from "@/shared/components/AccountSelector";
import type { CreateTransferInput, UpdateTransferInput } from "@/shared/lib/validations/transaction";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { getCurrencySymbol } from "@/shared/utils/money";

type TransferFormData = CreateTransferInput | UpdateTransferInput;

interface TransferFormProps {
  workspaceId: string;
  form: UseFormReturn<TransferFormData>;
  accounts: Account[];
  onSubmit: (data: TransferFormData) => Promise<void>;
}

export function TransferForm({ workspaceId, form, accounts, onSubmit }: TransferFormProps) {
  const fromAccountId = useWatch({
    control: form.control,
    name: "fromAccountId",
  });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });

  const fromAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === fromAccountId);
  }, [accounts, fromAccountId]);

  const toAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === toAccountId);
  }, [accounts, toAccountId]);

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
              account={fromAccount || null}
              onSelect={(account) => {
                field.onChange(account.id);
                if (account.id === toAccountId) {
                  form.setValue("toAccountId", "");
                }
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              {getCurrencySymbol(fromAccount.currency)}
            </span>
          )}
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className={cn(fromAccount ? "pl-9" : "", "min-w-0 w-full")}
            {...form.register("amount", {
              onChange: (e) => {
                const value = e.target.value;
                if (value && parseFloat(value) < 0) {
                  e.target.value = "";
                }
              },
            })}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "e" || e.key === "E") {
                e.preventDefault();
              }
            }}
            aria-invalid={form.formState.errors.amount ? "true" : "false"}
          />
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
              account={toAccount || null}
              onSelect={(account) => {
                field.onChange(account.id);
                if (account.id === fromAccountId) {
                  form.setValue("fromAccountId", "");
                }
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
          <Input
            id="toAmount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className={cn(toAccount ? "pl-9" : "", "min-w-0 w-full")}
            {...form.register("toAmount", {
              onChange: (e) => {
                const value = e.target.value;
                if (value && parseFloat(value) < 0) {
                  e.target.value = "";
                }
              },
            })}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "e" || e.key === "E") {
                e.preventDefault();
              }
            }}
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
