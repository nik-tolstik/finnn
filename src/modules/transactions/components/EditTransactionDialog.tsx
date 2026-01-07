"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getCategories } from "@/modules/categories/category.service";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import {
  updateTransactionSchema,
  type UpdateTransactionInput,
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
  DialogContent,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import { updateTransaction } from "../transaction.service";
import type { TransactionWithRelations } from "../transaction.types";

interface EditTransactionDialogProps {
  transaction: TransactionWithRelations;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({
  transaction,
  workspaceId,
  open,
  onOpenChange,
}: EditTransactionDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<UpdateTransactionInput>({
    resolver: zodResolver(updateTransactionSchema),
    defaultValues: {
      amount: transaction.amount,
      description: transaction.description || "",
      date: new Date(transaction.date),
      categoryId: transaction.categoryId || null,
    },
  });

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
      (cat) => cat.type === transaction.type || transaction.type === TransactionType.TRANSFER
    );
  }, [allCategories, transaction.type]);

  // Опции для Combobox
  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    return filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
      color: cat.color || undefined,
      isTemporary: false,
    }));
  }, [filteredCategories]);

  const categoryId = useWatch({ control, name: "categoryId" });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  useEffect(() => {
    if (open) {
      reset({
        amount: transaction.amount,
        description: transaction.description || "",
        date: new Date(transaction.date),
        categoryId: transaction.categoryId || null,
      });
    }
  }, [transaction, open, reset]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: UpdateTransactionInput) => {
    const result = await updateTransaction(transaction.id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Транзакция успешно обновлена");
      reset();
      onOpenChange(false);
      // Инвалидируем кэш транзакций для обновления списка
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      // Инвалидируем кэш счетов для обновления баланса
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      router.refresh();
    }
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    setValue("categoryId", option.value || null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow
        key={open ? transaction.id : "closed"}
        className="sm:w-[500px]"
      >
        <DialogHeader>
          <DialogTitle>Редактировать транзакцию</DialogTitle>
          <DialogDescription>Измените данные транзакции.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Сумма <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
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
                      Выберите категорию
                    </span>
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
              {errors.categoryId && (
                <p className="text-sm text-destructive">
                  {errors.categoryId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Дата</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker date={field.value} onSelect={field.onChange} />
                )}
              />
              {errors.date && (
                <p className="text-sm text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
