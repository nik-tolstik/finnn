"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Currency } from "@prisma/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, HandCoins, Landmark, type LucideIcon, Wallet } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { AccountCard } from "@/shared/components/account-card/AccountCard";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { invalidateWorkspaceDomains } from "@/shared/lib/query-invalidation";
import { workspaceKeys } from "@/shared/lib/query-keys";
import { type CreateAccountInput, createAccountSchema } from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import { ColorPicker } from "@/shared/ui/color-picker";
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
import { NumberInput } from "@/shared/ui/number-input";
import { Select } from "@/shared/ui/select";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";

import { createAccount } from "../../account.service";

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
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: open,
    staleTime: 5000,
  });

  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
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
      await invalidateWorkspaceDomains(queryClient, workspaceId, ["accounts", "archivedAccounts", "transactions"]);
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Label htmlFor="name" required>
                Название
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
              <Label htmlFor="currency" required>
                Валюта
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
              <Label htmlFor="balance" required>
                Начальный баланс
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
              <ColorPicker value={selectedColor || "#3b82f6"} onChange={(color) => setValue("color", color)} />
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
