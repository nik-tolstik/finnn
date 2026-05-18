"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDown, ArrowLeftRight, ArrowUp, X } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/select-account-dialog";
import { getCategories } from "@/modules/categories/category.service";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useDialogState } from "@/shared/hooks/useDialogState";
import {
  addAccountBalanceDelta,
  getPaymentTransactionBalanceDelta,
  getTransferTransactionBalanceDeltas,
} from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import {
  type CreatePaymentTransactionInput,
  type CreateTransferTransactionInput,
  createPaymentTransactionSchema,
  createTransferTransactionSchema,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Segmented } from "@/shared/ui/segmented";
import { Textarea } from "@/shared/ui/textarea";
import { compareMoney, getCurrencySymbol } from "@/shared/utils/money";

import { PaymentTransactionType } from "../../transaction.constants";
import { createPaymentTransaction, createTransferTransaction } from "../../transaction.service";
import { TransferForm } from "../transfer-form/TransferForm";
import {
  type CreateTransactionMode,
  getCategoryOptions,
  getCreatePaymentDefaultValues,
  getCreateTransferDefaultValues,
  getPreviewPaymentAccount,
  resolveDefaultAccount,
  resolveSelectedAccount,
  TRANSFER_TRANSACTION_MODE,
} from "./create-transaction-dialog.utils";

