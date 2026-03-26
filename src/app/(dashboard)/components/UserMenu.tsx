"use client";

import { LogOut, Settings } from "lucide-react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

import { UserSettingsDialog } from "@/modules/auth/components/UserSettingsDialog";
import { Button } from "@/shared/ui/button";
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

  if (!resolvedName && !resolvedEmail && !resolvedImage) {
    return null;
  }

  const displayName = resolvedName || resolvedEmail || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 p-0 hover:bg-accent">
          {resolvedImage ? (
            <Image
              src={resolvedImage}
              alt={displayName}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {initials}
            </div>
          )}
          <span className="hidden md:block max-w-[150px] truncate text-sm">{displayName}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <div className="p-2">
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium">{displayName}</div>
            {resolvedEmail && <div className="text-xs text-muted-foreground truncate">{resolvedEmail}</div>}
          </div>
          <div className="mt-1 border-t pt-1 space-y-1">
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
