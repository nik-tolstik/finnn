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
      <DialogContent className="sm:max-w-[900px] h-[600px] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r bg-muted/30 p-4">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    selectedSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {selectedSection === "account" && <AccountSettings />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

