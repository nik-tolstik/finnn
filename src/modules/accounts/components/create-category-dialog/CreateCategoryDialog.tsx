"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { CategoryType } from "@/modules/categories/category.constants";
import { createCategory } from "@/modules/categories/category.service";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
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

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) => createCategory(workspaceId, data),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        await invalidateWorkspaceDomains(queryClient, workspaceId, ["categories", "transactions"]);
        onOpenChange(false);
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
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting || createMutation.isPending}>
            {isSubmitting || createMutation.isPending ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
