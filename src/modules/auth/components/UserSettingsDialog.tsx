"use client";

import { useState } from "react";

import { Dialog, DialogWindow, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

import { AccountSettings } from "./AccountSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = "account";

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>("account");

  const sections: { id: SettingsSection; label: string }[] = [{ id: "account", label: "Аккаунт" }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:h-[600px] sm:max-h-[600px] sm:w-[500px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex-1">
          <div className="flex gap-1 border-b mb-4">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  selectedSection === section.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
          {selectedSection === "account" && <AccountSettings />}
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
