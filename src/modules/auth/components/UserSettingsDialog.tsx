"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { AccountSettings } from "./AccountSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:h-[600px] sm:max-h-[600px] sm:w-[500px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex-1">
          <AccountSettings />
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
