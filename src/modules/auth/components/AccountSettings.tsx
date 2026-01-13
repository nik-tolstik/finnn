"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

import { updateUser } from "../auth.service";
import { updateUserSchema, type UpdateUserInput } from "../auth.validations";

export function AccountSettings() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [useUploadthing, setUseUploadthing] = useState(false);

  const { startUpload, isUploading } = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setValue("image", res[0].url, { shouldDirty: true });
        setPreview(res[0].url);
      }
      setUploading(false);
    },
    onUploadError: (error: Error) => {
      toast.error(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setValue,
    control,
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as any,
    defaultValues: {
      name: session?.user?.name || "",
      image: session?.user?.image || null,
    },
  });

  const currentImage = useWatch({ control, name: "image" });

  useEffect(() => {
    const checkUploadMethod = async () => {
      try {
        const response = await fetch("/api/upload/config");
        const data = await response.json();
        setUseUploadthing(data.useUploadthing || false);
      } catch {
        setUseUploadthing(false);
      }
    };
    checkUploadMethod();
  }, []);

  useEffect(() => {
    if (session?.user) {
      const initialImage = session.user.image || null;
      reset({
        name: session.user.name || "",
        image: initialImage,
      });
      setPreview(initialImage);
    }
  }, [session?.user, reset]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Файл должен быть изображением");
      return;
    }

    const maxSize = useUploadthing ? 4 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Размер файла не должен превышать ${maxSize / 1024 / 1024}MB`);
      return;
    }

    setUploading(true);

    if (useUploadthing) {
      await startUpload([file]);
    } else {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/avatar", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.error) {
          toast.error(result.error);
          setUploading(false);
          return;
        }

        setValue("image", result.url, { shouldDirty: true });
        setPreview(result.url);
        setUploading(false);
      } catch (error: any) {
        toast.error(error.message || "Не удалось загрузить аватар");
        setUploading(false);
      }
    }
  };

  const handleRemoveAvatar = () => {
    setValue("image", null, { shouldDirty: true });
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
            image: result.data.image ?? null,
          } as UpdateUserInput);
          setPreview(result.data.image ?? null);
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось обновить настройки");
    },
  });

  const onSubmit = (data: UpdateUserInput) => {
    const submitData: UpdateUserInput = {
      name: data.name,
      image: data.image ?? null,
    };
    updateMutation.mutate(submitData);
  };

  const handleCancel = () => {
    if (session?.user) {
      reset({
        name: session.user.name || "",
        image: session.user.image || null,
      });
      setPreview(session.user.image || null);
    }
  };

  if (!session?.user) {
    return <div className="text-sm text-muted-foreground">Загрузка...</div>;
  }

  const isFormChanged = isDirty;
  const displayImage = preview || currentImage;

  return (
    <form
      onSubmit={handleSubmit(onSubmit as any, (errors) => {
        if (errors.image) {
          toast.error(errors.image.message || "Ошибка валидации изображения");
        }
        if (errors.name) {
          toast.error(errors.name.message || "Ошибка валидации имени");
        }
      })}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Аватар</Label>
        <div className="flex items-center gap-4">
          <div className="relative">
            {displayImage ? (
              <Image
                src={displayImage}
                alt="Аватар"
                width={80}
                height={80}
                className="h-20 w-20 rounded-full object-cover border-2 border-border"
                unoptimized
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-medium border-2 border-border">
                {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            {displayImage && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isUploading}
            >
              <Camera className="h-4 w-4 mr-2" />
              {uploading || isUploading ? "Загрузка..." : displayImage ? "Изменить" : "Загрузить"}
            </Button>
            {displayImage && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemoveAvatar}>
                Удалить
              </Button>
            )}
          </div>
        </div>
      </div>

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
