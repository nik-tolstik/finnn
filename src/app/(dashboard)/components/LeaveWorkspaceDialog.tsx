"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { leaveWorkspace } from "@/modules/workspace/workspace.service";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";

interface LeaveWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveWorkspaceDialog({ workspaceId, workspaceName, open, onOpenChange }: LeaveWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const leaveMutation = useMutation({
    mutationFn: () => leaveWorkspace(workspaceId),
    onSuccess: async (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      await invalidateWorkspaceDomains(queryClient, workspaceId, [
        "workspaces",
        "workspaceSummary",
        "workspaceMembers",
      ]);
      toast.success("Вы покинули рабочий стол");
      onOpenChange(false);
      router.push("/dashboard");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Не удалось покинуть рабочий стол");
    },
  });

  const handleLeave = () => {
    leaveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Покинуть рабочий стол?</DialogTitle>
          <DialogDescription>
            Вы уверены, что хотите покинуть &quot;{workspaceName}&quot;? Вы потеряете доступ ко всем данным этого
            рабочего стола.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={leaveMutation.isPending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {leaveMutation.isPending ? "Покидание..." : "Покинуть"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
