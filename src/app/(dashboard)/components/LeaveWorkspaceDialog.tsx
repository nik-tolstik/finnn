"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { leaveWorkspace } from "@/modules/workspace/workspace.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

interface LeaveWorkspaceDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveWorkspaceDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: LeaveWorkspaceDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const leaveMutation = useMutation({
    mutationFn: () => leaveWorkspace(workspaceId),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Покинуть рабочий стол?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уверены, что хотите покинуть "{workspaceName}"? Вы потеряете доступ ко всем данным этого рабочего стола.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leaveMutation.isPending}>
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {leaveMutation.isPending ? "Покидание..." : "Покинуть"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

