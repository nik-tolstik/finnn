"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { useSession } from "next-auth/react";
import { getAccounts } from "@/modules/accounts/account.service";
import { SelectAccountDialog } from "@/modules/accounts/components/SelectAccountDialog";
import { CategoryType } from "@/modules/categories/category.constants";
import { getCategories } from "@/modules/categories/category.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { createTransactionSchema, type CreateTransactionInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { type ComboboxOption } from "@/shared/ui/combobox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import { Dialog, DialogWindow, DialogFooter, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Segmented } from "@/shared/ui/segmented";
import { Textarea } from "@/shared/ui/textarea";
import { getCurrencySymbol } from "@/shared/utils/money";

import { TransactionType } from "../transaction.constants";
import { createTransaction } from "../transaction.service";

interface CreateTransactionDialogProps {
  account?: Account;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  defaultType?: TransactionType.INCOME | TransactionType.EXPENSE;
}

export function CreateTransactionDialog({
  account: accountProp,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  defaultType = TransactionType.EXPENSE,
}: CreateTransactionDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const selectAccountDialog = useDialogState();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: open && !accountProp,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const account = useMemo(() => {
    if (accountProp) return accountProp;
    const accounts = accountsData?.data;
    if (!accounts || !session?.user?.id) return undefined;
    const userAccounts = accounts.filter((acc) => acc.ownerId === session.user.id);
    return userAccounts[0];
  }, [accountProp, accountsData?.data, session?.user?.id]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      accountId: account?.id || "",
      amount: "",
      type: defaultType,
      description: "",
      date: (() => {
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
      categoryId: undefined,
    },
  });

  const transactionType = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const accountId = useWatch({ control, name: "accountId" });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const selectedAccount = useMemo(() => {
    if (accountProp) return accountProp;
    const accounts = accountsData?.data;
    if (accountId && accounts) {
      return accounts.find((acc) => acc.id === accountId);
    }
    return account;
  }, [accountProp, accountId, accountsData?.data, account]);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
    enabled: open,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const allCategories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData?.data]);

  // Фильтруем категории по типу транзакции
  const filteredCategories = useMemo(() => {
    return allCategories.filter((cat) => cat.type === transactionType || transactionType === TransactionType.TRANSFER);
  }, [allCategories, transactionType]);

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
      color: cat.color || undefined,
    }));
  }, [filteredCategories]);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  const prevOpenRef = React.useRef(open);
  const accountIdRef = React.useRef<string | undefined>(account?.id);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const now = new Date();
      let defaultDate: Date = now;
      const currentAccount = account;

      if (currentAccount) {
        const accountCreatedDate = new Date(currentAccount.createdAt);
        accountCreatedDate.setHours(0, 0, 0, 0);
        const nowDateOnly = new Date(now);
        nowDateOnly.setHours(0, 0, 0, 0);
        if (nowDateOnly < accountCreatedDate) {
          defaultDate = new Date(accountCreatedDate);
          defaultDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
      }

      const initialAccountId = currentAccount?.id || "";
      accountIdRef.current = initialAccountId;

      reset({
        accountId: initialAccountId,
        amount: "",
        type: defaultType,
        description: "",
        date: defaultDate,
        categoryId: undefined,
        newCategory: undefined,
      });
    }
    prevOpenRef.current = open;
  }, [open, reset, defaultType, account]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateTransactionInput) => {
    const currentAccount = selectedAccount || account;
    if (!currentAccount) return;

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
      toast.success("Транзакция успешно создана");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions", workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["accounts", workspaceId],
        }),
        data.newCategory
          ? queryClient.invalidateQueries({
              queryKey: ["categories", workspaceId],
            })
          : Promise.resolve(),
      ]);
      router.refresh();
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
            <form className="space-y-4">
              <div className="space-y-2">
                <Label>Счёт</Label>
                {selectedAccount && (
                  <AccountCard
                    account={selectedAccount}
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
                    selectedClassName: "text-error-primary",
                  },
                  {
                    value: TransactionType.INCOME,
                    label: "Доход",
                    icon: <ArrowUp className="h-4 w-4" />,
                    selectedClassName: "text-success-primary",
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
                  onClick={() => setCategoryModalOpen(true)}
                >
                  {selectedCategory ? (
                    <div className="flex items-center gap-2">
                      {selectedCategory.color && (
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                      )}
                      <span className="truncate">{selectedCategory.label}</span>
                    </div>
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
              <CategorySelectModal
                open={categoryModalOpen}
                onOpenChange={setCategoryModalOpen}
                options={comboboxOptions}
                value={categoryId}
                onSelect={handleCategorySelect}
                placeholder="Выберите категорию"
                searchPlaceholder="Поиск категории..."
                emptyText="Категории не найдены"
              />
              {(errors.categoryId || errors.newCategory) && (
                <p className="text-sm text-destructive">{errors.categoryId?.message || errors.newCategory?.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Сумма <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {getCurrencySymbol(selectedAccount?.currency || account.currency)}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-9"
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
                      if (!currentAccount) return false;
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
