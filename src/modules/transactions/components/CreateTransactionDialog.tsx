"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useState, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
import { getCategories } from "@/modules/categories/category.service";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import {
  createTransactionSchema,
  type CreateTransactionInput,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { type ComboboxOption } from "@/shared/ui/combobox";
import { DatePicker } from "@/shared/ui/date-picker";
import {
  Dialog,
  DialogWindow,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { Textarea } from "@/shared/ui/textarea";
import { generateRandomColor } from "@/shared/utils/category-colors";
import { getCurrencySymbol } from "@/shared/utils/money";

import { TransactionType } from "../transaction.constants";
import { createTransaction } from "../transaction.service";
import type { TemporaryCategory } from "../transaction.types";

interface CreateTransactionDialogProps {
  account: Account;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTransactionDialog({
  account,
  workspaceId,
  open,
  onOpenChange,
}: CreateTransactionDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      accountId: account.id,
      amount: "",
      type: TransactionType.EXPENSE,
      description: "",
      date: (() => {
        const accountCreatedDate = new Date(account.createdAt);
        accountCreatedDate.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now < accountCreatedDate ? accountCreatedDate : now;
      })(),
      categoryId: undefined,
    },
  });

  const transactionType = useWatch({ control, name: "type" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const [temporaryCategories, setTemporaryCategories] = useState<
    TemporaryCategory[]
  >([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
    enabled: open,
  });

  const allCategories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData?.data]);

  // Фильтруем категории по типу транзакции
  const filteredCategories = useMemo(() => {
    return allCategories.filter(
      (cat) =>
        cat.type === transactionType ||
        transactionType === TransactionType.TRANSFER
    );
  }, [allCategories, transactionType]);

  // Объединяем существующие и временные категории для Combobox
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

  useEffect(() => {
    if (open) {
      const accountCreatedDate = new Date(account.createdAt);
      accountCreatedDate.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const defaultDate = now < accountCreatedDate ? accountCreatedDate : now;
      reset({
        accountId: account.id,
        amount: "",
        type: TransactionType.EXPENSE,
        description: "",
        date: defaultDate,
        categoryId: undefined,
        newCategory: undefined,
      });
      setTemporaryCategories([]);
    }
  }, [account.id, account.createdAt, open, reset]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateTransactionInput) => {
    const accountCreatedDate = new Date(account.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);
    const transactionDate = new Date(data.date);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate < accountCreatedDate) {
      toast.error(
        `Дата транзакции не может быть раньше даты создания счета (${format(
          accountCreatedDate,
          "dd.MM.yyyy",
          { locale: ru }
        )})`
      );
      return;
    }

    const result = await createTransaction(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Транзакция успешно создана");
      reset();
      setTemporaryCategories([]);
      onOpenChange(false);
      // Инвалидируем кэш транзакций для обновления списка
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      // Инвалидируем кэш счетов для обновления баланса
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      // Инвалидируем кэш категорий, если была создана новая категория
      if (data.newCategory) {
        await queryClient.invalidateQueries({
          queryKey: ["categories", workspaceId],
        });
      }
      router.refresh();
    }
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    if (option.isTemporary) {
      // Если выбрана временная категория, сохраняем информацию в newCategory
      // и устанавливаем categoryId в временный ID для отображения
      const tempCategory = temporaryCategories.find(
        (temp) => temp.id === option.value
      );
      if (tempCategory) {
        setValue("newCategory", {
          name: tempCategory.name,
          color: tempCategory.color,
          type:
            tempCategory.type === TransactionType.INCOME
              ? CategoryType.INCOME
              : CategoryType.EXPENSE,
        });
        setValue("categoryId", option.value);
      }
    } else {
      // Если выбрана существующая категория, используем её ID
      setValue("categoryId", option.value);
      setValue("newCategory", undefined);
    }
  };

  const handleCategorySearch = (searchValue: string) => {
    if (!searchValue.trim()) {
      return;
    }

    // Проверяем, существует ли категория с таким именем
    const exists = allCategories.some(
      (cat) => cat.name.toLowerCase() === searchValue.toLowerCase()
    );

    // Если категории нет и она ещё не создана как временная
    if (
      !exists &&
      !temporaryCategories.some(
        (temp) =>
          temp.name.toLowerCase() === searchValue.toLowerCase() &&
          temp.type === transactionType
      )
    ) {
      // Создаём временную категорию
      const newTempCategory: TemporaryCategory = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: searchValue.trim(),
        color: generateRandomColor(),
        type: transactionType as
          | TransactionType.INCOME
          | TransactionType.EXPENSE,
        isTemporary: true,
      };
      setTemporaryCategories((prev) => [...prev, newTempCategory]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow key={open ? account.id : "closed"} className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавить транзакцию</DialogTitle>
          <DialogDescription>
            Создайте новую транзакцию для счёта &quot;{account.name}&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">
              Тип транзакции <span className="text-destructive">*</span>
            </Label>
            <Select<TransactionType>
              options={[
                { value: TransactionType.INCOME, label: "Доход" },
                { value: TransactionType.EXPENSE, label: "Расход" },
              ]}
              value={transactionType}
              onChange={(value) => setValue("type", value)}
              placeholder="Выберите тип"
              multiple={false}
            />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
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
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                    )}
                    <span className="truncate">{selectedCategory.label}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    Выберите или создайте категорию
                  </span>
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
              onSearchChange={handleCategorySearch}
              placeholder="Выберите или создайте категорию"
              searchPlaceholder="Поиск или создание категории..."
              emptyText="Введите название для создания новой категории"
              createText="Создать"
            />
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                {getCurrencySymbol(account.currency)}
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
            {errors.amount && (
              <p className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
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
                <DatePicker
                  date={field.value}
                  onSelect={field.onChange}
                  disabled={(date) => {
                    const accountCreatedDate = new Date(account.createdAt);
                    accountCreatedDate.setHours(0, 0, 0, 0);
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);
                    return checkDate < accountCreatedDate;
                  }}
                />
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
              {isSubmitting ? "Создание..." : "Создать транзакцию"}
            </Button>
          </DialogFooter>
        </form>
      </DialogWindow>
    </Dialog>
  );
}
