"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import {
  updateTransferSchema,
  type UpdateTransferInput,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { SelectOption } from "@/shared/ui/select/types";
import { Textarea } from "@/shared/ui/textarea";
import { getCurrencySymbol } from "@/shared/utils/money";

import { updateTransfer } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

interface EditTransferDialogProps {
  transaction: TransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransferDialog({
  transaction,
  workspaceId,
  open,
  onOpenChange,
}: EditTransferDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<UpdateTransferInput>({
    resolver: zodResolver(updateTransferSchema),
    defaultValues: {
      fromAccountId: transaction.account.id,
      toAccountId: transaction.transferFrom?.toTransaction.account.id || "",
      amount: transaction.amount,
      toAmount: transaction.transferFrom?.toAmount || "",
      description: transaction.description || "",
      date: new Date(transaction.date),
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
  });

  const accounts = useMemo(() => {
    return accountsData?.data || [];
  }, [accountsData?.data]);

  const fromAccountId = useWatch({ control, name: "fromAccountId" });
  const toAccountId = useWatch({ control, name: "toAccountId" });
  const amount = useWatch({ control, name: "amount" });
  const toAmount = useWatch({ control, name: "toAmount" });

  const fromAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === fromAccountId);
  }, [accounts, fromAccountId]);

  const toAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === toAccountId);
  }, [accounts, toAccountId]);

  useEffect(() => {
    if (open && transaction.transferFrom) {
      reset({
        fromAccountId: transaction.account.id,
        toAccountId: transaction.transferFrom.toTransaction.account.id,
        amount: transaction.amount,
        toAmount: transaction.transferFrom.toAmount,
        description: transaction.description || "",
        date: new Date(transaction.date),
      });
    }
  }, [open, reset, transaction]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: UpdateTransferInput) => {
    const result = await updateTransfer(transaction.id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Перевод успешно обновлён");
      reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Редактировать перевод</DialogTitle>
          <DialogDescription>Измените параметры перевода</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromAccountId">
                  Счёт отправителя <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="fromAccountId"
                  render={({ field }) => {
                    const accountOptions: SelectOption[] = accounts
                      .filter((acc) => acc.id !== toAccountId)
                      .map((account) => ({
                        value: account.id,
                        label: `${account.name} (${account.currency})`,
                      }));
                    return (
                      <Select
                        options={accountOptions}
                        value={field.value || undefined}
                        onChange={(value) => {
                          field.onChange(value);
                          if (value === toAccountId) {
                            setValue("toAccountId", "");
                          }
                        }}
                        placeholder="Выберите счёт"
                        multiple={false}
                      />
                    );
                  }}
                />
                {errors.fromAccountId && (
                  <p className="text-sm text-destructive">
                    {errors.fromAccountId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  Сумма отправления {fromAccount && `(${fromAccount.currency})`}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
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
                    className={fromAccount ? "pl-9" : ""}
                    {...register("amount", {
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
                    aria-invalid={errors.amount ? "true" : "false"}
                  />
                </div>
                {errors.amount && (
                  <p className="text-sm text-destructive">
                    {errors.amount.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                const currentFrom = fromAccountId;
                const currentTo = toAccountId;
                const currentAmount = amount;
                const currentToAmount = toAmount;
                setValue("fromAccountId", currentTo || "");
                setValue("toAccountId", currentFrom || "");
                setValue("amount", currentToAmount || "");
                setValue("toAmount", currentAmount || "");
              }}
              disabled={!fromAccountId || !toAccountId || !amount || !toAmount}
              title="Поменять местами"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </Button>

            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="toAccountId">
                  Счёт получателя <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="toAccountId"
                  render={({ field }) => {
                    const accountOptions: SelectOption[] = accounts
                      .filter((acc) => acc.id !== fromAccountId)
                      .map((account) => ({
                        value: account.id,
                        label: `${account.name} (${account.currency})`,
                      }));
                    return (
                      <Select
                        options={accountOptions}
                        value={field.value || undefined}
                        onChange={(value) => {
                          field.onChange(value);
                          if (value === fromAccountId) {
                            setValue("fromAccountId", "");
                          }
                        }}
                        placeholder="Выберите счёт"
                        multiple={false}
                      />
                    );
                  }}
                />
                {errors.toAccountId && (
                  <p className="text-sm text-destructive">
                    {errors.toAccountId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="toAmount">
                  Сумма получения {toAccount && `(${toAccount.currency})`}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
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
                    className={toAccount ? "pl-9" : ""}
                    {...register("toAmount", {
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
                    aria-invalid={errors.toAmount ? "true" : "false"}
                  />
                </div>
                {errors.toAmount && (
                  <p className="text-sm text-destructive">
                    {errors.toAmount.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Описание перевода"
              rows={3}
              {...register("description")}
              aria-invalid={errors.description ? "true" : "false"}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Дата</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePicker date={field.value} onSelect={field.onChange} />
              )}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
