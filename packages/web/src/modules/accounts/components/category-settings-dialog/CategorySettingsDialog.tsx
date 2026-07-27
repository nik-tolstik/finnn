"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

import { CategoryManagement } from "../category-management/CategoryManagement";

interface CategorySettingsDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategorySettingsDialog({ workspaceId, open, onOpenChange }: CategorySettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col rounded-none sm:h-[600px] sm:max-h-[600px] sm:w-[500px] sm:m-4 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Настройки категорий</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex-1">
          <CategoryManagement workspaceId={workspaceId} />
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
