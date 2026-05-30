"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createWorkspaceInvite } from "@/shared/api/generated/workspaces/workspaces";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogWindow,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const inviteSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
});

const INVITE_MEMBER_FORM_ID = "invite-member-form";

type InviteInput = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ workspaceId, workspaceName, open, onOpenChange }: InviteMemberDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset: _reset,
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteInput) => {
      const inviteResult = await createWorkspaceInvite(workspaceId, {
        email: data.email,
        expiresInDays: 7,
      });

      return inviteResult.invite;
    },
    onSuccess: async () => {
      toast.success("Приглашение отправлено");
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["workspaceMembers"]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: InviteInput) => {
    onOpenChange(false);
    inviteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow className="sm:w-125">
        <DialogHeader>
          <DialogTitle>Пригласить участника</DialogTitle>
          <DialogDescription>
            Введите email пользователя, которого хотите пригласить в рабочий стол &quot;{workspaceName}&quot;.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form id={INVITE_MEMBER_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form={INVITE_MEMBER_FORM_ID} disabled={isSubmitting || inviteMutation.isPending}>
            {isSubmitting || inviteMutation.isPending ? "Отправка..." : "Отправить приглашение"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
