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
      <DialogWindow className="flex min-h-0 flex-col sm:m-4 sm:h-[600px] sm:max-h-[600px] sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Настройки категорий</DialogTitle>
        </DialogHeader>
        <DialogContent className="min-h-0 flex-1 overflow-y-auto">
          <CategoryManagement workspaceId={workspaceId} />
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
