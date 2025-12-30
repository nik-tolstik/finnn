"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createInvite } from "@/modules/workspace/workspace.service";
import { sendInviteEmail } from "@/shared/lib/email";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const inviteSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
});

type InviteInput = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteInput) => {
      const inviteResult = await createInvite(workspaceId, {
        email: data.email,
        expiresInDays: 7,
      });

      if (inviteResult.error) {
        throw new Error(inviteResult.error);
      }

      if (!inviteResult.data) {
        throw new Error("Не удалось создать приглашение");
      }

      const emailResult = await sendInviteEmail(
        data.email,
        inviteResult.data.token,
        workspaceName
      );

      if (emailResult.error) {
        throw new Error(emailResult.error);
      }

      return inviteResult.data;
    },
    onSuccess: () => {
      toast.success("Приглашение отправлено");
      queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
      reset();
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (data: InviteInput) => {
    inviteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Пригласить участника</DialogTitle>
          <DialogDescription>
            Введите email пользователя, которого хотите пригласить в рабочий
            стол &quot;{workspaceName}&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="user@example.com"
              aria-invalid={errors.email ? "true" : "false"}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || inviteMutation.isPending}
            >
              {isSubmitting || inviteMutation.isPending
                ? "Отправка..."
                : "Отправить приглашение"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
