import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { AccountSettings } from "../account-settings/AccountSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex min-h-0 flex-col sm:m-4 sm:max-h-[420px] sm:w-[560px]">
        <DialogHeader>
          <DialogTitle>Профиль</DialogTitle>
        </DialogHeader>
        <DialogContent className="min-h-0 flex-1 overflow-y-auto">
          <AccountSettings onSaved={() => onOpenChange(false)} />
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
