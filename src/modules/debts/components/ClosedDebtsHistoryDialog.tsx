"use client";

import { useQuery } from "@tanstack/react-query";

import { AnimatedListItem } from "@/shared/ui/animated-list";
import { Dialog, DialogWindow, DialogHeader, DialogTitle, DialogContent } from "@/shared/ui/dialog";

import { DebtStatus } from "../debt.constants";
import { getDebts } from "../debt.service";

import { DebtCard } from "./DebtCard";

interface ClosedDebtsHistoryDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function ClosedDebtsHistoryDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
}: ClosedDebtsHistoryDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["debts", workspaceId, "closed"],
    queryFn: () => getDebts(workspaceId, { status: DebtStatus.CLOSED }),
    enabled: open,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const closedDebts = data?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete} className="max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>История закрытых долгов</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : closedDebts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Закрытых долгов пока нет</p>
            </div>
          ) : (
            <div className="space-y-3">
              {closedDebts.map((debt) => (
                <AnimatedListItem key={debt.id}>
                  <DebtCard debt={debt} />
                </AnimatedListItem>
              ))}
            </div>
          )}
        </DialogContent>
      </DialogWindow>
    </Dialog>
  );
}
