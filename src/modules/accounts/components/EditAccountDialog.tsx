"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Account } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { Controller } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspace, getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { getAvatarColor } from "@/shared/utils/avatar-colors";
import { updateAccountSchema, type UpdateAccountInput } from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import {
  ColorPicker,
  ColorPickerTrigger,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerFormatSelect,
  ColorPickerInput,
} from "@/shared/ui/color-picker";
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
import { Select } from "@/shared/ui/select/select";
import { SelectOption } from "@/shared/ui/select/types";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
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
  const { data: session } = useSession();
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
    queryKey: ["workspace-members", account.workspaceId],
    queryFn: () => getWorkspaceMembers(account.workspaceId),
    enabled: open,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", account.workspaceId],
    queryFn: () => getWorkspace(account.workspaceId),
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
  const ownerId = useWatch({ control, name: "ownerId" });

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
  }, [account.id, account.name, account.color, account.icon, account.ownerId, account.createdAt, open, reset]);

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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["accounts", account.workspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions", account.workspaceId],
        }),
      ]);
      router.refresh();
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
                      renderOption={({ option, selected }) => {
                        if (option.value === sharedValue) {
                          return <span className="font-normal">{option.label}</span>;
                        }
                        const member = members.find((m) => m.id === option.value);
                        if (!member) return <span>{option.label}</span>;
                        const displayName = member.name || member.email || "U";
                        const initials = displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);
                        return (
                          <div className="flex items-center gap-2">
                            {member.image ? (
                              <img src={member.image} alt={displayName} className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <div
                                className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-medium"
                                style={{
                                  backgroundColor: getAvatarColor(displayName),
                                }}
                              >
                                {initials}
                              </div>
                            )}
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
