"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowDown, ArrowLeftRight, ArrowUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { getCategories } from "@/modules/categories/category.service";
import { AccountSelector } from "@/shared/components/AccountSelector";
import { CategorySelectModal } from "@/shared/components/CategorySelectModal";
import {
  createTransactionSchema,
  createTransferSchema,
  type CreateTransactionInput,
  type CreateTransferInput,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { type ComboboxOption } from "@/shared/ui/combobox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { generateRandomColor } from "@/shared/utils/category-colors";
import { getCurrencySymbol } from "@/shared/utils/money";

import { createTransaction, createTransfer } from "../transaction.service";
import type { TemporaryCategory } from "../transaction.types";

interface CreateTransactionTabsDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  defaultAccountId?: string;
  defaultTab?: "expense" | "income" | "transfer";
}

export function CreateTransactionTabsDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  defaultAccountId,
  defaultTab = "expense",
}: CreateTransactionTabsDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"expense" | "income" | "transfer">(
    defaultTab
  );
  const [temporaryCategories, setTemporaryCategories] = useState<
    TemporaryCategory[]
  >([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: open,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
    enabled: open,
  });

  const accounts = useMemo(() => {
    return accountsData?.data || [];
  }, [accountsData?.data]);

  const allCategories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData?.data]);

  const transactionForm = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      accountId: defaultAccountId || "",
      amount: "",
      type: "expense" as const,
      description: "",
      date: new Date(),
      categoryId: undefined,
    },
  });

  const transferForm = useForm<CreateTransferInput>({
    resolver: zodResolver(createTransferSchema),
    defaultValues: {
      fromAccountId: defaultAccountId || "",
      toAccountId: "",
      amount: "",
      toAmount: "",
      description: "",
      date: new Date(),
    },
  });

  const transactionType = useWatch({
    control: transactionForm.control,
    name: "type",
  });
  const categoryId = useWatch({
    control: transactionForm.control,
    name: "categoryId",
  });
  const transactionAccountId = useWatch({
    control: transactionForm.control,
    name: "accountId",
  });
  const fromAccountId = useWatch({
    control: transferForm.control,
    name: "fromAccountId",
  });
  const toAccountId = useWatch({
    control: transferForm.control,
    name: "toAccountId",
  });
  const transferAmount = useWatch({
    control: transferForm.control,
    name: "amount",
  });
  const transferToAmount = useWatch({
    control: transferForm.control,
    name: "toAmount",
  });

  const transactionAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === transactionAccountId);
  }, [accounts, transactionAccountId]);

  const fromAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === fromAccountId);
  }, [accounts, fromAccountId]);

  const toAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === toAccountId);
  }, [accounts, toAccountId]);

  const filteredCategories = useMemo(() => {
    return allCategories.filter(
      (cat) => cat.type === transactionType || transactionType === "transfer"
    );
  }, [allCategories, transactionType]);

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    const existingOptions: ComboboxOption[] = filteredCategories.map((cat) => ({
      value: cat.id,
      label: cat.name,
      color: cat.color || undefined,
      isTemporary: false,
    }));

    const tempOptions: ComboboxOption[] = temporaryCategories
      .filter((temp) => temp.type === transactionType)
      .map((temp) => ({
        value: temp.id,
        label: temp.name,
        color: temp.color,
        isTemporary: true,
      }));

    return [...existingOptions, ...tempOptions];
  }, [filteredCategories, temporaryCategories, transactionType]);

  const selectedCategory = useMemo(() => {
    return comboboxOptions.find((opt) => opt.value === categoryId);
  }, [comboboxOptions, categoryId]);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      transactionForm.reset({
        accountId: defaultAccountId || "",
        amount: "",
        type: defaultTab === "transfer" ? "expense" : defaultTab,
        description: "",
        date: new Date(),
        categoryId: undefined,
        newCategory: undefined,
      });
      transferForm.reset({
        fromAccountId: defaultAccountId || "",
        toAccountId: "",
        amount: "",
        toAmount: "",
        description: "",
        date: new Date(),
      });
      setTemporaryCategories([]);
    }
  }, [open, defaultAccountId, defaultTab, transactionForm, transferForm]);

  useEffect(() => {
    if (activeTab !== "transfer") {
      transactionForm.setValue("type", activeTab);
    }
  }, [activeTab, transactionForm]);

  const handleTransactionSubmit = async (data: CreateTransactionInput) => {
    if (!transactionAccount) return;

    const accountCreatedDate = new Date(transactionAccount.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);
    const transactionDate = new Date(data.date);
    transactionDate.setHours(0, 0, 0, 0);

    if (transactionDate < accountCreatedDate) {
      toast.error(
        `Дата транзакции не может быть раньше даты создания счета (${format(
          accountCreatedDate,
          "dd.MM.yyyy",
          { locale: ru }
        )})`
      );
      return;
    }

    const result = await createTransaction(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Транзакция успешно создана");
      transactionForm.reset();
      setTemporaryCategories([]);
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      if (data.newCategory) {
        await queryClient.invalidateQueries({
          queryKey: ["categories", workspaceId],
        });
      }
      router.refresh();
    }
  };

  const handleTransferSubmit = async (data: CreateTransferInput) => {
    const result = await createTransfer(workspaceId, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Перевод успешно создан");
      transferForm.reset();
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["transactions", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounts", workspaceId],
      });
      router.refresh();
    }
  };

  const handleCategorySelect = (option: ComboboxOption) => {
    if (option.isTemporary) {
      const tempCategory = temporaryCategories.find(
        (temp) => temp.id === option.value
      );
      if (tempCategory) {
        transactionForm.setValue("newCategory", {
          name: tempCategory.name,
          color: tempCategory.color,
          type: tempCategory.type,
        });
        transactionForm.setValue("categoryId", option.value);
      }
    } else {
      transactionForm.setValue("categoryId", option.value);
      transactionForm.setValue("newCategory", undefined);
    }
  };

  const handleCategorySearch = (searchValue: string) => {
    if (!searchValue.trim()) {
      return;
    }

    const exists = allCategories.some(
      (cat) => cat.name.toLowerCase() === searchValue.toLowerCase()
    );

    if (
      !exists &&
      !temporaryCategories.some(
        (temp) =>
          temp.name.toLowerCase() === searchValue.toLowerCase() &&
          temp.type === transactionType
      )
    ) {
      const newTempCategory: TemporaryCategory = {
        id: `temp-${Date.now()}-${Math.random()}`,
        name: searchValue.trim(),
        color: generateRandomColor(),
        type: transactionType as "income" | "expense",
        isTemporary: true,
      };
      setTemporaryCategories((prev) => [...prev, newTempCategory]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[500px]" onCloseComplete={onCloseComplete}>
        <DialogHeader>
          <DialogTitle>Создать транзакцию</DialogTitle>
          <DialogDescription>
            Выберите тип транзакции и заполните форму
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expense">
              <ArrowDown className="h-4 w-4" />
              Расход
            </TabsTrigger>
            <TabsTrigger value="income">
              <ArrowUp className="h-4 w-4" />
              Доход
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <ArrowLeftRight className="h-4 w-4" />
              Перевод
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expense" className="mt-4">
            <form
              onSubmit={transactionForm.handleSubmit(handleTransactionSubmit)}
              className="space-y-4"
            >
              <Controller
                control={transactionForm.control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelector
                    workspaceId={workspaceId}
                    account={transactionAccount || null}
                    onSelect={(account) => {
                      field.onChange(account.id);
                    }}
                    label="Счёт"
                    required
                    error={transactionForm.formState.errors.accountId?.message}
                  />
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="categoryId">Категория</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setCategoryModalOpen(true)}
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2">
                        {selectedCategory.color && (
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: selectedCategory.color }}
                          />
                        )}
                        <span className="truncate">
                          {selectedCategory.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Выберите или создайте категорию
                      </span>
                    )}
                  </Button>
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        transactionForm.setValue("categoryId", undefined);
                        transactionForm.setValue("newCategory", undefined);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <CategorySelectModal
                  open={categoryModalOpen}
                  onOpenChange={setCategoryModalOpen}
                  options={comboboxOptions}
                  value={categoryId}
                  onSelect={handleCategorySelect}
                  onSearchChange={handleCategorySearch}
                  placeholder="Выберите или создайте категорию"
                  searchPlaceholder="Поиск или создание категории..."
                  emptyText="Введите название для создания новой категории"
                  createText="Создать"
                />
                {(transactionForm.formState.errors.categoryId ||
                  transactionForm.formState.errors.newCategory) && (
                  <p className="text-sm text-destructive">
                    {transactionForm.formState.errors.categoryId?.message ||
                      transactionForm.formState.errors.newCategory?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">
                  Сумма <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  {transactionAccount && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                      {getCurrencySymbol(transactionAccount.currency)}
                    </span>
                  )}
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className={transactionAccount ? "pl-9" : ""}
                    {...transactionForm.register("amount", {
                      onChange: (e) => {
                        const value = e.target.value;
                        if (value && parseFloat(value) < 0) {
                          e.target.value = "";
                        }
                      },
                    })}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                {transactionForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {transactionForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание транзакции"
                  rows={3}
                  {...transactionForm.register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label>Дата</Label>
                <Controller
                  control={transactionForm.control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker
                      date={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        if (!transactionAccount) return false;
                        const accountCreatedDate = new Date(
                          transactionAccount.createdAt
                        );
                        accountCreatedDate.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        return checkDate < accountCreatedDate;
                      }}
                    />
                  )}
                />
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
                  disabled={transactionForm.formState.isSubmitting}
                >
                  {transactionForm.formState.isSubmitting
                    ? "Создание..."
                    : "Создать расход"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="income" className="mt-4">
            <form
              onSubmit={transactionForm.handleSubmit(handleTransactionSubmit)}
              className="space-y-4"
            >
              <Controller
                control={transactionForm.control}
                name="accountId"
                render={({ field }) => (
                  <AccountSelector
                    workspaceId={workspaceId}
                    account={transactionAccount || null}
                    onSelect={(account) => {
                      field.onChange(account.id);
                    }}
                    label="Счёт"
                    required
                    error={transactionForm.formState.errors.accountId?.message}
                  />
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="categoryId-income">Категория</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setCategoryModalOpen(true)}
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2">
                        {selectedCategory.color && (
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: selectedCategory.color }}
                          />
                        )}
                        <span className="truncate">
                          {selectedCategory.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Выберите или создайте категорию
                      </span>
                    )}
                  </Button>
                  {selectedCategory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        transactionForm.setValue("categoryId", undefined);
                        transactionForm.setValue("newCategory", undefined);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <CategorySelectModal
                  open={categoryModalOpen}
                  onOpenChange={setCategoryModalOpen}
                  options={comboboxOptions}
                  value={categoryId}
                  onSelect={handleCategorySelect}
                  onSearchChange={handleCategorySearch}
                  placeholder="Выберите или создайте категорию"
                  searchPlaceholder="Поиск или создание категории..."
                  emptyText="Введите название для создания новой категории"
                  createText="Создать"
                />
                {(transactionForm.formState.errors.categoryId ||
                  transactionForm.formState.errors.newCategory) && (
                  <p className="text-sm text-destructive">
                    {transactionForm.formState.errors.categoryId?.message ||
                      transactionForm.formState.errors.newCategory?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount-income">
                  Сумма <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  {transactionAccount && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                      {getCurrencySymbol(transactionAccount.currency)}
                    </span>
                  )}
                  <Input
                    id="amount-income"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className={transactionAccount ? "pl-9" : ""}
                    {...transactionForm.register("amount", {
                      onChange: (e) => {
                        const value = e.target.value;
                        if (value && parseFloat(value) < 0) {
                          e.target.value = "";
                        }
                      },
                    })}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                {transactionForm.formState.errors.amount && (
                  <p className="text-sm text-destructive">
                    {transactionForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description-income">Описание</Label>
                <Textarea
                  id="description-income"
                  placeholder="Описание транзакции"
                  rows={3}
                  {...transactionForm.register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label>Дата</Label>
                <Controller
                  control={transactionForm.control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker
                      date={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        if (!transactionAccount) return false;
                        const accountCreatedDate = new Date(
                          transactionAccount.createdAt
                        );
                        accountCreatedDate.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        return checkDate < accountCreatedDate;
                      }}
                    />
                  )}
                />
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
                  disabled={transactionForm.formState.isSubmitting}
                >
                  {transactionForm.formState.isSubmitting
                    ? "Создание..."
                    : "Создать доход"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="transfer" className="mt-4">
            <form
              onSubmit={transferForm.handleSubmit(handleTransferSubmit)}
              className="space-y-4"
            >
              <div className="space-y-4">
                <Controller
                  control={transferForm.control}
                  name="fromAccountId"
                  render={({ field }) => (
                    <AccountSelector
                      workspaceId={workspaceId}
                      account={fromAccount || null}
                      onSelect={(account) => {
                        field.onChange(account.id);
                        if (account.id === toAccountId) {
                          transferForm.setValue("toAccountId", "");
                        }
                      }}
                      excludeAccountIds={toAccountId ? [toAccountId] : []}
                      label="Счёт отправителя"
                      required
                      error={
                        transferForm.formState.errors.fromAccountId?.message
                      }
                    />
                  )}
                />

                <div className="space-y-2">
                  <Label htmlFor="transfer-amount">
                    Сумма отправления{" "}
                    {fromAccount && `(${fromAccount.currency})`}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    {fromAccount && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                        {getCurrencySymbol(fromAccount.currency)}
                      </span>
                    )}
                    <Input
                      id="transfer-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className={fromAccount ? "pl-9" : ""}
                      {...transferForm.register("amount", {
                        onChange: (e) => {
                          const value = e.target.value;
                          if (value && parseFloat(value) < 0) {
                            e.target.value = "";
                          }
                        },
                      })}
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "E") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  {transferForm.formState.errors.amount && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                <Controller
                  control={transferForm.control}
                  name="toAccountId"
                  render={({ field }) => (
                    <AccountSelector
                      workspaceId={workspaceId}
                      account={toAccount || null}
                      onSelect={(account) => {
                        field.onChange(account.id);
                        if (account.id === fromAccountId) {
                          transferForm.setValue("fromAccountId", "");
                        }
                      }}
                      excludeAccountIds={fromAccountId ? [fromAccountId] : []}
                      label="Счёт получателя"
                      required
                      error={transferForm.formState.errors.toAccountId?.message}
                    />
                  )}
                />

                <div className="space-y-2">
                  <Label htmlFor="transfer-toAmount">
                    Сумма получения {toAccount && `(${toAccount.currency})`}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    {toAccount && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                        {getCurrencySymbol(toAccount.currency)}
                      </span>
                    )}
                    <Input
                      id="transfer-toAmount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className={toAccount ? "pl-9" : ""}
                      {...transferForm.register("toAmount", {
                        onChange: (e) => {
                          const value = e.target.value;
                          if (value && parseFloat(value) < 0) {
                            e.target.value = "";
                          }
                        },
                      })}
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "E") {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  {transferForm.formState.errors.toAmount && (
                    <p className="text-sm text-destructive">
                      {transferForm.formState.errors.toAmount.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-description">Описание</Label>
                <Textarea
                  id="transfer-description"
                  placeholder="Описание перевода"
                  rows={3}
                  {...transferForm.register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label>Дата</Label>
                <Controller
                  control={transferForm.control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker date={field.value} onSelect={field.onChange} />
                  )}
                />
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
                  disabled={transferForm.formState.isSubmitting}
                >
                  {transferForm.formState.isSubmitting
                    ? "Создание..."
                    : "Создать перевод"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
