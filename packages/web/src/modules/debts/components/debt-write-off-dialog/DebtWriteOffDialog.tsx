"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { getCategories } from "@/modules/categories/category.api";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  insertTransactionsInCache,
  runOptimisticWorkspaceMutation,
  updateDebtsInCache,
  updateTransactionsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { type DebtWriteOffInput, debtWriteOffSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Textarea } from "@/shared/ui/textarea";
import { compareMoney, formatMoney, getCurrencySymbol } from "@/shared/utils/money";

import { createDebtWriteOff, updateDebtWriteOff } from "../../debt.api";
import type { DebtWriteOffPaymentTransaction } from "../../debt.types";
import {
  type DebtWriteOffDebt,
  getDebtWriteOffCategoryOptions,
  getDebtWriteOffDebt,
  getDebtWriteOffDefaultValues,
  getDebtWriteOffMaximumAmount,
  getDebtWriteOffRemainingAmount,
  getDebtWriteOffStatus,
  getDebtWriteOffType,
  isDateBeforeAccountCreation,
  isDebtWriteOffAmountWithinLimit,
} from "./debt-write-off-dialog.utils";

interface DebtWriteOffDialogBaseProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  onSuccess?: () => void;
}

export type DebtWriteOffDialogProps = DebtWriteOffDialogBaseProps &
  ({ debt: DebtWriteOffDebt; transaction?: never } | { debt?: never; transaction: DebtWriteOffPaymentTransaction });

function toOptimisticAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    color: account.color,
    icon: account.icon,
    ownerId: account.ownerId,
    owner: account.owner ?? null,
  };
}

