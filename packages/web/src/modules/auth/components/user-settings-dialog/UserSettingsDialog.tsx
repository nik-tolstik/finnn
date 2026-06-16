"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/shared/lib/api-session-client";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { AccountSettings } from "../account-settings/AccountSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const handleLogout = async () => {
    onOpenChange(false);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:max-h-[420px] sm:w-[560px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <DialogContent className="overflow-y-auto">
          <AccountSettings onSaved={() => onOpenChange(false)} />
        </DialogContent>
        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="destructive" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span>Log Out</span>
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
