"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getWorkspaceSummary, updateWorkspace } from "@/modules/workspace/workspace.api";
import { useSession } from "@/shared/lib/api-session-client";
import { runOptimisticWorkspaceMutation, updateWorkspaceCaches } from "@/shared/lib/optimistic-workspace-updates";
import { workspaceKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const workspaceSettingsSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
});

type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

interface WorkspaceSettingsProps {
  workspaceId: string;
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
    staleTime: 5000,
  });

  const workspace = workspaceData?.data;
  const isOwner = workspace?.ownerId === session?.user?.id;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    formState: { isDirty },
  } = useForm<WorkspaceSettingsInput>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: {
      name: workspace?.name || "",
    },
  });

  useEffect(() => {
    if (workspace) {
      reset({
        name: workspace.name,
      });
    }
  }, [workspace, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: WorkspaceSettingsInput) => {
      return runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["workspaces", "workspaceSummary"],
        apply: (context) =>
          updateWorkspaceCaches(context, {
            id: workspaceId,
            ...data,
          }),
        mutation: () => updateWorkspace(workspaceId, data),
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data && workspace) {
        reset({
          name: result.data.name,
        });
      }
    },
    onError: () => {
      toast.error("Не удалось обновить настройки рабочего стола");
    },
  });

  const onSubmit = (data: WorkspaceSettingsInput) => {
    updateMutation.mutate(data);
  };

  const handleCancel = () => {
    if (workspace) {
      reset({
        name: workspace.name,
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
