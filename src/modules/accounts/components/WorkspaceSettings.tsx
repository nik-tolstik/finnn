"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Wallet, HandCoins, CreditCard, Landmark, type LucideIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getWorkspace, updateWorkspace } from "@/modules/workspace/workspace.service";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} as const;

const workspaceSettingsSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  icon: z.string().optional().nullable(),
});

type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

interface WorkspaceSettingsProps {
  workspaceId: string;
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const workspace = workspaceData?.data;
  const isOwner = workspace?.ownerId === session?.user?.id;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    control,
    reset,
    formState: { isDirty },
  } = useForm<WorkspaceSettingsInput>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: {
      name: workspace?.name || "",
      icon: workspace?.icon || null,
    },
  });

  useEffect(() => {
    if (workspace) {
      reset({
        name: workspace.name,
        icon: workspace.icon || null,
      });
    }
  }, [workspace, reset]);

  const selectedIcon = useWatch({ control, name: "icon" });

  const updateMutation = useMutation({
    mutationFn: (data: WorkspaceSettingsInput) => updateWorkspace(workspaceId, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Настройки workspace обновлены");
        queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        if (workspace) {
          reset({
            name: result.data?.name || workspace.name,
            icon: result.data?.icon || workspace.icon || null,
          });
        }
      }
    },
  });

  const onSubmit = (data: WorkspaceSettingsInput) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    if (workspace) {
      reset({
        name: workspace.name,
        icon: workspace.icon || null,
      });
    }
  };

  if (!workspace) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>;
  }

  const isFormChanged = isDirty;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Название workspace"
          disabled={!isOwner}
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Иконка</Label>
        <div className="flex gap-2">
          {Object.entries(WORKSPACE_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                setValue("icon", selectedIcon === name ? null : name, {
                  shouldDirty: true,
                })
              }
              disabled={!isOwner}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all",
                selectedIcon === name ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                !isOwner && "opacity-50 cursor-not-allowed"
              )}
              title={name}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {!isOwner && <p className="text-sm text-muted-foreground">Только владелец может изменять настройки workspace</p>}

      {isOwner && isFormChanged && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting || updateMutation.isPending}
          >
            Отменить
          </Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
            {isSubmitting || updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      )}
    </form>
  );
}
