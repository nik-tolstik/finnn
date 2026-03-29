"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { cn } from "@/shared/utils/cn";

import { CategoryManagement } from "../category-management/CategoryManagement";
import { MembersManagement } from "../members-management/MembersManagement";
import { WorkspaceSettings } from "../workspace-settings/WorkspaceSettings";

interface SettingsDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = "workspace" | "categories" | "members";

export function SettingsDialog({ workspaceId, open, onOpenChange }: SettingsDialogProps) {
  const [selectedSection, setSelectedSection] = useState<SettingsSection>("workspace");

  const sections: { id: SettingsSection; label: string }[] = [
    { id: "workspace", label: "Workspace" },
    { id: "categories", label: "Категории" },
    { id: "members", label: "Участники" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:h-[600px] sm:max-h-[600px] sm:w-[500px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="mb-4">Настройки</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b mb-4 px-6">
          {sections.map((section) => (
            <button
              type="button"
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
        <DialogContent className="flex-1">
          {selectedSection === "workspace" && <WorkspaceSettings workspaceId={workspaceId} />}
          {selectedSection === "categories" && <CategoryManagement workspaceId={workspaceId} />}
          {selectedSection === "members" && <MembersManagement workspaceId={workspaceId} />}
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
