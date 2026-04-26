"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { CategoryType } from "@/modules/categories/category.constants";
import { getCategories } from "@/modules/categories/category.service";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { type CloseDebtInput, closeDebtSchema } from "@/shared/lib/validations/debt";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { addMoney, compareMoney, formatMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { DebtType } from "../../debt.constants";
import { closeDebt } from "../../debt.service";
import type { DebtWithRelations } from "../../debt.types";

interface CloseDebtDialogProps {
  debt: DebtWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CloseDebtDialog({ debt, workspaceId, open, onOpenChange, onCloseComplete }: CloseDebtDialogProps) {
  const queryClient = useQueryClient();
  const selectAccountDialog = useDialogState();
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CloseDebtInput>({
    resolver: zodResolver(closeDebtSchema),
    defaultValues: {
      amount: debt.remainingAmount,
      paymentAmount: debt.remainingAmount,
      toAmount: "",
      categoryId: undefined,
      closeEarly: false,
      accountId: debt.accountId || "",
      useAccount: true,
    },
  });

  const amount = useWatch({ control, name: "amount" });
  const paymentAmount = useWatch({ control, name: "paymentAmount" });
  const toAmount = useWatch({ control, name: "toAmount" });
  const accountId = useWatch({ control, name: "accountId" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const closeEarly = useWatch({ control, name: "closeEarly" });

  const selectedAccount = useMemo(() => {
    if (!accountId || !accounts.length) return undefined;
    return accounts.find((acc) => acc.id === accountId);
  }, [accountId, accounts]);

  const currenciesMatch = useMemo(() => {
    if (!selectedAccount) return true;
    return selectedAccount.currency === debt.currency;
  }, [selectedAccount, debt.currency]);

  const previewAccount = useMemo(() => {
    if (!selectedAccount) {
      return selectedAccount;
    }

    if (!currenciesMatch) {
      if (!toAmount) {
        return selectedAccount;
      }
      const toAmountNum = parseFloat(toAmount);
      if (Number.isNaN(toAmountNum)) return selectedAccount;

      let newBalance = selectedAccount.balance;
      if (debt.type === DebtType.LENT) {
        newBalance = addMoney(selectedAccount.balance, toAmount);
      } else {
        if (compareMoney(toAmount, selectedAccount.balance) > 0) {
          return selectedAccount;
        }
        newBalance = subtractMoney(selectedAccount.balance, toAmount);
      }

      return {
        ...selectedAccount,
        balance: newBalance,
      };
    }

    const amountToUse = paymentAmount || amount;

    if (!amountToUse) {
      return selectedAccount;
    }
    const amountNum = parseFloat(amountToUse);
    if (Number.isNaN(amountNum)) return selectedAccount;

    let newBalance = selectedAccount.balance;
    if (debt.type === DebtType.LENT) {
      newBalance = addMoney(selectedAccount.balance, amountToUse);
    } else {
      if (compareMoney(amountToUse, selectedAccount.balance) > 0) {
        return selectedAccount;
      }
      newBalance = subtractMoney(selectedAccount.balance, amountToUse);
    }

    return {
      ...selectedAccount,
      balance: newBalance,
    };
  }, [selectedAccount, amount, paymentAmount, toAmount, currenciesMatch, debt.type]);

  const canCloseEarly = useMemo(() => {
    return Boolean(currenciesMatch && paymentAmount && compareMoney(paymentAmount, debt.remainingAmount) < 0);
  }, [currenciesMatch, paymentAmount, debt.remainingAmount]);

  const categoryType = useMemo(() => {
    if (!currenciesMatch || !paymentAmount) {
      return null;
    }

    if (closeEarly && compareMoney(paymentAmount, debt.remainingAmount) < 0) {
      return debt.type === DebtType.LENT ? CategoryType.EXPENSE : CategoryType.INCOME;
    }

    if (compareMoney(paymentAmount, debt.remainingAmount) > 0) {
      return debt.type === DebtType.LENT ? CategoryType.INCOME : CategoryType.EXPENSE;
    }

    return null;
  }, [closeEarly, currenciesMatch, debt.remainingAmount, debt.type, paymentAmount]);
  const prevCategoryTypeRef = useRef(categoryType);

  const categoryAmount = useMemo(() => {
    if (!categoryType || !paymentAmount) {
      return "0";
    }

    if (closeEarly && compareMoney(paymentAmount, debt.remainingAmount) < 0) {
      return subtractMoney(debt.remainingAmount, paymentAmount);
    }

    if (compareMoney(paymentAmount, debt.remainingAmount) > 0) {
      return subtractMoney(paymentAmount, debt.remainingAmount);
    }

    return "0";
  }, [categoryType, closeEarly, debt.remainingAmount, paymentAmount]);

  const categoryOptions = useMemo<ComboboxOption[]>(() => {
    if (!categoryType) {
      return [];
    }

    return categories
      .filter((category) => category.type === categoryType)
      .map((category) => ({
        value: category.id,
        label: category.name,
      }));
  }, [categories, categoryType]);

  const selectedCategory = useMemo(() => {
    return categoryOptions.find((option) => option.value === categoryId);
  }, [categoryId, categoryOptions]);

  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset({
        amount: debt.remainingAmount,
        paymentAmount: debt.remainingAmount,
        toAmount: "",
        categoryId: undefined,
        closeEarly: false,
        accountId: debt.accountId || "",
        useAccount: true,
      });
    }
    prevOpenRef.current = open;
  }, [open, reset, debt.remainingAmount, debt.accountId]);

  useEffect(() => {
    if (!currenciesMatch || !paymentAmount) {
      return;
    }

    const closeAmount =
      closeEarly || compareMoney(paymentAmount, debt.remainingAmount) > 0 ? debt.remainingAmount : paymentAmount;
    setValue("amount", closeAmount, { shouldValidate: true });
  }, [closeEarly, currenciesMatch, debt.remainingAmount, paymentAmount, setValue]);

  useEffect(() => {
    if (!canCloseEarly && closeEarly) {
      setValue("closeEarly", false);
    }
  }, [canCloseEarly, closeEarly, setValue]);

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
    const result = await closeDebt(debt.id, submitData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг закрыт");
      onOpenChange(false);
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["debts", "transactions", "accounts", "categories"]);
    }
  };

  const handleAccountSelect = (account: Account) => {
    setValue("accountId", account.id, { shouldValidate: true });
    if (account.currency === debt.currency) {
      setValue("toAmount", "");
      setValue("paymentAmount", paymentAmount || amount || debt.remainingAmount, { shouldValidate: true });
    } else {
      setValue("paymentAmount", "");
      setValue("closeEarly", false);
      setValue("categoryId", undefined);
    }
  };

  const handleCloseAll = () => {
    setValue("amount", debt.remainingAmount);
    setValue("paymentAmount", debt.remainingAmount);
    setValue("closeEarly", false);
    setValue("categoryId", undefined);
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Закрыть долг</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="text-sm text-muted-foreground">
                {debt.type === DebtType.LENT ? "Должник" : "Кредитор"}
              </div>
              <div className="font-medium">{debt.personName}</div>
              <div className="text-sm text-muted-foreground">
                Остаток: {formatMoney(debt.remainingAmount, debt.currency)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId" required>
                {debt.type === DebtType.LENT ? "Счёт для зачисления" : "Счёт для списания"}{" "}
              </Label>
              {selectedAccount && accountId ? (
                <AccountCard
                  account={previewAccount || selectedAccount}
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
                    <NumberInput id="amount" placeholder="0.00" className="pl-9 pr-16" {...register("amount")} />
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

                {canCloseEarly && (
                  <div className="flex items-center space-x-2">
                    <Controller
                      control={control}
                      name="closeEarly"
                      render={({ field }) => (
                        <Checkbox id="closeEarly" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                      )}
                    />

                    <Label htmlFor="closeEarly" className="cursor-pointer">
                      Закрыть долг заранее
                    </Label>
                  </div>
                )}

                {compareMoney(categoryAmount, "0") > 0 && (
                  <div className="text-base space-y-4 mt-8">
                    <h4 className="font-medium">Дополнительно</h4>

                    <div className="space-y-2">
                      <Label htmlFor="categoryAmount">Сумма</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                          {getCurrencySymbol(debt.currency)}
                        </span>
                        <NumberInput
                          id="categoryAmount"
                          value={categoryAmount}
                          readOnly
                          className="pl-9 bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="categoryId" required>
                        Категория
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between bg-background"
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Закрытие..." : "Закрыть долг"}
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
