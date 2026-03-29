"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { type CreateWorkspaceInput, createWorkspaceSchema } from "@/shared/lib/validations/workspace";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { createWorkspace } from "../../workspace.service";
import { generateSlug } from "../../workspace.utils";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset: _reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const nameValue = useWatch({ control, name: "name" });

  useEffect(() => {
    if (nameValue) {
      const slug = generateSlug(nameValue);
      setValue("slug", slug, { shouldValidate: false });
    }
  }, [nameValue, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceInput) => createWorkspace(data),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Рабочий стол успешно создан!");
        onOpenChange(false);
        if (result.data) {
          await invalidateWorkspaceDomains(queryClient, result.data.id, [
            "workspaces",
            "workspaceSummary",
            "workspaceMembers",
          ]);
          router.push(`/dashboard?workspaceId=${result.data.id}`);
        }
      }
    },
  });

  const onSubmit = async (data: CreateWorkspaceInput) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новый рабочий стол</DialogTitle>
          <DialogDescription>Создайте новый рабочий стол для организации ваших финансов</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название рабочего стола</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Мой рабочий стол"
                className="pl-9"
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
            </div>
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Идентификатор</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="slug"
                type="text"
                placeholder="my-workspace"
                className="pl-9 font-mono text-sm"
                {...register("slug")}
                aria-invalid={errors.slug ? "true" : "false"}
              />
            </div>
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            <p className="text-xs text-muted-foreground">Идентификатор генерируется автоматически на основе названия</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || createMutation.isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {isSubmitting || createMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogWindow>
    </Dialog>
  );
}
