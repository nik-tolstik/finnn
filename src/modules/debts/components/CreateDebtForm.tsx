"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createDebtSchema,
  type CreateDebtInput,
} from "@/shared/lib/validations/debt";
import { createDebt } from "../actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { toast } from "sonner";
import { Plus, CreditCard, User, Calendar } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface CreateDebtFormProps {
  workspaceId: string;
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
  }>;
}

export function CreateDebtForm({ workspaceId, accounts }: CreateDebtFormProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<CreateDebtInput>({
    resolver: zodResolver(createDebtSchema),
    defaultValues: {
      type: "lent",
      debtorName: "",
      amount: "",
      description: "",
      accountId: "",
      dueDate: undefined,
      status: "pending" as const,
      useAccount: false,
    },
  });

  const debtType = watch("type");
  const accountId = watch("accountId");
  const useAccount = watch("useAccount");

  const onSubmit = async (data: CreateDebtInput) => {
    const result = await createDebt(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Долг успешно создан");
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
          Создать долг
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать новый долг</DialogTitle>
          <DialogDescription>Добавьте информацию о долге</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">
              Тип долга <span className="text-destructive">*</span>
            </Label>
            <Select
              value={debtType}
              onValueChange={(value: "lent" | "borrowed") =>
                setValue("type", value)
              }
            >
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lent">Я одалживаю (мне должны)</SelectItem>
                <SelectItem value="borrowed">Я занимаю (я должен)</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="debtorName">
              {debtType === "lent" ? "Имя должника" : "Имя кредитора"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="debtorName"
                {...register("debtorName")}
                placeholder={
                  debtType === "lent"
                    ? "Имя человека, которому вы одолжили"
                    : "Имя человека, у которого вы заняли"
                }
                className="pl-9"
                aria-invalid={errors.debtorName ? "true" : "false"}
              />
            </div>
            {errors.debtorName && (
              <p className="text-sm text-destructive">
                {errors.debtorName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountId">
              {debtType === "lent" ? "С какого счёта" : "На какой счёт"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={accountId}
              onValueChange={(value) => setValue("accountId", value)}
            >
              <SelectTrigger id="accountId" className="w-full">
                <SelectValue placeholder="Выберите счёт" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4" />
                      <span>{account.name}</span>
                      <span className="text-muted-foreground">
                        ({account.currency})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-destructive">
                {errors.accountId.message}
              </p>
            )}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="useAccount"
                checked={useAccount}
                onCheckedChange={(checked) =>
                  setValue("useAccount", checked === true)
                }
              />
              <Label
                htmlFor="useAccount"
                className="text-sm font-normal cursor-pointer"
              >
                Использовать счёт
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              Сумма <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              {...register("amount")}
              placeholder="0.00"
              aria-invalid={errors.amount ? "true" : "false"}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Комментарий</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Дополнительная информация о долге (необязательно)"
              rows={3}
              aria-invalid={errors.description ? "true" : "false"}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Дата возврата</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dueDate"
                type="date"
                {...register("dueDate", {
                  setValueAs: (value) => (value ? new Date(value) : undefined),
                })}
                className="pl-9"
                aria-invalid={errors.dueDate ? "true" : "false"}
              />
            </div>
            {errors.dueDate && (
              <p className="text-sm text-destructive">
                {errors.dueDate.message}
              </p>
            )}
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
      </DialogContent>
    </Dialog>
  );
}
