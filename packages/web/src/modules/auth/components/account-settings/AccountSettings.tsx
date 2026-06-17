"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  requestEmailVerification,
  unlinkGoogle,
  unlinkTelegram,
  updateUser as updateApiUser,
} from "@/shared/api/generated/auth/auth";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession } from "@/shared/lib/api-session-client";
import { bumpUploadedAvatarVersion } from "@/shared/lib/avatar-cache-bust";
import { runOptimisticWorkspaceMutation, updateUserReferencesInCache } from "@/shared/lib/optimistic-workspace-updates";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";

import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from "../../auth.api";
import { type UpdateUserInput, updateUserSchema } from "../../auth.validations";
import { redirectToGoogleLink } from "../../google-auth-url";
import { redirectToTelegramLink } from "../../telegram-auth-url";
import { AvatarPickerDialog } from "../avatar-picker-dialog/AvatarPickerDialog";
import { GoogleAuthButton } from "../google-auth-button";
import { GoogleIcon, TelegramIcon } from "../social-provider-icons";
import { TelegramAuthButton } from "../telegram-auth-button";

interface AccountSettingsProps {
  onSaved?: () => void;
}

export function AccountSettings({ onSaved }: AccountSettingsProps) {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [emailValue, setEmailValue] = useState(session?.user?.email ?? "");
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");

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
      setEmailValue(session.user.email ?? "");
    }
  }, [session?.user, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUserInput) => {
      if (!session?.user?.id) {
        throw new Error("Не авторизован");
      }

      const userPatch = {
        id: session.user.id,
        name: data.name,
        image: data.image,
      };

      return runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId: workspaceId || "user-settings-session",
        domains: workspaceId
          ? ["workspaces", "workspaceMembers", "accounts", "archivedAccounts", "transactions"]
          : ["workspaces"],
        apply: (context) => updateUserReferencesInCache(context, [userPatch]),
        mutation: async () => {
          const result = await updateApiUser(data);
          return { data: result.user };
        },
      });
    },
    onSuccess: async (result) => {
      if (result.data) {
        await updateSession();
        reset({
          name: result.data.name || "",
          image: result.data.image || null,
        });
        onSaved?.();
        toast.success("Настройки сохранены");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось обновить настройки");
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: (file: File) => uploadCurrentUserAvatar(file),
    onSuccess: async (result) => {
      bumpUploadedAvatarVersion(result.user.image);
      await updateSession();
      setValue("image", result.user.image ?? null, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      reset({
        name: result.user.name || "",
        image: result.user.image || null,
      });
      toast.success("Аватар обновлен");
    },
  });

  const avatarDeleteMutation = useMutation({
    mutationFn: () => deleteCurrentUserAvatar(),
    onSuccess: async (result) => {
      await updateSession();
      setValue("image", result.user.image ?? null, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      reset({
        name: result.user.name || "",
        image: result.user.image || null,
      });
      toast.success("Аватар сброшен");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось сбросить аватар");
    },
  });

  const unlinkTelegramMutation = useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: async () => {
      await updateSession();
      toast.success("Telegram отключен");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось отключить Telegram");
    },
  });

  const unlinkGoogleMutation = useMutation({
    mutationFn: unlinkGoogle,
    onSuccess: async () => {
      await updateSession();
      toast.success("Google отключен");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось отключить Google");
    },
  });

  const emailVerificationMutation = useMutation({
    mutationFn: (data: { email: string }) => requestEmailVerification(data),
    onSuccess: async () => {
      await updateSession();
      toast.success("Письмо подтверждения отправлено");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось отправить подтверждение email");
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="email"
                    type="email"
                    value={emailValue}
                    onChange={(event) => setEmailValue(event.target.value)}
                    placeholder="example@mail.com"
                    disabled={emailVerificationMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!emailValue || emailValue === session.user.email || emailVerificationMutation.isPending}
                    className="sm:w-auto"
                    onClick={() => emailVerificationMutation.mutate({ email: emailValue })}
                  >
                    {emailVerificationMutation.isPending ? "Отправка..." : "Подтвердить"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {session.user.emailVerified ? "Email подтвержден" : "Email не подтвержден"}
                </div>
              </div>
            </div>
          </div>

          {errors.image && <p className="text-sm text-destructive">{errors.image.message}</p>}
        </div>

        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-white">
                <GoogleIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">Google</div>
                <div className="truncate text-xs text-muted-foreground">
                  {session.user.google.linked
                    ? session.user.google.email || session.user.google.displayName || "Подключен"
                    : "Не подключен"}
                </div>
              </div>
            </div>
            {session.user.google.linked ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => unlinkGoogleMutation.mutate({})}
                disabled={unlinkGoogleMutation.isPending}
              >
                {unlinkGoogleMutation.isPending ? "Отключение..." : "Отключить"}
              </Button>
            ) : (
              <div className="w-56 max-w-full">
                <GoogleAuthButton
                  disabled={unlinkGoogleMutation.isPending}
                  onClick={() => redirectToGoogleLink("/dashboard")}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-[#229ED9]/10">
                <TelegramIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">Telegram</div>
                <div className="truncate text-xs text-muted-foreground">
                  {session.user.telegram.linked
                    ? session.user.telegram.username
                      ? `@${session.user.telegram.username}`
                      : session.user.telegram.displayName || "Подключен"
                    : "Не подключен"}
                </div>
              </div>
            </div>
            {session.user.telegram.linked ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => unlinkTelegramMutation.mutate({})}
                disabled={unlinkTelegramMutation.isPending}
              >
                {unlinkTelegramMutation.isPending ? "Отключение..." : "Отключить"}
              </Button>
            ) : (
              <div className="w-56 max-w-full">
                <TelegramAuthButton
                  disabled={unlinkTelegramMutation.isPending}
                  onClick={() => redirectToTelegramLink("/dashboard")}
                />
              </div>
            )}
          </div>
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
        onSelect={async (image) => {
          if (image === null) {
            await avatarDeleteMutation.mutateAsync();
            return;
          }

          setValue("image", image, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
        onUpload={async (file) => {
          await avatarUploadMutation.mutateAsync(file);
        }}
        uploadPending={avatarUploadMutation.isPending || avatarDeleteMutation.isPending}
      />
    </>
  );
}
