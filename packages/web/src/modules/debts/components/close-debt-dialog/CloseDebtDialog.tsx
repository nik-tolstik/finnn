"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { getCategories } from "@/modules/categories/category.api";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useCurrencyAmountSync } from "@/shared/hooks/useCurrencyAmountSync";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  addAccountBalanceDelta,
  getDebtTransactionBalanceDelta,
  getPaymentTransactionBalanceDelta,
} from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateDebtsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { type CloseDebtInput, closeDebtSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { compareMoney, formatMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { closeDebt } from "../../debt.api";
import { DebtTransactionType, DebtType } from "../../debt.constants";
import type { DebtWithRelations } from "../../debt.types";
import {
  getCloseDebtCategoryAmount,
  getCloseDebtCategoryOptions,
  getCloseDebtCategoryType,
  getCloseDebtDefaultValues,
  getCloseDebtPreviewAccount,
} from "./close-debt-dialog.utils";

interface CloseDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CloseDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: CloseDebtDialogProps) {
  const queryClient = useQueryClient();
  const categoryModal = useDialogState();

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

  const form = useForm<CloseDebtInput>({
    resolver: zodResolver(closeDebtSchema),
    defaultValues: getCloseDebtDefaultValues(debt),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = form;

  const amount = useWatch({ control, name: "amount" });
  const paymentAmount = useWatch({ control, name: "paymentAmount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const accountId = useWatch({ control, name: "accountId" });
  const categoryId = useWatch({ control, name: "categoryId" });

  const selectedAccount = useMemo(() => {
    if (!accountId || !accounts.length) return undefined;
    return accounts.find((acc) => acc.id === accountId);
  }, [accountId, accounts]);
  const [rateDate, setRateDate] = useState(() => new Date());

  useEffect(() => {
    if (open) {
      setRateDate(new Date());
    }
  }, [open]);

  const currenciesMatch = useMemo(() => {
    if (!selectedAccount) return true;
    return selectedAccount.currency === debt.currency;
  }, [selectedAccount, debt.currency]);

  const { handleAmountChange, handleToAmountChange } = useCurrencyAmountSync({
    form,
    fromCurrency: debt.currency,
    toCurrency: selectedAccount?.currency,
    date: rateDate,
    resetKey: open,
  });

  const previewAccount = useMemo(() => {
    return getCloseDebtPreviewAccount({
      selectedAccount,
      debtType: debt.type,
      debtCurrency: debt.currency,
      closeAmount: amount,
      paymentAmount,
      toAmount,
      remainingAmount: debt.remainingAmount,
      currenciesMatch,
    });
  }, [
    selectedAccount,
    amount,
    paymentAmount,
    toAmount,
    currenciesMatch,
    debt.type,
    debt.currency,
    debt.remainingAmount,
  ]);

  const categoryType = useMemo(() => {
    return getCloseDebtCategoryType({
      debtType: debt.type,
      remainingAmount: debt.remainingAmount,
      paymentAmount,
      currenciesMatch,
    });
  }, [currenciesMatch, debt.remainingAmount, debt.type, paymentAmount]);
  const prevCategoryTypeRef = useRef(categoryType);

  const categoryAmount = useMemo(() => {
    return getCloseDebtCategoryAmount({
      remainingAmount: debt.remainingAmount,
      paymentAmount,
      categoryType,
    });
  }, [categoryType, debt.remainingAmount, paymentAmount]);

  const categoryOptions = useMemo<ComboboxOption[]>(() => {
    return getCloseDebtCategoryOptions(categories, categoryType);
  }, [categories, categoryType]);

  const selectedCategory = useMemo(() => {
    return categoryOptions.find((option) => option.value === categoryId);
  }, [categoryId, categoryOptions]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(getCloseDebtDefaultValues(debt));
    }
    prevOpenRef.current = open;
  }, [open, reset, debt.remainingAmount, debt]);

  useEffect(() => {
    if (!currenciesMatch || !paymentAmount) {
      return;
    }

    const closeAmount = compareMoney(paymentAmount, debt.remainingAmount) > 0 ? debt.remainingAmount : paymentAmount;
    setValue("amount", closeAmount, { shouldValidate: true });
  }, [currenciesMatch, debt.remainingAmount, paymentAmount, setValue]);

  useEffect(() => {
    if (prevCategoryTypeRef.current === categoryType) {
      return;
    }

    prevCategoryTypeRef.current = categoryType;
    setValue("categoryId", undefined);
  }, [categoryType, setValue]);

  const onSubmit = async (data: CloseDebtInput) => {
    if (!currenciesMatch && !data.toAmount) {
      toast.error("Укажите сумму получения");
      return;
    }

    if (compareMoney(categoryAmount, "0") > 0 && !data.categoryId) {
      toast.error("Выберите категорию");
      return;
    }

    const submitData: CloseDebtInput = {
      ...data,
      useAccount: true,
    };
    const balanceDeltas = new Map<string, string>();
    addAccountBalanceDelta(
      balanceDeltas,
      submitData.accountId,
      getDebtTransactionBalanceDelta(debt.type, {
        type: DebtTransactionType.CLOSED,
        amount: submitData.amount,
        toAmount: currenciesMatch ? null : submitData.toAmount,
      })
    );
    const categoryPaymentType = categoryType === "income" ? "income" : categoryType === "expense" ? "expense" : null;
    if (categoryPaymentType && compareMoney(categoryAmount, "0") > 0) {
      addAccountBalanceDelta(
        balanceDeltas,
        submitData.accountId,
        getPaymentTransactionBalanceDelta(categoryPaymentType, categoryAmount)
      );
    }

    try {
      const remainingAmount = subtractMoney(debt.remainingAmount, submitData.amount);
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["debts", "transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          updateDebtsInCache(context, [
            {
              id: debt.id,
              remainingAmount,
              status: compareMoney(remainingAmount, "0") <= 0 ? "closed" : "open",
            },
          ]);
        },
        onApplied: () => onOpenChange(false),
        mutation: () => closeDebt(debt.id, submitData),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories"]);
    } catch {
      toast.error("Не удалось погасить долг");
    }
  };

  const handleAccountSelect = (account: Account) => {
    setValue("accountId", account.id, { shouldValidate: true });
    if (account.currency === debt.currency) {
      setValue("toAmount", "");
      setValue("paymentAmount", paymentAmount || amount || debt.remainingAmount, { shouldValidate: true });
    } else {
      setValue("paymentAmount", "");
      setValue("categoryId", undefined);
      handleAmountChange(amount || debt.remainingAmount);
    }
  };

  const handleCloseAll = () => {
    setValue("amount", debt.remainingAmount);
    setValue("paymentAmount", debt.remainingAmount);
    setValue("categoryId", undefined);
    handleAmountChange(debt.remainingAmount);
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Погасить долг</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
              <div className="truncate font-medium">{debt.personName}</div>
              <div className="shrink-0 text-right font-semibold text-foreground text-sm">
                {formatMoney(debt.remainingAmount, debt.currency)}
              </div>
            </div>

            <AccountSelector
              workspaceId={workspaceId}
              account={previewAccount || selectedAccount || null}
              onSelect={handleAccountSelect}
              label={debt.type === DebtType.LENT ? "Счёт для зачисления" : "Счёт для списания"}
              required
              error={errors.accountId?.message}
            />

            {!currenciesMatch && selectedAccount ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="toAmount" required>
                    Сумма отправления ({selectedAccount.currency})
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
                        onChange: (event) => handleToAmountChange(event.target.value),
                      })}
                    />
                  </div>
                  {errors.toAmount && <p className="text-sm text-destructive">{errors.toAmount.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" required>
                    Сумма получения ({debt.currency})
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                      {getCurrencySymbol(debt.currency)}
                    </span>
                    <NumberInput
                      id="amount"
                      placeholder="0.00"
                      className="pl-9 pr-16"
                      {...register("amount", {
                        onChange: (event) => handleAmountChange(event.target.value),
                      })}
                    />
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount" required>
                    {debt.type === DebtType.LENT ? "Фактически получили" : "Фактически отправили"} ({debt.currency}){" "}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                      {getCurrencySymbol(debt.currency)}
                    </span>
                    <NumberInput
                      id="paymentAmount"
                      placeholder="0.00"
                      className="pl-9 pr-16"
                      {...register("paymentAmount")}
                    />
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
                  {(errors.paymentAmount || errors.amount) && (
                    <p className="text-sm text-destructive">
                      {errors.paymentAmount?.message || errors.amount?.message}
                    </p>
                  )}
                </div>

                {compareMoney(categoryAmount, "0") > 0 && (
                  <div className="text-base space-y-4 mt-8">
                    <h4 className="font-medium">Дополнительно</h4>

                    <div className="space-y-2">
                      <Label htmlFor="categoryAmount">Сумма</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                          {getCurrencySymbol(debt.currency)}
                        </span>
                        <NumberInput id="categoryAmount" value={categoryAmount} readOnly className="pl-9" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="categoryId" required>
                        Категория
                      </Label>
                      <Button
                        type="button"
                        variant="field"
                        className="w-full justify-between"
                        onClick={() => categoryModal.openDialog(true)}
                      >
                        {selectedCategory ? (
                          <span className="truncate">{selectedCategory.label}</span>
                        ) : (
                          <span className="text-muted-foreground">Выберите категорию</span>
                        )}
                      </Button>
                      {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Погашение..." : "Погасить"}
          </Button>
        </DialogFooter>
      </DialogWindow>

      {categoryModal.mounted && (
        <CategorySelectModal
          open={categoryModal.open}
          onOpenChange={categoryModal.closeDialog}
          options={categoryOptions}
          value={categoryId}
          onSelect={handleCategorySelect}
          placeholder="Выберите категорию"
          searchPlaceholder="Поиск категории..."
          emptyText="Категории не найдены"
        />
      )}
    </Dialog>
  );
}
