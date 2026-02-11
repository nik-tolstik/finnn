"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Currency } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspace, getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { createAccountSchema, type CreateAccountInput } from "@/shared/lib/validations/account";
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
import { NumberInput } from "@/shared/ui/number-input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { getAvatarColor } from "@/shared/utils/avatar-colors";
import { cn } from "@/shared/utils/cn";

import { createAccount } from "../account.service";

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} as const;

function getWorkspaceIcon(iconName?: string | null): LucideIcon {
  if (iconName && iconName in WORKSPACE_ICONS) {
    return WORKSPACE_ICONS[iconName];
  }
  return Building2;
}

interface CreateAccountDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
}

export function CreateAccountDialog({ workspaceId, open, onOpenChange, onCloseComplete }: CreateAccountDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      name: "",
      balance: "0",
      currency: DEFAULT_CURRENCY,
      ownerId: undefined,
      color: undefined,
      icon: "Wallet",
      createdAt: (() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
      })(),
    },
  });

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: open,
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;

  const workspaceName = useMemo(() => {
    return workspaceData && "data" in workspaceData && workspaceData.data ? workspaceData.data.name : "";
  }, [workspaceData]);

  const workspaceIcon = useMemo(() => {
    return workspaceData && "data" in workspaceData && workspaceData.data
      ? getWorkspaceIcon(workspaceData.data.icon)
      : Building2;
  }, [workspaceData]);

  const members = useMemo(() => {
    return membersData?.data || [];
  }, [membersData?.data]);

  const currentUserId = useMemo(() => {
    if (!session?.user?.id) return undefined;
    const currentUser = members.find((m) => m.id === session.user.id);
    return currentUser?.id;
  }, [session, members]);

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

  const currency = useWatch({ control, name: "currency" });
  const selectedColor = useWatch({ control, name: "color" });
  const selectedIcon = useWatch({ control, name: "icon" });
  const accountName = useWatch({ control, name: "name" });
  const balance = useWatch({ control, name: "balance" });

  useEffect(() => {
    if (open && currentUserId) {
      setValue("ownerId", currentUserId);
    }
  }, [open, currentUserId, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        balance: "0",
        currency: baseCurrency,
        ownerId: currentUserId || null,
        color: undefined,
        icon: "Wallet",
        createdAt: (() => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          return date;
        })(),
      });
    }
  }, [open, reset, currentUserId, baseCurrency]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateAccountInput) => {
    const result = await createAccount(workspaceId, {
      ...data,
      currency: data.currency,
      ownerId: data.ownerId === sharedValue || data.ownerId === "" ? null : data.ownerId,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogWindow onCloseComplete={onCloseComplete} className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новый счёт</DialogTitle>
          <DialogDescription>Добавьте новый счёт для отслеживания ваших финансов</DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form className="space-y-4">
            <AccountCard
              account={{
                id: "",
                workspaceId,
                name: accountName || "",
                balance: balance || "0",
                currency: currency || Currency.USD,
                color: selectedColor || null,
                icon: selectedIcon || "Wallet",
                description: null,
                ownerId: null,
                archived: false,
                order: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              }}
            />
            <div className="space-y-2">
              <Label htmlFor="name">
                Название <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Название счёта"
                  className="pl-9"
                  aria-invalid={errors.name ? "true" : "false"}
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">
                Валюта <span className="text-destructive">*</span>
              </Label>
              <Select
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={(value) => setValue("currency", value)}
                placeholder="Выберите валюту"
                multiple={false}
              />
              {errors.currency && <p className="text-sm text-destructive">{errors.currency.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="balance">
                Начальный баланс <span className="text-destructive">*</span>
              </Label>
              <NumberInput
                id="balance"
                {...register("balance")}
                placeholder="0.00"
                aria-invalid={errors.balance ? "true" : "false"}
              />
              {errors.balance && <p className="text-sm text-destructive">{errors.balance.message}</p>}
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
                          const WorkspaceIcon = workspaceIcon;
                          return (
                            <div className="flex items-center gap-2">
                              <WorkspaceIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-normal">{option.label}</span>
                            </div>
                          );
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
                              <img
                                src={member.image}
                                alt={displayName}
                                className="h-5 w-5 rounded-full object-cover"
                              />
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? "Создание..." : "Создать"}
          </Button>
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
