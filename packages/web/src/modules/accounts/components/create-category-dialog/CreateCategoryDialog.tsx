"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
import { createCategory } from "@/modules/categories/category.service";
import { insertCategoriesInCache, runOptimisticWorkspaceMutation } from "@/shared/lib/optimistic-workspace-updates";
import { categoryKeys } from "@/shared/lib/query-keys";
import { type CreateCategoryInput, createCategorySchema } from "@/shared/lib/validations/category";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface CreateCategoryDialogProps {
  workspaceId: string;
  type: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCategoryDialog({ workspaceId, type, open, onOpenChange }: CreateCategoryDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
      type,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        type,
      });
    }
  }, [open, type, reset]);

  const onSubmit = async (data: CreateCategoryInput) => {
    const existingCategories = queryClient.getQueryData<{ data: { id: string; type: string }[] }>(
      categoryKeys.list(workspaceId)
    )?.data;
    const typedCategories = (existingCategories || []).filter((category) => category.type === data.type);
    const nextOrder = typedCategories.length;

    try {
      const optimisticCategory = {
        id: `optimistic-category-${Date.now()}`,
        workspaceId,
        name: data.name,
        type: data.type,
        order: nextOrder,
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["categories", "transactions"],
        apply: (context) => {
          insertCategoriesInCache(context, [optimisticCategory]);
        },
        onApplied: () => {
          onOpenChange(false);
        },
        mutation: () => createCategory(workspaceId, data),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Категория создана");
      }
    } catch {
      toast.error("Не удалось создать категорию");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавить категорию {type === CategoryType.INCOME ? "дохода" : "расхода"}</DialogTitle>
          <DialogDescription>
            Создайте новую категорию для {type === CategoryType.INCOME ? "доходов" : "расходов"}.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" required>
                Название
              </Label>
              <Input
                id="name"
                type="text"
                {...register("name")}
                placeholder="Название категории"
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