export function DebtWriteOffDialog({
  debt,
  transaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  onSuccess,
}: DebtWriteOffDialogProps) {
  const queryClient = useQueryClient();
  const categoryDialog = useDialogState();
  const debtDetails = useMemo(() => getDebtWriteOffDebt({ debt, transaction }), [debt, transaction]);
  const isEditing = Boolean(transaction);

  const form = useForm<DebtWriteOffInput>({
    resolver: zodResolver(debtWriteOffSchema),
    defaultValues: getDebtWriteOffDefaultValues({ debt: debtDetails, transaction }),
  });
  const {
    clearErrors,
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = form;

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });
  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => accountsData?.data || [], [accountsData?.data]);
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data]);
  const accountId = useWatch({ control, name: "accountId" });
  const amount = useWatch({ control, name: "amount" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const date = useWatch({ control, name: "date" });
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accountId, accounts]);
  const categoryOptions = useMemo<ComboboxOption[]>(
    () => getDebtWriteOffCategoryOptions(categories, debtDetails.type),
    [categories, debtDetails.type]
  );
  const selectedCategory = useMemo(
    () => categoryOptions.find((category) => category.value === categoryId),
    [categoryId, categoryOptions]
  );
  const currenciesMatch = !selectedAccount || selectedAccount.currency === debtDetails.currency;
  const maximumAmount = getDebtWriteOffMaximumAmount(debtDetails, transaction);
  const transactionType = getDebtWriteOffType(debtDetails.type);
  const transactionTypeLabel = transactionType === "expense" ? "Расход" : "Доход";

  const { handleAmountChange, handleToAmountChange, isLoadingRate } = useCurrencyAmountSync({
    form,
    fromCurrency: debtDetails.currency,
    toCurrency: selectedAccount?.currency,
    date: date || new Date(),
    resetKey: `${open}:${transaction?.id || debtDetails.id}`,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(getDebtWriteOffDefaultValues({ debt: debtDetails, transaction }));
  }, [debtDetails, open, reset, transaction]);

  const handleAccountSelect = (account: Account) => {
    setValue("accountId", account.id, { shouldValidate: true });
    clearErrors("accountId");

    if (account.currency === debtDetails.currency) {
      setValue("toAmount", "", { shouldValidate: true });
      return;
    }

    setValue("toAmount", "", { shouldValidate: true });
    handleAmountChange(amount || maximumAmount);
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value, { shouldValidate: true });
  };

  const handleUseMaximum = () => {
    setValue("amount", maximumAmount, { shouldValidate: true, shouldTouch: true });
    clearErrors("amount");
    handleAmountChange(maximumAmount);
  };

  const onSubmit = async (data: DebtWriteOffInput) => {
    if (!selectedAccount) {
      setError("accountId", { type: "manual", message: "Выберите доступный счёт" });
      return;
    }

    if (!isDebtWriteOffAmountWithinLimit(data.amount, maximumAmount)) {
      setError("amount", {
        type: "manual",
        message: `Сумма не может превышать ${formatMoney(maximumAmount, debtDetails.currency)}`,
      });
      return;
    }

    if (!currenciesMatch && !data.toAmount) {
      setError("toAmount", { type: "manual", message: "Сумма транзакции обязательна" });
      return;
    }

    if (!selectedCategory) {
      setError("categoryId", { type: "manual", message: `Выберите категорию типа «${transactionTypeLabel}»` });
      return;
    }

    if (isDateBeforeAccountCreation(data.date, selectedAccount.createdAt)) {
      toast.error(
        `Дата транзакции не может быть раньше даты создания счёта (${format(selectedAccount.createdAt, "dd.MM.yyyy", {
          locale: ru,
        })})`
      );
      return;
    }

    const nextRemainingAmount = getDebtWriteOffRemainingAmount({
      debt: debtDetails,
      transaction,
      amount: data.amount,
    });
    const nextStatus = getDebtWriteOffStatus(nextRemainingAmount);
    const paymentAmount = currenciesMatch ? data.amount : data.toAmount || data.amount;
    const now = new Date();
    const optimisticPayment: DebtWriteOffPaymentTransaction = {
      id: transaction?.id || `optimistic-debt-write-off-${now.getTime()}`,
      workspaceId,
      accountId: selectedAccount.id,
      amount: paymentAmount,
      type: transactionType,
      description: data.description?.trim() || null,
      date: data.date,
      categoryId: selectedCategory.value,
      createdByAi: false,
      createdAt: transaction?.createdAt || now,
      updatedAt: now,
      account: toOptimisticAccount(selectedAccount),
      category: { id: selectedCategory.value, name: selectedCategory.label },
      debtWriteOff: {
        debtTransactionId:
          transaction?.debtWriteOff.debtTransactionId || `optimistic-debt-transaction-${now.getTime()}`,
        debtId: debtDetails.id,
        debtType: debtDetails.type,
        personName: debtDetails.personName,
        debtCurrency: debtDetails.currency,
        amount: data.amount,
        remainingAmount: nextRemainingAmount,
        status: nextStatus,
      },
    };
    const optimisticTransaction: CombinedTransaction = {
      kind: "paymentTransaction",
      data: optimisticPayment,
    };

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions"],
        apply: (context) => {
          updateDebtsInCache(context, [
            {
              id: debtDetails.id,
              remainingAmount: nextRemainingAmount,
              status: nextStatus,
            },
          ]);
          if (transaction) {
            updateTransactionsInCache(context, [optimisticTransaction]);
          } else {
            insertTransactionsInCache(context, [optimisticTransaction]);
          }
        },
        onApplied: () => onOpenChange(false),
        mutation: () =>
          transaction
            ? updateDebtWriteOff(transaction.debtWriteOff.debtTransactionId, data)
            : createDebtWriteOff(debtDetails.id, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onSuccess?.();
    } catch {
      toast.error(isEditing ? "Не удалось обновить погашение долга" : "Не удалось погасить долг транзакцией");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактировать погашение" : "Погасить транзакцией"}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="truncate font-medium">{debtDetails.personName}</div>
              <div className="shrink-0 text-right font-semibold text-foreground text-sm">
                {formatMoney(debtDetails.remainingAmount, debtDetails.currency)}
              </div>
            </div>

            <Controller
              control={control}
              name="accountId"
              render={() => (
                <AccountSelector
                  workspaceId={workspaceId}
                  account={selectedAccount || null}
                  onSelect={handleAccountSelect}
                  label="Счёт"
                  required
                  error={errors.accountId?.message}
                />
              )}
            />
            {accountId && !selectedAccount ? (
              <p className="text-sm text-destructive">Текущий счёт недоступен. Выберите другой счёт.</p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="debt-write-off-category" required>
                Категория ({transactionTypeLabel.toLowerCase()})
              </Label>
              <Button
                id="debt-write-off-category"
                type="button"
                variant="field"
                className="w-full justify-between"
                onClick={() => categoryDialog.openDialog(null)}
              >
                {selectedCategory ? (
                  <span className="truncate">{selectedCategory.label}</span>
                ) : (
                  <span className="text-muted-foreground">Выберите категорию</span>
                )}
              </Button>
              {errors.categoryId ? <p className="text-sm text-destructive">{errors.categoryId.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="debt-write-off-amount" required>
                Сумма погашения ({debtDetails.currency})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {getCurrencySymbol(debtDetails.currency)}
                </span>
                <NumberInput
                  id="debt-write-off-amount"
                  placeholder="0.00"
                  className="pl-9 pr-16"
                  {...register("amount", {
                    onChange: (event) => {
                      const value = event.target.value;
                      handleAmountChange(value);
                      const numericValue = Number.parseFloat(value);
                      if (!Number.isNaN(numericValue) && compareMoney(value, maximumAmount) > 0) {
                        setError("amount", {
                          type: "manual",
                          message: `Сумма не может превышать ${formatMoney(maximumAmount, debtDetails.currency)}`,
                        });
                      } else {
                        clearErrors("amount");
                      }
                    },
                  })}
                  aria-invalid={errors.amount ? "true" : "false"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                  onClick={handleUseMaximum}
                >
                  Всё
                </Button>
              </div>
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>

            {!currenciesMatch && selectedAccount ? (
              <div className="space-y-2">
                <Label htmlFor="debt-write-off-to-amount" required>
                  Сумма транзакции ({selectedAccount.currency})
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {getCurrencySymbol(selectedAccount.currency)}
                  </span>
                  <NumberInput
                    id="debt-write-off-to-amount"
                    placeholder={isLoadingRate ? "Загрузка курса..." : "0.00"}
                    className="pl-9"
                    {...register("toAmount", {
                      onChange: (event) => handleToAmountChange(event.target.value),
                    })}
                    aria-invalid={errors.toAmount ? "true" : "false"}
                  />
                </div>
                {errors.toAmount ? <p className="text-sm text-destructive">{errors.toAmount.message}</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="debt-write-off-description">Описание</Label>
              <Textarea
                id="debt-write-off-description"
                rows={3}
                placeholder="Описание транзакции"
                {...register("description")}
              />
              {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label required>Дата и время</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DateTimePicker
                    date={field.value}
                    onSelect={field.onChange}
                    showRelativeDatePresets
                    disabled={(candidate) =>
                      selectedAccount ? isDateBeforeAccountCreation(candidate, selectedAccount.createdAt) : false
                    }
                  />
                )}
              />
              {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? (isEditing ? "Сохранение..." : "Погашение...") : isEditing ? "Сохранить" : "Погасить"}
          </Button>
        </DialogFooter>
      </DialogWindow>

      {categoryDialog.mounted ? (
        <CategorySelectModal
          open={categoryDialog.open}
          onOpenChange={categoryDialog.closeDialog}
          options={categoryOptions}
          value={categoryId}
          onSelect={handleCategorySelect}
          placeholder="Выберите категорию"
          searchPlaceholder="Поиск категории..."
          emptyText="Категории не найдены"
        />
      ) : null}
    </Dialog>
  );
}
