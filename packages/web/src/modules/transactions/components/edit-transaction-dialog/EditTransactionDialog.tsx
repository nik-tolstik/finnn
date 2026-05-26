"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { getCategories } from "@/modules/categories/category.api";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import { addAccountBalanceDelta, getPaymentTransactionBalanceDelta } from "@/shared/lib/balance-domain";
import {
  runOptimisticWorkspaceMutation,
  updateAccountBalancesInCache,
  updateTransactionsInCache,
} from "@/shared/lib/optimistic-workspace-updates";
import { accountKeys, categoryKeys } from "@/shared/lib/query-keys";
import {
  type UpdatePaymentTransactionInput,
  updatePaymentTransactionSchema,
} from "@/shared/lib/validations/transaction";
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
import { compareMoney, getCurrencySymbol, subtractMoney } from "@/shared/utils/money";

import { updatePaymentTransaction } from "../../transaction.api";
import type { CombinedTransaction, PaymentTransactionWithRelations, TransactionUser } from "../../transaction.types";
import {
  getEditPaymentDefaultValues,
  getEditPaymentPreviewAccount,
  getEditTransactionCategoryOptions,
  getPaymentAccountBalanceBeforeEdit,
} from "./edit-transaction-dialog.utils";

interface EditTransactionDialogProps {
  transaction: PaymentTransactionWithRelations;
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
  } = useForm<UpdatePaymentTransactionInput>({
    resolver: zodResolver(updatePaymentTransactionSchema),
    defaultValues: getEditPaymentDefaultValues(transaction),
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

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return getEditTransactionCategoryOptions(allCategories, transaction.type);
  }, [allCategories, transaction.type]);

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
    return getPaymentAccountBalanceBeforeEdit(selectedAccount, transaction) || null;
  }, [selectedAccount, transaction]);

  const previewAccount = useMemo(() => {
    return getEditPaymentPreviewAccount(selectedAccount, transaction, amount);
  }, [selectedAccount, amount, transaction]);

  const onSubmit = async (data: UpdatePaymentTransactionInput) => {
    onOpenChange(false);
    const balanceDeltas = new Map<string, string>();
    addAccountBalanceDelta(
      balanceDeltas,
      transaction.accountId,
      subtractMoney("0", getPaymentTransactionBalanceDelta(transaction.type, transaction.amount))
    );
    addAccountBalanceDelta(
      balanceDeltas,
      data.accountId ?? transaction.accountId,
      getPaymentTransactionBalanceDelta(transaction.type, data.amount ?? transaction.amount)
    );
    const nextAccount = selectedAccount
      ? {
          id: selectedAccount.id,
          name: selectedAccount.name,
          currency: selectedAccount.currency,
          color: selectedAccount.color,
          icon: selectedAccount.icon,
          ownerId: selectedAccount.ownerId,
          owner: (selectedAccount as Account & { owner?: TransactionUser | null }).owner ?? null,
        }
      : transaction.account;
    const nextCategory =
      data.categoryId === null
        ? null
        : data.categoryId
          ? (allCategories.find((category) => category.id === data.categoryId) ?? transaction.category)
          : transaction.category;
    const optimisticTransaction: CombinedTransaction = {
      kind: "paymentTransaction",
      data: {
        ...transaction,
        accountId: data.accountId ?? transaction.accountId,
        amount: data.amount ?? transaction.amount,
        description: data.description ?? transaction.description,
        date: data.date ?? transaction.date,
        categoryId: nextCategory?.id ?? null,
        updatedAt: new Date(),
        account: nextAccount,
        category: nextCategory,
      },
    };

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["transactions", "accounts"],
        apply: (context) => {
          updateAccountBalancesInCache(context, balanceDeltas);
          updateTransactionsInCache(context, [optimisticTransaction]);
        },
        mutation: () => updatePaymentTransaction(transaction.id, data),
      });

      if (result.error) {
        toast.error(result.error);
      }
    } catch {
      toast.error("Не удалось обновить транзакцию");
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
              <Label htmlFor="amount" required>
                Сумма
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
                        transaction.type === PaymentTransactionType.EXPENSE &&
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
                        transaction.type !== PaymentTransactionType.EXPENSE ||
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
                  transaction.type === PaymentTransactionType.EXPENSE &&
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