interface CreateTransactionDialogProps {
  account?: Account | (Partial<Account> & { id: string });
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
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
  defaultType = PaymentTransactionType.EXPENSE,
  initialAmount,
  initialDescription,
  initialDate,
  initialCategoryId,
}: CreateTransactionDialogProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const selectAccountDialog = useDialogState();
  const [transactionMode, setTransactionMode] = useState<CreateTransactionMode>(defaultType);

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const account = useMemo(
    () => resolveDefaultAccount({ accountProp, accounts: accountsData?.data, userId: session?.user?.id }),
    [accountProp, accountsData?.data, session?.user?.id]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    setError,
    clearErrors,
    control,
  } = useForm<CreatePaymentTransactionInput>({
    resolver: zodResolver(createPaymentTransactionSchema),
    defaultValues: getCreatePaymentDefaultValues({
      accountId: accountProp?.id || account?.id || "",
      defaultType,
      initialAmount,
      initialDescription,
      initialDate,
      initialCategoryId,
      account,
    }),
  });

  const transferForm = useForm<CreateTransferTransactionInput>({
    resolver: zodResolver(createTransferTransactionSchema),
    defaultValues: getCreateTransferDefaultValues(accountProp?.id || account?.id || ""),
  });
  const { reset: resetTransferForm, getValues: getTransferFormValues, setValue: setTransferFormValue } = transferForm;

  const transactionType = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const accountId = useWatch({ control, name: "accountId" });
  const amount = useWatch({ control, name: "amount" });
  const categoryModal = useDialogState();
  const isTransferMode = transactionMode === TRANSFER_TRANSACTION_MODE;

  const selectedAccount = useMemo(
    () => resolveSelectedAccount({ accountProp, accounts: accountsData?.data, accountId, fallbackAccount: account }),
    [accountProp, accountsData?.data, accountId, account]
  );

  const previewAccount = useMemo(() => {
    const currentAccount = selectedAccount || account;
    return getPreviewPaymentAccount(currentAccount, transactionType, amount);
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

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return getCategoryOptions(allCategories, transactionType);
  }, [allCategories, transactionType]);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  const prevOpenRef = React.useRef(open);
  const accountIdRef = React.useRef<string | undefined>(account?.id || accountProp?.id);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const currentAccount = account;
      const initialAccountId = currentAccount?.id || accountProp?.id || "";
      accountIdRef.current = initialAccountId;
      setTransactionMode(defaultType);

      const resetValues = getCreatePaymentDefaultValues({
        accountId: initialAccountId,
        defaultType,
        initialAmount,
        initialDescription,
        initialDate,
        initialCategoryId,
        account: currentAccount,
      });

      reset(resetValues);
      resetTransferForm(getCreateTransferDefaultValues(initialAccountId));

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
    resetTransferForm,
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
      accountIdRef.current = account.id;
      setTransactionMode(defaultType);
      reset(
        getCreatePaymentDefaultValues({
          accountId: account.id,
          defaultType,
          initialAmount,
          initialDescription,
          initialDate,
          initialCategoryId,
          account,
        })
      );
      resetTransferForm(getCreateTransferDefaultValues(account.id));
    }
  }, [
    open,
    account,
    reset,
    resetTransferForm,
    defaultType,
    initialAmount,
    initialDescription,
    initialDate,
    initialCategoryId,
  ]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreatePaymentTransactionInput) => {
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

    const balanceDeltas = new Map<string, string>();
    addAccountBalanceDelta(balanceDeltas, data.accountId, getPaymentTransactionBalanceDelta(data.type, data.amount));

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => updateAccountBalancesInCache(context, balanceDeltas),
        mutation: () => createPaymentTransaction(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);

      if (data.newCategory) {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories"]);
      }
    } catch {
      toast.error("Не удалось создать транзакцию");
    }
  };

  const onTransferSubmit = async (data: CreateTransferTransactionInput) => {
    const balanceDeltas = new Map<string, string>();
    const transferDeltas = getTransferTransactionBalanceDeltas(data.amount, data.toAmount);
    addAccountBalanceDelta(balanceDeltas, data.fromAccountId, transferDeltas.fromDelta);
    addAccountBalanceDelta(balanceDeltas, data.toAccountId, transferDeltas.toDelta);

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => updateAccountBalancesInCache(context, balanceDeltas),
        mutation: () => createTransferTransaction(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
    } catch {
      toast.error("Не удалось создать перевод");
    }
  };

  const handleModeChange = (value: CreateTransactionMode) => {
    setTransactionMode(value);

    if (value === TRANSFER_TRANSACTION_MODE) {
      const currentFromAccountId = getTransferFormValues("fromAccountId");
      if (!currentFromAccountId) {
        setTransferFormValue("fromAccountId", selectedAccount?.id || account?.id || accountProp?.id || "");
      }
      return;
    }

    setValue("type", value);
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
            <DialogTitle>{isTransferMode ? "Создать перевод" : "Создать транзакцию"}</DialogTitle>
          </DialogHeader>
          <DialogContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type" required>
                  Тип транзакции
                </Label>
                <Segmented
                  options={[
                    {
                      value: PaymentTransactionType.EXPENSE,
                      label: "Расход",
                      icon: <ArrowDown className="h-4 w-4" />,
                      selectedClassName: "text-destructive",
                    },
                    {
                      value: PaymentTransactionType.INCOME,
                      label: "Доход",
                      icon: <ArrowUp className="h-4 w-4" />,
                      selectedClassName: "text-success",
                    },
                    {
                      value: TRANSFER_TRANSACTION_MODE,
                      label: "Перевод",
                      icon: <ArrowLeftRight className="h-4 w-4" />,
                      selectedClassName: "text-amber-600 dark:text-amber-400",
                    },
                  ]}
                  value={transactionMode}
                  onChange={handleModeChange}
                  layout="fill"
                />
                {!isTransferMode && errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>

              {isTransferMode ? (
                <TransferForm
                  workspaceId={workspaceId}
                  form={transferForm}
                  accounts={accountsData?.data || []}
                  onSubmit={onTransferSubmit}
                />
              ) : (
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
                    <Label htmlFor="amount" required>
                      Сумма
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
                              transactionType === PaymentTransactionType.EXPENSE &&
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
                              transactionType !== PaymentTransactionType.EXPENSE
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
              )}
            </div>
          </DialogContent>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={isTransferMode ? transferForm.handleSubmit(onTransferSubmit) : handleSubmit(onSubmit)}
              disabled={isTransferMode ? transferForm.formState.isSubmitting : isSubmitting}
            >
              {isTransferMode
                ? transferForm.formState.isSubmitting
                  ? "Создание..."
                  : "Создать перевод"
                : isSubmitting
                  ? "Создание..."
                  : "Создать транзакцию"}
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
