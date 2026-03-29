"use client";

import { ChevronDown, LogOut, Settings } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserSettingsDialog } from "@/modules/auth/components/user-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface UserMenuProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function UserMenu({ name, email, image }: UserMenuProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const resolvedName = session?.user?.name ?? name;
  const resolvedEmail = session?.user?.email ?? email;
  const resolvedImage = session?.user?.image ?? image;

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  if (!resolvedName && !resolvedEmail) {
    return null;
  }

  const displayName = resolvedName || resolvedEmail || "User";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center py-1.5 px-2">
          <UserAvatar name={resolvedName} email={resolvedEmail} image={resolvedImage} size="sm" />
          <span className="hidden md:block max-w-[150px] truncate text-sm ml-2">{displayName}</span>
          <ChevronDown className="size-4 text-foreground ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2">
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium">{displayName}</div>
            {resolvedEmail && <div className="text-xs text-muted-foreground truncate">{resolvedEmail}</div>}
          </div>
          <div className="mt-1 border-t px-2 py-3">
            <AppearanceSettings title="Тема" description={null} className="space-y-2" />
          </div>
          <div className="border-t pt-1 space-y-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSettingsDialogOpen(true);
              }}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
              )}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Настройки</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
              )}
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </PopoverContent>
      <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
    </Popover>
  );
}
