import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createCategory } from "@/modules/categories/category.api";
import { CategoryType } from "@/modules/categories/category.constants";
import { CategoryIconPicker } from "@/shared/components/category-icon-picker";
import { insertCategoriesInCache, runOptimisticWorkspaceMutation } from "@/shared/lib/optimistic-workspace-updates";
import { categoryKeys } from "@/shared/lib/query-keys";
import { type CreateCategoryInput, createCategorySchema } from "@/shared/lib/validations/category";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
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
  const nameInputId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset,
    setValue,
    control,
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      type,
      icon: null,
      iconAssetId: null,
    },
  });
  const selectedIcon = useWatch({ control, name: "icon" });
  const selectedIconAssetId = useWatch({ control, name: "iconAssetId" });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        type,
        icon: null,
        iconAssetId: null,
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
        icon: data.icon ?? null,
        iconAssetId: data.iconAssetId ?? null,
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
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameInputId} required>
                Название
              </Label>
              <div className="flex items-start gap-3">
                <CategoryIconPicker
                  workspaceId={workspaceId}
                  value={{
                    icon: selectedIcon ?? null,
                    iconAssetId: selectedIconAssetId ?? null,
                  }}
                  onChange={(selection) => {
                    setValue("icon", selection.icon, { shouldValidate: true });
                    setValue("iconAssetId", selection.iconAssetId, { shouldValidate: true });
                  }}
                  className="border-0 bg-transparent hover:border-0 hover:bg-accent"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id={nameInputId}
                    type="text"
                    {...register("name")}
                    placeholder="Название категории"
                    aria-invalid={errors.name ? "true" : "false"}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
              </div>
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={!isValid || isSubmitting} size="xl">
            {isSubmitting ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
