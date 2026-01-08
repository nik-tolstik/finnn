"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
import { createCategory } from "@/modules/categories/category.service";
import { createCategorySchema, type CreateCategoryInput } from "@/shared/lib/validations/category";
import { Button } from "@/shared/ui/button";
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
import { CATEGORY_COLORS } from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/cn";

interface CreateCategoryDialogProps {
  workspaceId: string;
  type: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCategoryDialog({ workspaceId, type, open, onOpenChange }: CreateCategoryDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
      type,
      color: CATEGORY_COLORS[0],
    },
  });

  const selectedColor = useWatch({ control, name: "color" });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        type,
        color: CATEGORY_COLORS[0],
      });
    }
  }, [open, type, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) => createCategory(workspaceId, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Категория создана");
        queryClient.invalidateQueries({
          queryKey: ["categories", workspaceId],
        });
        reset();
        onOpenChange(false);
        router.refresh();
      }
    },
  });

  const onSubmit = async (data: CreateCategoryInput) => {
    createMutation.mutate(data);
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
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Название <span className="text-destructive">*</span>
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

            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue("color", color)}
                    className={cn(
                      "h-8 w-8 rounded-md border-2 transition-all",
                      selectedColor === color ? "border-primary scale-110" : "border-border hover:border-primary/50"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting || createMutation.isPending}>
            {isSubmitting || createMutation.isPending ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
