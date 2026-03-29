"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { getCategories } from "@/modules/categories/category.service";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import { type UpdateTransactionInput, updateTransactionSchema } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import type { ComboboxOption } from "@/shared/ui/combobox";
import { DateTimePicker } from "@/shared/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Textarea } from "@/shared/ui/textarea";
import { addMoney, compareMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { updateTransaction } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

interface EditTransactionDialogProps {
  transaction: TransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function EditTransactionDialog({
  transaction,
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
}: EditTransactionDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    setError,
    clearErrors,
    control,
  } = useForm<UpdateTransactionInput>({
    resolver: zodResolver(updateTransactionSchema),
    defaultValues: {
      accountId: transaction.account.id,
      amount: transaction.amount,
      description: transaction.description || "",
      date: new Date(transaction.date),
      categoryId: transaction.categoryId || null,
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const accounts = useMemo(() => {
    return accountsData?.data || [];
  }, [accountsData?.data]);

  const allCategories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData?.data]);

  // Filter categories by transaction type
  const filteredCategories = useMemo(() => {
    return allCategories.filter(
      (cat) => cat.type === transaction.type || transaction.type === TransactionType.TRANSFER
    );
  }, [allCategories, transaction.type]);

  // Options for the combobox
  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
    }));
  }, [filteredCategories]);

  const categoryId = useWatch({ control, name: "categoryId" });
  const accountId = useWatch({ control, name: "accountId" });
  const amount = useWatch({ control, name: "amount" });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === accountId);
  }, [accounts, accountId]);

  const accountBalanceBeforeTransaction = useMemo(() => {
    if (!selectedAccount || transaction.type !== TransactionType.EXPENSE) return null;
    return addMoney(selectedAccount.balance, transaction.amount);
  }, [selectedAccount, transaction]);

  const previewAccount = useMemo(() => {
    if (!selectedAccount || !amount) return selectedAccount;
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) return selectedAccount;

    let newBalance = accountBalanceBeforeTransaction || selectedAccount.balance;
    if (transaction.type === TransactionType.INCOME) {
      newBalance = addMoney(accountBalanceBeforeTransaction || selectedAccount.balance, amount);
    } else if (transaction.type === TransactionType.EXPENSE) {
      if (accountBalanceBeforeTransaction) {
        newBalance = subtractMoney(accountBalanceBeforeTransaction, amount);
      } else {
        newBalance = subtractMoney(selectedAccount.balance, amount);
      }
    }

    return {
      ...selectedAccount,
      balance: newBalance,
    };
  }, [selectedAccount, amount, transaction.type, accountBalanceBeforeTransaction]);

  const onSubmit = async (data: UpdateTransactionInput) => {
    onOpenChange(false);
    const result = await updateTransaction(transaction.id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["transactions", "accounts"]);
    }
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Редактировать транзакцию</DialogTitle>
          <DialogDescription>Измените данные транзакции.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelector
                    workspaceId={workspaceId}
                    account={previewAccount || selectedAccount || null}
                    onSelect={(account: Account) => {
                      field.onChange(account.id);
                    }}
                    label="Счёт"
                    required
                    error={errors.accountId?.message}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Сумма <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                {selectedAccount && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium z-10">
                    {getCurrencySymbol(selectedAccount.currency)}
                  </span>
                )}
                <NumberInput
                  id="amount"
                  placeholder="0.00"
                  className={selectedAccount ? "pl-9 pr-12" : "pr-12"}
                  {...register("amount", {
                    onChange: (e) => {
                      const value = e.target.value;
                      if (value && parseFloat(value) < 0) {
                        e.target.value = "";
                      }
                      if (
                        selectedAccount &&
                        transaction.type === TransactionType.EXPENSE &&
                        value &&
                        accountBalanceBeforeTransaction
                      ) {
                        const amount = parseFloat(value);
                        if (!Number.isNaN(amount) && compareMoney(amount, accountBalanceBeforeTransaction) > 0) {
                          setError("amount", {
                            type: "manual",
                            message: `Сумма не может превышать баланс счёта (${accountBalanceBeforeTransaction})`,
                          });
                        } else {
                          clearErrors("amount");
                        }
                      }
                    },
                    validate: (value) => {
                      if (
                        !selectedAccount ||
                        transaction.type !== TransactionType.EXPENSE ||
                        !value ||
                        !accountBalanceBeforeTransaction
                      )
                        return true;
                      const amount = parseFloat(value);
                      if (Number.isNaN(amount)) return true;
                      if (compareMoney(amount, accountBalanceBeforeTransaction) > 0) {
                        return `Сумма не может превышать баланс счёта (${accountBalanceBeforeTransaction})`;
                      }
                      return true;
                    },
                  })}
                  aria-invalid={errors.amount ? "true" : "false"}
                />
                {selectedAccount &&
                  transaction.type === TransactionType.EXPENSE &&
                  accountBalanceBeforeTransaction &&
                  parseFloat(accountBalanceBeforeTransaction) > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 text-xs shrink-0"
                      onClick={() => {
                        setValue("amount", accountBalanceBeforeTransaction, {
                          shouldValidate: true,
                          shouldTouch: true,
                        });
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
              <Label htmlFor="categoryId">Категория</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setCategoryModalOpen(true)}
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
                      setValue("categoryId", null);
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
                value={categoryId || undefined}
                onSelect={handleCategorySelect}
                placeholder="Выберите категорию"
                searchPlaceholder="Поиск категории..."
                emptyText="Категории не найдены"
              />
              {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Дата и время</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => <DateTimePicker date={field.value} onSelect={field.onChange} />}
              />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
