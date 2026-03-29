"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { UserAvatar } from "@/shared/components/UserAvatar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";

import { updateUser } from "../../auth.service";
import { type UpdateUserInput, updateUserSchema } from "../../auth.validations";
import { AvatarPickerDialog } from "../avatar-picker-dialog/AvatarPickerDialog";

interface AccountSettingsProps {
  onSaved?: () => void;
}

export function AccountSettings({ onSaved }: AccountSettingsProps) {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    watch,
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as any,
    defaultValues: {
      name: session?.user?.name || "",
      image: session?.user?.image || null,
    },
  });

  const selectedImage = watch("image");
  const currentName = watch("name");

  useEffect(() => {
    if (session?.user) {
      reset({
        name: session.user.name || "",
        image: session.user.image || null,
      });
    }
  }, [session?.user, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserInput) => updateUser(data),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        await updateSession();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["user"] }),
          queryClient.invalidateQueries({ queryKey: ["accounts"] }),
          queryClient.invalidateQueries({ queryKey: ["transactions"] }),
          queryClient.invalidateQueries({ queryKey: ["workspace"] }),
          queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        ]);
        reset({
          name: result.data.name || "",
          image: result.data.image || null,
        });
        onSaved?.();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось обновить настройки");
    },
  });

  const onSubmit = (data: UpdateUserInput) => {
    updateMutation.mutate({
      name: data.name,
      image: data.image,
    });
  };

  const showActions = isDirty;

  const handleCancel = () => {
    if (session?.user) {
      reset({
        name: session.user.name || "",
        image: session.user.image || null,
      });
    }
  };

  if (!session?.user) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>;
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit as any, (formErrors) => {
          const validationMessage = formErrors.name?.message || formErrors.image?.message;
          if (validationMessage) {
            toast.error(validationMessage);
          }
        })}
        className="space-y-5"
      >
        <div className="rounded-xl space-y-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setAvatarDialogOpen(true)}
              className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Выбрать аватар"
            >
              <UserAvatar
                name={currentName}
                email={session.user.email}
                image={selectedImage}
                size="2xl"
                fallbackClassName="font-semibold"
              />
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-xs font-medium text-white opacity-0 transition-all",
                  "group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100"
                )}
              >
                Выбрать
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Ваше имя"
                  aria-invalid={errors.name ? "true" : "false"}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Почта</Label>
                <Input
                  id="email"
                  type="email"
                  value={session.user.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {errors.image && <p className="text-sm text-destructive">{errors.image.message}</p>}
        </div>

        <div className="flex min-h-9 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={!showActions || isSubmitting || updateMutation.isPending}
            aria-hidden={!showActions}
            className={cn(!showActions && "invisible pointer-events-none")}
          >
            Отменить
          </Button>
          <Button
            type="submit"
            disabled={!showActions || isSubmitting || updateMutation.isPending}
            aria-hidden={!showActions}
            className={cn(!showActions && "invisible pointer-events-none")}
          >
            {isSubmitting || updateMutation.isPending ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </form>

      <AvatarPickerDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        selectedImage={selectedImage}
        previewName={currentName}
        previewEmail={session.user.email}
        onSelect={(image) => {
          setValue("image", image, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
      />
    </>
  );
}
