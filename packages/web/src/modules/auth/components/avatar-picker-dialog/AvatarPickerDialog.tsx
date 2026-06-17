"use client";

import { ImagePlusIcon } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { UserAvatar } from "@/shared/components/UserAvatar";
import { USER_AVATAR_GROUP_LABELS, USER_AVATARS, type UserAvatarGroup } from "@/shared/constants/user-avatars";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

import { getAvatarUploadValidationError } from "../../auth.validations";

const avatarSections = (Object.keys(USER_AVATAR_GROUP_LABELS) as UserAvatarGroup[]).map((group) => ({
  group,
  label: USER_AVATAR_GROUP_LABELS[group],
  avatars: USER_AVATARS.filter((avatar) => avatar.group === group),
}));

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedImage: string | null;
  previewName?: string | null;
  previewEmail?: string | null;
  onSelect: (image: string | null) => void | Promise<void>;
  onUpload: (file: File) => Promise<void>;
  uploadPending?: boolean;
}

export function AvatarPickerDialog({
  open,
  onOpenChange,
  selectedImage,
  previewName,
  previewEmail,
  onSelect,
  onUpload,
  uploadPending = false,
}: AvatarPickerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const setPreviewFile = (file: File | null) => {
    setPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return file ? URL.createObjectURL(file) : null;
    });
  };

  const handleSelect = async (image: string | null) => {
    try {
      await onSelect(image);
      onOpenChange(false);
    } catch (error) {
      setUploadError(error instanceof Error && error.message ? error.message : "Не удалось обновить аватар");
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    const validationError = getAvatarUploadValidationError(file);
    if (validationError || !file) {
      setPreviewFile(null);
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    setPreviewFile(file);

    try {
      await onUpload(file);
      setPreviewFile(null);
      onOpenChange(false);
    } catch (error) {
      setUploadError(error instanceof Error && error.message ? error.message : "Не удалось загрузить аватар");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:h-[680px] sm:max-h-[680px] sm:w-[640px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Выберите аватар</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Стандартный</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  title="Аватар с инициалами"
                  aria-label="Аватар с инициалами"
                  aria-pressed={selectedImage === null}
                  onClick={() => void handleSelect(null)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors",
                    selectedImage === null ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <UserAvatar
                    name={previewName}
                    email={previewEmail}
                    image={null}
                    size="xl"
                    fallbackClassName="font-semibold"
                  />
                  <span className="text-[11px] text-center leading-tight text-muted-foreground">Стандартный</span>
                </button>
                <button
                  type="button"
                  title="Загрузить аватар"
                  aria-label="Загрузить аватар"
                  disabled={uploadPending}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors disabled:pointer-events-none disabled:opacity-60",
                    "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                    {previewUrl ? (
                      // biome-ignore lint/performance/noImgElement: Local object URLs cannot be rendered through Next Image.
                      <img src={previewUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <ImagePlusIcon className="size-5" />
                    )}
                  </div>
                  <span className="text-[11px] text-center leading-tight text-muted-foreground">
                    {uploadPending ? "Загрузка..." : "Загрузить"}
                  </span>
                </button>
              </div>
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            </div>

            {avatarSections.map((section) => (
              <div key={section.group} className="space-y-2">
                <p className="text-sm font-medium">{section.label}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {section.avatars.map((avatar) => {
                    const isSelected = selectedImage === avatar.src;

                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        title={avatar.label}
                        aria-label={avatar.label}
                        aria-pressed={isSelected}
                        onClick={() => void handleSelect(avatar.src)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                      >
                        <UserAvatar name={avatar.label} image={avatar.src} size="xl" />
                        <span className="text-[11px] text-center leading-tight text-muted-foreground">
                          {avatar.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
