"use client";

import type { Account } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { X } from "lucide-react";
import { useMemo } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import type { CreateTransactionInput } from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { type ComboboxOption } from "@/shared/ui/combobox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { getCurrencySymbol } from "@/shared/utils/money";

import { TransactionType } from "../transaction.constants";
import type { TemporaryCategory } from "../transaction.types";

interface TransactionFormProps {
  workspaceId: string;
  form: UseFormReturn<CreateTransactionInput>;
  accounts: Account[];
  allCategories: Array<{
    id: string;
    name: string;
    color: string | null;
    type: string;
  }>;
  temporaryCategories: TemporaryCategory[];
  categoryModalOpen: boolean;
  onCategoryModalOpenChange: (open: boolean) => void;
  onCategorySelect: (option: ComboboxOption) => void;
  onCategorySearch: (searchValue: string) => void;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
}

export function TransactionForm({
  workspaceId,
  form,
  accounts,
  allCategories,
  temporaryCategories,
  categoryModalOpen,
  onCategoryModalOpenChange,
  onCategorySelect,
  onCategorySearch,
  onSubmit,
  type,
}: TransactionFormProps) {
  const transactionAccountId = form.watch("accountId");
  const categoryId = form.watch("categoryId");
  const transactionType = form.watch("type");

  const transactionAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === transactionAccountId);
  }, [accounts, transactionAccountId]);

  const filteredCategories = useMemo(() => {
    return allCategories.filter((cat) => cat.type === transactionType || transactionType === TransactionType.TRANSFER);
  }, [allCategories, transactionType]);

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    const existingOptions: ComboboxOption[] = filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
      color: cat.color || undefined,
      isTemporary: false,
    }));

    const tempOptions: ComboboxOption[] = temporaryCategories
      .filter((temp) => temp.type === transactionType)
      .map((temp) => ({
        value: temp.id,
        label: temp.name,
        color: temp.color,
        isTemporary: true,
      }));

    return [...existingOptions, ...tempOptions];
  }, [filteredCategories, temporaryCategories, transactionType]);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  const handleSubmit = async (data: CreateTransactionInput) => {
    if (!transactionAccount) return;

    const accountCreatedDate = new Date(transactionAccount.createdAt);
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

    await onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <Controller
        control={form.control}
        name="accountId"
        render={({ field }) => (
          <AccountSelector
            workspaceId={workspaceId}
            account={transactionAccount || null}
            onSelect={(account) => {
              field.onChange(account.id);
            }}
            label="Счёт"
            required
            error={form.formState.errors.accountId?.message}
          />
        )}
      />

      <div className="space-y-2">
        <Label htmlFor={`categoryId-${type}`}>Категория</Label>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => onCategoryModalOpenChange(true)}
          >
            {selectedCategory ? (
              <div className="flex items-center gap-2">
                {selectedCategory.color && (
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                )}
                <span className="truncate">{selectedCategory.label}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Выберите или создайте категорию</span>
            )}
          </Button>
          {selectedCategory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                form.setValue("categoryId", undefined);
                form.setValue("newCategory", undefined);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <CategorySelectModal
          open={categoryModalOpen}
          onOpenChange={onCategoryModalOpenChange}
          options={comboboxOptions}
          value={categoryId}
          onSelect={onCategorySelect}
          onSearchChange={onCategorySearch}
          placeholder="Выберите или создайте категорию"
          searchPlaceholder="Поиск или создание категории..."
          emptyText="Введите название для создания новой категории"
          createText="Создать"
        />
        {(form.formState.errors.categoryId || form.formState.errors.newCategory) && (
          <p className="text-sm text-destructive">
            {form.formState.errors.categoryId?.message || form.formState.errors.newCategory?.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`amount-${type}`}>
          Сумма <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          {transactionAccount && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
              {getCurrencySymbol(transactionAccount.currency)}
            </span>
          )}
          <Input
            id={`amount-${type}`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            className={transactionAccount ? "pl-9" : ""}
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
          />
        </div>
        {form.formState.errors.amount && (
          <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${type}`}>Описание</Label>
        <Textarea
          id={`description-${type}`}
          placeholder="Описание транзакции"
          rows={3}
          {...form.register("description")}
        />
      </div>

      <div className="space-y-2">
        <Label>Дата</Label>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <DatePicker
              date={field.value}
              onSelect={field.onChange}
              disabled={(date) => {
                if (!transactionAccount) return false;
                const accountCreatedDate = new Date(transactionAccount.createdAt);
                accountCreatedDate.setHours(0, 0, 0, 0);
                const checkDate = new Date(date);
                checkDate.setHours(0, 0, 0, 0);
                return checkDate < accountCreatedDate;
              }}
            />
          )}
        />
      </div>
    </form>
  );
}
