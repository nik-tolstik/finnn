"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

import { AccountSettings } from "./AccountSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = "account";

export function UserSettingsDialog({
  open,
  onOpenChange,
}: UserSettingsDialogProps) {
  const [selectedSection, setSelectedSection] =
    useState<SettingsSection>("account");

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "account", label: "Аккаунт" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-h-screen w-screen max-w-screen m-0 p-0 flex flex-col rounded-none sm:h-[600px] sm:max-h-[600px] sm:w-auto sm:max-w-[900px] sm:m-4 sm:rounded-lg">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 border-b">
          <DialogTitle className="mb-4">Настройки</DialogTitle>
          <div className="flex gap-1 border-b -mb-px">
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
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {selectedSection === "account" && <AccountSettings />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

