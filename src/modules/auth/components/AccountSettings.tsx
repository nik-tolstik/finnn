"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { updateUser } from "../auth.service";
import { type UpdateUserInput, updateUserSchema } from "../auth.validations";

export function AccountSettings() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as any,
    defaultValues: {
      name: session?.user?.name || "",
    },
  });

  useEffect(() => {
    if (session?.user) {
      reset({
        name: session.user.name || "",
      });
    }
  }, [session?.user, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserInput) => updateUser(data),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.data) {
          await updateSession();
          queryClient.invalidateQueries({ queryKey: ["user"] });
          reset({
            name: result.data.name,
          } as UpdateUserInput);
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось обновить настройки");
    },
  });

  const onSubmit = (data: UpdateUserInput) => {
    updateMutation.mutate({
      name: data.name,
    });
  };

  const handleCancel = () => {
    if (session?.user) {
      reset({
        name: session.user.name || "",
      });
    }
  };

  if (!session?.user) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>;
  }

  const isFormChanged = isDirty;

  return (
    <form
      onSubmit={handleSubmit(onSubmit as any, (errors) => {
        if (errors.name) {
          toast.error(errors.name.message || "Ошибка валидации имени");
        }
      })}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Имя</Label>
        <Input id="name" {...register("name")} placeholder="Ваше имя" aria-invalid={errors.name ? "true" : "false"} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={session.user.email} disabled className="bg-muted cursor-not-allowed" />
        <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
      </div>

      {isFormChanged && (
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
