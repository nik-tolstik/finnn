"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspace, getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { AccountCard } from "@/shared/components/AccountCard";
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { createAccountSchema, type CreateAccountInput } from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import {
  Dialog,
  DialogWindow,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { SelectOption } from "@/shared/ui/select/types";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { CATEGORY_COLORS } from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/cn";

import { createAccount } from "../account.service";

interface CreateAccountFormProps {
  workspaceId: string;
}

export function CreateAccountForm({ workspaceId }: CreateAccountFormProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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
      currency: Currency.BYN,
      ownerId: "",
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

  const members = useMemo(() => {
    return membersData?.data || [];
  }, [membersData?.data]);

  const currentUserId = useMemo(() => {
    if (!session?.user?.id) return undefined;
    const currentUser = members.find((m) => m.id === session.user.id);
    return currentUser?.id;
  }, [session, members]);

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
        ownerId: currentUserId || "",
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

  const onSubmit = async (data: CreateAccountInput) => {
    const result = await createAccount(workspaceId, {
      ...data,
      currency: data.currency,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Счёт успешно создан");
      reset();
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Создать счёт
        </Button>
      </DialogTrigger>
      <DialogWindow className="sm:w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новый счёт</DialogTitle>
          <DialogDescription>Добавьте новый счёт для отслеживания ваших финансов</DialogDescription>
        </DialogHeader>
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
            <Input
              id="balance"
              type="number"
              step="0.01"
              {...register("balance")}
              placeholder="0.00"
              aria-invalid={errors.balance ? "true" : "false"}
            />
            {errors.balance && <p className="text-sm text-destructive">{errors.balance.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerId">
              Владелец <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => {
                const ownerOptions: SelectOption[] = members.map((member) => ({
                  value: member.id,
                  label: member.name || member.email,
                }));
                return (
                  <Select
                    options={ownerOptions}
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value)}
                    placeholder="Выберите владельца"
                    multiple={false}
                  />
                );
              }}
            />
            {errors.ownerId && <p className="text-sm text-destructive">{errors.ownerId.message}</p>}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogWindow>
    </Dialog>
  );
}
