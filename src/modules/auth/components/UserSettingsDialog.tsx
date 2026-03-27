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
      <DialogWindow className="flex flex-col rounded-none sm:max-h-[420px] sm:w-[560px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <DialogContent className="overflow-y-auto">
          <AccountSettings onSaved={() => onOpenChange(false)} />
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
