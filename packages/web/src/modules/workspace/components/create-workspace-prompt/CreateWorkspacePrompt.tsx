"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useSession } from "@/shared/lib/api-session-client";
import { insertWorkspacesInCache, runOptimisticWorkspaceMutation } from "@/shared/lib/optimistic-workspace-updates";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { type CreateWorkspaceInput, createWorkspaceSchema } from "@/shared/lib/validations/workspace";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { createWorkspace } from "../../workspace.api";
import type { WorkspaceWithOwner } from "../../workspace.types";
import { generateSlug } from "../../workspace.utils";

export function CreateWorkspacePrompt() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const nameValue = watch("name");

  useEffect(() => {
    if (nameValue) {
      const slug = generateSlug(nameValue);
      setValue("slug", slug, { shouldValidate: false });
    }
  }, [nameValue, setValue]);

  const createOptimisticWorkspace = (data: CreateWorkspaceInput): WorkspaceWithOwner => {
    const now = new Date();

    return {
      id: `tmp-${Math.random().toString(36).slice(2, 11)}`,
      name: data.name,
      slug: data.slug,
      icon: null,
      baseCurrency: "BYN",
      ownerId: session?.user?.id || "",
      createdAt: now,
      updatedAt: now,
      owner: {
        id: session?.user?.id || "",
        name: session?.user?.name || null,
        email: session?.user?.email || "",
        image: session?.user?.image || null,
      },
      _count: {
        members: 1,
      },
    };
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceInput) => {
      const optimisticWorkspace = createOptimisticWorkspace(data);

      return runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId: optimisticWorkspace.id,
        domains: ["workspaces"],
        apply: (context) => insertWorkspacesInCache(context, [optimisticWorkspace]),
        mutation: () => createWorkspace(data),
      });
    },
    onSuccess: async (result) => {
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Рабочий стол успешно создан!");
      if (result?.data) {
        await invalidateWorkspaceDomains(queryClient, result.data.id, [
          "workspaces",
          "workspaceSummary",
          "workspaceMembers",
        ]);
        router.push(`/dashboard?workspaceId=${result.data.id}`);
      }
    },
    onError: () => {
      toast.error("Что-то пошло не так");
    },
  });

  const onSubmit = async (data: CreateWorkspaceInput) => {
    createMutation.mutate(data);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Создайте ваш первый рабочий стол</CardTitle>
          <CardDescription>Начните с создания рабочего стола для организации ваших финансов</CardDescription>
        </CardHeader>
        <CardContent>
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
                  className="pl-9"
                  {...register("slug")}
                  aria-invalid={errors.slug ? "true" : "false"}
                />
              </div>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              <p className="text-xs text-muted-foreground">
                Идентификатор для URL (автоматически генерируется из названия)
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Создание..." : "Создать рабочий стол"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
