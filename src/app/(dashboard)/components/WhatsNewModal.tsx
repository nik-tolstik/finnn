"use client";

import { Dialog, DialogWindow, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";

import { CHANGELOG_ENTRIES } from "@/shared/constants/changelog";

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsNewModal({ open, onOpenChange }: WhatsNewModalProps) {
  const latest = CHANGELOG_ENTRIES[CHANGELOG_ENTRIES.length - 1];

  if (!latest) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="flex flex-col sm:max-h-[80vh] sm:w-[500px] sm:m-4">
        <DialogHeader>
          <DialogTitle>Что нового</DialogTitle>
        </DialogHeader>
        <DialogContent className="flex-1 overflow-y-auto">
          <div className="text-sm text-muted-foreground mb-4">
            v{latest.version} · {latest.date}
          </div>
          {latest.features.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Новые возможности</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {latest.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            </div>
          )}
          {latest.fixes && latest.fixes.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Исправления</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {latest.fixes.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
