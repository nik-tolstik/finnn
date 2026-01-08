"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { AccountCard } from "@/shared/components/AccountCard";
import { updateAccountSchema, type UpdateAccountInput } from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import {
  Dialog,
  DialogWindow,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { CATEGORY_COLORS } from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/cn";

import { updateAccount } from "../account.service";

interface EditAccountDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
  onCancel?: () => void;
}

export function EditAccountDialog({ account, open, onOpenChange, onCloseComplete, onCancel }: EditAccountDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    setValue,
  } = useForm<UpdateAccountInput>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      name: account.name,
      color: account.color || undefined,
      icon: account.icon || "Wallet",
      createdAt: new Date(account.createdAt),
    },
  });

  const selectedColor = useWatch({ control, name: "color" });
  const selectedIcon = useWatch({ control, name: "icon" });
  const accountName = useWatch({ control, name: "name" });

  useEffect(() => {
    if (open) {
      reset({
        name: account.name,
        color: account.color || undefined,
        icon: account.icon || "Wallet",
        createdAt: new Date(account.createdAt),
      });
    }
  }, [account.id, account.name, account.color, account.icon, account.createdAt, open, reset]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onCancel?.();
    }
  };

  const onSubmit = async (data: UpdateAccountInput) => {
    onOpenChange(false);
    const result = await updateAccount(account.id, data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Счёт успешно обновлён");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["accounts", account.workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions", account.workspaceId],
        }),
      ]);
      router.refresh();
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Редактировать счёт</DialogTitle>
          <DialogDescription>Измените параметры счёта.</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form className="space-y-4">
            <AccountCard
              account={{
                ...account,
                name: accountName || account.name,
                color: selectedColor || account.color,
                icon: selectedIcon || account.icon || "Wallet",
                owner: (account as any).owner,
              }}
            />
            <div className="space-y-2">
              <Label htmlFor="name">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                {...register("name")}
                placeholder="Название счёта"
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue("color", color)}
                    className={cn(
                      "h-8 w-8 rounded-md border-2 transition-all",
                      selectedColor === color ? "border-primary scale-110" : "border-border hover:border-primary/50"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Иконка</Label>
              <div className="flex gap-2">
                {Object.entries(ACCOUNT_ICONS).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setValue("icon", name)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all",
                      selectedIcon === name ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                    title={name}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
              {errors.icon && <p className="text-sm text-destructive">{errors.icon.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="createdAt">
                Дата открытия счета <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="createdAt"
                render={({ field }) => <DatePicker date={field.value} onSelect={field.onChange} />}
              />
              {errors.createdAt && <p className="text-sm text-destructive">{errors.createdAt.message}</p>}
            </div>
          </form>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCancel?.();
            }}
          >
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
