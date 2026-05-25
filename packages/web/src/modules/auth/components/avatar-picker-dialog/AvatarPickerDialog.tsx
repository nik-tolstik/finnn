"use client";

import { UserAvatar } from "@/shared/components/UserAvatar";
import { USER_AVATAR_GROUP_LABELS, USER_AVATARS, type UserAvatarGroup } from "@/shared/constants/user-avatars";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

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
  onSelect: (image: string | null) => void;
}

export function AvatarPickerDialog({
  open,
  onOpenChange,
  selectedImage,
  previewName,
  previewEmail,
  onSelect,
}: AvatarPickerDialogProps) {
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
                <button
                  type="button"
                  title="Аватар с инициалами"
                  aria-label="Аватар с инициалами"
                  aria-pressed={selectedImage === null}
                  onClick={() => {
                    onSelect(null);
                    onOpenChange(false);
                  }}
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
              </div>
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
                        onClick={() => {
                          onSelect(avatar.src);
                          onOpenChange(false);
                        }}
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
