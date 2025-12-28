"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import {
  createAccountSchema,
  type CreateAccountInput,
} from "@/shared/lib/validations/account";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ACCOUNT_ICONS } from "@/shared/utils/account-icons";
import { CATEGORY_COLORS } from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/cn";

import { createAccount } from "../account.service";

interface CreateAccountDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({
  workspaceId,
  open,
  onOpenChange,
}: CreateAccountDialogProps) {
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
      currency: "USD",
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
  });

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

  useEffect(() => {
    if (open && currentUserId) {
      setValue("ownerId", currentUserId);
    }
  }, [open, currentUserId, setValue]);

  useEffect(() => {
    if (open && currentUserId) {
      reset({
        name: "",
        balance: "0",
        currency: "USD",
        ownerId: currentUserId,
        color: undefined,
        icon: "Wallet",
        createdAt: (() => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          return date;
        })(),
      });
    }
  }, [open, reset, currentUserId]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: CreateAccountInput) => {
    const result = await createAccount(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Счёт успешно создан");
      reset();
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        key={open ? "open" : "closed"}
        className="sm:max-w-[500px]"
      >
        <DialogHeader>
          <DialogTitle>Создать новый счёт</DialogTitle>
          <DialogDescription>
            Добавьте новый счёт для отслеживания ваших финансов
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">
              Валюта <span className="text-destructive">*</span>
            </Label>
            <Select
              value={currency}
              onValueChange={(value) => setValue("currency", value)}
            >
              <SelectTrigger id="currency" className="w-full">
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="RUB">RUB (₽)</SelectItem>
                <SelectItem value="BYN">BYN (Br)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
                <SelectItem value="CNY">CNY (¥)</SelectItem>
              </SelectContent>
            </Select>
            {errors.currency && (
              <p className="text-sm text-destructive">
                {errors.currency.message}
              </p>
            )}
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
            {errors.balance && (
              <p className="text-sm text-destructive">
                {errors.balance.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerId">
              Владелец <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger id="ownerId" className="w-full">
                    <SelectValue placeholder="Выберите владельца" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ownerId && (
              <p className="text-sm text-destructive">
                {errors.ownerId.message}
              </p>
            )}
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
                    selectedColor === color
                      ? "border-primary scale-110"
                      : "border-border hover:border-primary/50"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
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
                    selectedIcon === name
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                  title={name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
            {errors.icon && (
              <p className="text-sm text-destructive">{errors.icon.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="createdAt">
              Дата открытия счета <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="createdAt"
              render={({ field }) => (
                <DatePicker date={field.value} onSelect={field.onChange} />
              )}
            />
            {errors.createdAt && (
              <p className="text-sm text-destructive">
                {errors.createdAt.message}
              </p>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
