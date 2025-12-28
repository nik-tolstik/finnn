"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/shared/lib/validations/workspace";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { createWorkspace } from "../workspace.service";
import { generateSlug } from "../workspace.utils";

export function CreateWorkspacePrompt() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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

  const onSubmit = async (data: CreateWorkspaceInput) => {
    setIsLoading(true);
    try {
      const result = await createWorkspace(data);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Рабочий стол успешно создан!");
      router.refresh();
    } catch {
      toast.error("Что-то пошло не так");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Создайте ваш первый рабочий стол
          </CardTitle>
          <CardDescription>
            Начните с создания рабочего стола для организации ваших финансов
          </CardDescription>
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
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
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
              {errors.slug && (
                <p className="text-sm text-destructive">
                  {errors.slug.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Идентификатор для URL (автоматически генерируется из названия)
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Создание..." : "Создать рабочий стол"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
