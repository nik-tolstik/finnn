"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { getCategories } from "@/modules/categories/category.service";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { type CreateTransactionInput, createTransactionSchema } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Segmented } from "@/shared/ui/segmented";
import { Textarea } from "@/shared/ui/textarea";
import { addMoney, compareMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { TransactionType } from "../../transaction.constants";
import { createTransaction } from "../../transaction.service";

interface CreateTransactionDialogProps {
  account?: Account | (Partial<Account> & { id: string });
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  defaultType?: TransactionType.INCOME | TransactionType.EXPENSE;
  initialAmount?: string;
  initialDescription?: string;
  initialDate?: Date;
  initialCategoryId?: string;
}

export function CreateTransactionDialog({
  account: accountProp,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  defaultType = TransactionType.EXPENSE,
  initialAmount,
  initialDescription,
  initialDate,
  initialCategoryId,
}: CreateTransactionDialogProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const selectAccountDialog = useDialogState();

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const account = useMemo(() => {
    if (accountProp) {
      const accounts = accountsData?.data;
      if (accounts && accountProp.id) {
        const hasAllFields =
          "createdAt" in accountProp &&
          accountProp.createdAt &&
          "balance" in accountProp &&
          accountProp.balance !== undefined;
        if (!hasAllFields) {
          const fullAccount = accounts.find((acc) => acc.id === accountProp.id);
          if (fullAccount) return fullAccount;
        }
      }
      if ("balance" in accountProp && accountProp.balance !== undefined && "createdAt" in accountProp) {
        return accountProp as Account;
      }
      return undefined;
    }
    const accounts = accountsData?.data;
    if (!accounts || !session?.user?.id) return undefined;
    const userAccounts = accounts.filter((acc) => acc.ownerId === session.user.id);
    return userAccounts[0];
  }, [accountProp, accountsData?.data, session]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    setError,
    clearErrors,
    control,
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      accountId: accountProp?.id || account?.id || "",
      amount: initialAmount || "",
      type: defaultType,
      description: initialDescription || "",
      date:
        initialDate ||
        (() => {
          const now = new Date();
          if (!account) return now;
          const accountCreatedDate = new Date(account.createdAt);
          accountCreatedDate.setHours(0, 0, 0, 0);
          const nowDateOnly = new Date(now);
          nowDateOnly.setHours(0, 0, 0, 0);
          if (nowDateOnly < accountCreatedDate) {
            const result = new Date(accountCreatedDate);
            result.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            return result;
          }
          return now;
        })(),
      categoryId: initialCategoryId || undefined,
    },
  });

  const transactionType = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const accountId = useWatch({ control, name: "accountId" });
  const amount = useWatch({ control, name: "amount" });
  const categoryModal = useDialogState();

  const selectedAccount = useMemo(() => {
    if (accountProp) {
      const accounts = accountsData?.data;
      if (accounts && accountProp.id && (!("balance" in accountProp) || !accountProp.balance)) {
        const fullAccount = accounts.find((acc) => acc.id === accountProp.id);
        if (fullAccount) return fullAccount;
      }
      if ("balance" in accountProp && accountProp.balance) {
        return accountProp as Account;
      }
      return undefined;
    }
    const accounts = accountsData?.data;
    if (accountId && accounts) {
      return accounts.find((acc) => acc.id === accountId);
    }
    return account;
  }, [accountProp, accountId, accountsData?.data, account]);

  const previewAccount = useMemo(() => {
    const currentAccount = selectedAccount || account;
    if (!currentAccount || !("balance" in currentAccount) || !currentAccount.balance || !amount) {
      return currentAccount;
    }
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) return currentAccount;

    let newBalance = currentAccount.balance;
    if (transactionType === TransactionType.INCOME) {
      newBalance = addMoney(currentAccount.balance, amount);
    } else if (transactionType === TransactionType.EXPENSE) {
      newBalance = subtractMoney(currentAccount.balance, amount);
    }

    return {
      ...currentAccount,
      balance: newBalance,
    };
  }, [selectedAccount, account, amount, transactionType]);

  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const allCategories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData?.data]);

  // Filter categories by transaction type
  const filteredCategories = useMemo(() => {
    return allCategories.filter((cat) => cat.type === transactionType || transactionType === TransactionType.TRANSFER);
  }, [allCategories, transactionType]);

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }, [filteredCategories]);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  const prevOpenRef = React.useRef(open);
  const accountIdRef = React.useRef<string | undefined>(account?.id || accountProp?.id);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const now = new Date();
      let defaultDate: Date = initialDate || now;
      const currentAccount = account;

      if (!initialDate && currentAccount && "createdAt" in currentAccount && currentAccount.createdAt) {
        const accountCreatedDate = new Date(currentAccount.createdAt);
        accountCreatedDate.setHours(0, 0, 0, 0);
        const nowDateOnly = new Date(now);
        nowDateOnly.setHours(0, 0, 0, 0);
        if (nowDateOnly < accountCreatedDate) {
          defaultDate = new Date(accountCreatedDate);
          defaultDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
      }

      const initialAccountId = currentAccount?.id || accountProp?.id || "";
      accountIdRef.current = initialAccountId;

      const resetValues = {
        accountId: initialAccountId,
        amount: initialAmount || "",
        type: defaultType,
        description: initialDescription || "",
        date: defaultDate,
        categoryId: initialCategoryId || undefined,
        newCategory: undefined,
      };

      reset(resetValues);

      if (initialAmount) {
        setValue("amount", initialAmount, { shouldValidate: false });
      }
      if (initialDescription) {
        setValue("description", initialDescription, { shouldValidate: false });
      }
      if (initialCategoryId) {
        setValue("categoryId", initialCategoryId, { shouldValidate: false });
      }
      if (initialDate) {
        setValue("date", initialDate, { shouldValidate: false });
      }
    }
    prevOpenRef.current = open;
  }, [
    open,
    reset,
    setValue,
    defaultType,
    account,
    accountProp,
    initialAmount,
    initialDescription,
    initialDate,
    initialCategoryId,
  ]);

  useEffect(() => {
    if (open && account && account.id !== accountIdRef.current) {
      const now = new Date();
      let defaultDate: Date = initialDate || now;

      if (!initialDate && "createdAt" in account && account.createdAt) {
        const accountCreatedDate = new Date(account.createdAt);
        accountCreatedDate.setHours(0, 0, 0, 0);
        const nowDateOnly = new Date(now);
        nowDateOnly.setHours(0, 0, 0, 0);
        if (nowDateOnly < accountCreatedDate) {
          defaultDate = new Date(accountCreatedDate);
          defaultDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
      }

      accountIdRef.current = account.id;
      reset({
        accountId: account.id,
        amount: initialAmount || "",
        type: defaultType,
        description: initialDescription || "",
        date: defaultDate,
        categoryId: initialCategoryId || undefined,
        newCategory: undefined,
      });
    }
  }, [open, account, reset, defaultType, initialAmount, initialDescription, initialDate, initialCategoryId]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateTransactionInput) => {
    const currentAccount = selectedAccount || account;
    if (!currentAccount || !("createdAt" in currentAccount) || !currentAccount.createdAt) return;

    const accountCreatedDate = new Date(currentAccount.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);
    const transactionDate = new Date(data.date);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate < accountCreatedDate) {
      toast.error(
        `Дата транзакции не может быть раньше даты создания счета (${format(accountCreatedDate, "dd.MM.yyyy", {
          locale: ru,
        })})`
      );
      return;
    }

    const result = await createTransaction(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      onOpenChange(false);

      await invalidateWorkspaceDomains(queryClient, workspaceId, [
        "transactions",
        "accounts",
        ...(data.newCategory ? (["categories"] as const) : []),
      ]);
    }
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value);
    setValue("newCategory", undefined);
  };

  const handleAccountSelect = (selectedAccount: Account) => {
    setValue("accountId", selectedAccount.id);
  };

  if (!account) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogWindow onCloseComplete={onCloseComplete}>
          <DialogHeader>
            <DialogTitle>Создать транзакцию</DialogTitle>
          </DialogHeader>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Счёт</Label>
                {previewAccount && "balance" in previewAccount && previewAccount.balance !== undefined && (
                  <AccountCard
                    account={previewAccount as Account}
                    onClick={() => selectAccountDialog.openDialog(null)}
                    showOwner={false}
                  />
                )}
                {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">
                  Тип транзакции <span className="text-destructive">*</span>
                </Label>
                <Segmented
                  options={[
                    {
                      value: TransactionType.EXPENSE,
                      label: "Расход",
                      icon: <ArrowDown className="h-4 w-4" />,
                      selectedClassName: "text-destructive",
                    },
                    {
                      value: TransactionType.INCOME,
                      label: "Доход",
                      icon: <ArrowUp className="h-4 w-4" />,
                      selectedClassName: "text-success",
                    },
                  ]}
                  value={transactionType}
                  onChange={(value) => setValue("type", value)}
                />
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Категория</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => categoryModal.openDialog(true)}
                  >
                    {selectedCategory ? (
                      <span className="truncate">{selectedCategory.label}</span>
                    ) : (
                      <span className="text-muted-foreground">Выберите категорию</span>
                    )}
                  </Button>
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setValue("categoryId", undefined);
                        setValue("newCategory", undefined);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {categoryModal.mounted && (
                  <CategorySelectModal
                    open={categoryModal.open}
                    onOpenChange={categoryModal.closeDialog}
                    options={comboboxOptions}
                    value={categoryId}
                    onSelect={handleCategorySelect}
                    placeholder="Выберите категорию"
                    searchPlaceholder="Поиск категории..."
                    emptyText="Категории не найдены"
                  />
                )}
                {(errors.categoryId || errors.newCategory) && (
                  <p className="text-sm text-destructive">
                    {errors.categoryId?.message || errors.newCategory?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  Сумма <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                    {getCurrencySymbol(selectedAccount?.currency || account.currency)}
                  </span>
                  <NumberInput
                    id="amount"
                    placeholder="0.00"
                    className="pl-9 pr-12"
                    {...register("amount", {
                      onChange: (e) => {
                        const value = e.target.value;
                        if (value && parseFloat(value) < 0) {
                          e.target.value = "";
                        }
                        const currentAccount = selectedAccount || account;
                        if (
                          currentAccount &&
                          "balance" in currentAccount &&
                          currentAccount.balance &&
                          transactionType === TransactionType.EXPENSE &&
                          value
                        ) {
                          const amount = parseFloat(value);
                          if (!Number.isNaN(amount) && compareMoney(amount, currentAccount.balance) > 0) {
                            setError("amount", {
                              type: "manual",
                              message: `Сумма не может превышать баланс счёта (${currentAccount.balance})`,
                            });
                          } else {
                            clearErrors("amount");
                          }
                        }
                      },
                      validate: (value) => {
                        const currentAccount = selectedAccount || account;
                        if (
                          !currentAccount ||
                          !("balance" in currentAccount) ||
                          !currentAccount.balance ||
                          transactionType !== TransactionType.EXPENSE
                        )
                          return true;
                        const amount = parseFloat(value);
                        if (Number.isNaN(amount)) return true;
                        if (compareMoney(amount, currentAccount.balance) > 0) {
                          return `Сумма не может превышать баланс счёта (${currentAccount.balance})`;
                        }
                        return true;
                      },
                    })}
                    aria-invalid={errors.amount ? "true" : "false"}
                  />
                  {selectedAccount &&
                    "balance" in selectedAccount &&
                    selectedAccount.balance &&
                    parseFloat(selectedAccount.balance) > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs shrink-0"
                        onClick={() => {
                          setValue("amount", selectedAccount.balance, { shouldValidate: true, shouldTouch: true });
                        }}
                      >
                        Max
                      </Button>
                    )}
                </div>
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание транзакции"
                  rows={3}
                  {...register("description")}
                  aria-invalid={errors.description ? "true" : "false"}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Дата и время</Label>
                <Controller
                  control={control}
                  name="date"
                  render={({ field }) => (
                    <DateTimePicker
                      date={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        const currentAccount = selectedAccount || account;
                        if (!currentAccount || !("createdAt" in currentAccount) || !currentAccount.createdAt)
                          return false;
                        const accountCreatedDate = new Date(currentAccount.createdAt);
                        accountCreatedDate.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        return checkDate < accountCreatedDate;
                      }}
                    />
                  )}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>
            </form>
          </DialogContent>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? "Создание..." : "Создать транзакцию"}
            </Button>
          </DialogFooter>
        </DialogWindow>
      </Dialog>

      {selectAccountDialog.mounted && (
        <SelectAccountDialog
          workspaceId={workspaceId}
          open={selectAccountDialog.open}
          onOpenChange={selectAccountDialog.closeDialog}
          onCloseComplete={selectAccountDialog.unmountDialog}
          onSelect={handleAccountSelect}
        />
      )}
    </>
  );
}
