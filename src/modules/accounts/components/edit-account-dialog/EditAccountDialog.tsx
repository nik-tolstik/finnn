"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { workspaceKeys } from "@/shared/lib/query-keys";
import { type UpdateAccountInput, updateAccountSchema } from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerFormatSelect,
  ColorPickerInput,
  ColorPickerTrigger,
} from "@/shared/ui/color-picker";
import { DatePicker } from "@/shared/ui/date-picker";
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
import { Select } from "@/shared/ui/select";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";

import { updateAccount } from "../../account.service";

interface EditAccountDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete: () => void;
  onCancel?: () => void;
}

export function EditAccountDialog({ account, open, onOpenChange, onCloseComplete, onCancel }: EditAccountDialogProps) {
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
      ownerId: account.ownerId || null,
      createdAt: new Date(account.createdAt),
    },
  });

  const { data: membersData } = useQuery({
    queryKey: workspaceKeys.members(account.workspaceId),
    queryFn: () => getWorkspaceMembers(account.workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(account.workspaceId),
    queryFn: () => getWorkspaceSummary(account.workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const workspaceName = useMemo(() => {
    return workspaceData && "data" in workspaceData && workspaceData.data ? workspaceData.data.name : "";
  }, [workspaceData]);

  const members = useMemo(() => {
    return membersData?.data || [];
  }, [membersData?.data]);

  const sharedValue = "__shared__";
  const ownerOptions = useMemo(() => {
    const sharedLabel = workspaceName ? workspaceName : "Общие";
    return [
      { value: sharedValue, label: sharedLabel },
      ...members.map((member) => ({
        value: member.id,
        label: member.name || member.email,
      })),
    ];
  }, [workspaceName, members]);

  const selectedColor = useWatch({ control, name: "color" });
  const selectedIcon = useWatch({ control, name: "icon" });
  const accountName = useWatch({ control, name: "name" });

  useEffect(() => {
    if (open) {
      reset({
        name: account.name,
        color: account.color || undefined,
        icon: account.icon || "Wallet",
        ownerId: account.ownerId || null,
        createdAt: new Date(account.createdAt),
      });
    }
  }, [account.name, account.color, account.icon, account.ownerId, account.createdAt, open, reset]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onCancel?.();
    }
  };

  const onSubmit = async (data: UpdateAccountInput) => {
    onOpenChange(false);
    const result = await updateAccount(account.id, {
      ...data,
      ownerId: data.ownerId === sharedValue || data.ownerId === "" ? null : data.ownerId,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      await invalidateWorkspaceDomains(queryClient, account.workspaceId, [
        "accounts",
        "archivedAccounts",
        "transactions",
      ]);
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Label htmlFor="name" required>
                Название
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
              <Label htmlFor="ownerId">Владелец</Label>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => {
                  return (
                    <Select
                      options={ownerOptions}
                      value={field.value === null || field.value === undefined ? sharedValue : field.value}
                      onChange={(value) => field.onChange(value === sharedValue ? null : value)}
                      placeholder="Выберите владельца"
                      multiple={false}
                      renderOption={({ option }) => {
                        if (option.value === sharedValue) {
                          return <span className="font-normal">{option.label}</span>;
                        }
                        const member = members.find((m) => m.id === option.value);
                        if (!member) return <span>{option.label}</span>;
                        return (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={member.name} email={member.email} image={member.image} size="sm" />
                            <span className="font-normal">{option.label}</span>
                          </div>
                        );
                      }}
                    />
                  );
                }}
              />
              {errors.ownerId && <p className="text-sm text-destructive">{errors.ownerId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <ColorPicker value={selectedColor || "#3b82f6"} onChange={(color) => setValue("color", color)}>
                <ColorPickerTrigger />
                <ColorPickerContent>
                  <ColorPickerArea />
                  <div className="flex items-center gap-2 mt-2">
                    <ColorPickerFormatSelect />
                    <ColorPickerInput />
                  </div>
                </ColorPickerContent>
              </ColorPicker>
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
              <Label htmlFor="createdAt" required>
                Дата открытия счета
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
