"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { getAccounts } from "@/modules/accounts/account.service";
import { CategoryType } from "@/modules/categories/category.constants";
import { getCategories } from "@/modules/categories/category.service";
import type {
  CreateTransactionInput,
  CreateTransferInput,
} from "@/shared/lib/validations/transaction";
import { Button } from "@/shared/ui/button";
import { type ComboboxOption } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogWindow,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogContent,
} from "@/shared/ui/dialog";
import { generateRandomColor } from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/cn";

import { TransactionType } from "../transaction.constants";
import { createTransaction, createTransfer } from "../transaction.service";
import type { TemporaryCategory } from "../transaction.types";

import { TransactionForm } from "./TransactionForm";
import { TransactionFormSubmitButton } from "./TransactionFormSubmitButton";
import { TransferForm } from "./TransferForm";
import { TransferFormSubmitButton } from "./TransferFormSubmitButton";
import { useTransactionForm } from "./useTransactionForm";
import { useTransferForm } from "./useTransferForm";

interface CreateTransactionTabsDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseComplete?: () => void;
  defaultAccountId?: string;
  defaultTab?: TransactionType;
  onSuccess?: () => void;
}

export function CreateTransactionTabsDialog({
  workspaceId,
  open,
  onOpenChange,
  onCloseComplete,
  defaultAccountId,
  defaultTab = TransactionType.EXPENSE,
  onSuccess,
}: CreateTransactionTabsDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TransactionType>(defaultTab);
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

  const transactionForm = useTransactionForm({ defaultAccountId });
  const transferForm = useTransferForm({ defaultAccountId });

  const transactionType = useWatch({
    control: transactionForm.control,
    name: "type",
  });

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      transactionForm.reset({
        accountId: defaultAccountId || "",
        amount: "",
        type:
          defaultTab === TransactionType.TRANSFER
            ? TransactionType.EXPENSE
            : defaultTab,
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
    if (activeTab !== TransactionType.TRANSFER) {
      transactionForm.setValue("type", activeTab);
    }
  }, [activeTab, transactionForm]);

  const handleTransactionSubmit = async (data: CreateTransactionInput) => {
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
      onSuccess?.();
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
      onSuccess?.();
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
          type:
            tempCategory.type === TransactionType.INCOME
              ? CategoryType.INCOME
              : CategoryType.EXPENSE,
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
        type: transactionType as
          | TransactionType.INCOME
          | TransactionType.EXPENSE,
        isTemporary: true,
      };
      setTemporaryCategories((prev) => [...prev, newTempCategory]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogWindow
        className="h-dvh max-h-dvh w-screen max-w-screen flex flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:w-[500px] sm:m-4 sm:rounded-lg sm:p-6"
        onCloseComplete={onCloseComplete}
      >
        <DialogHeader className="px-4 sm:px-0 pt-4 sm:pt-0 pb-0 border-b shrink-0">
          <DialogTitle className="mb-4">Создать транзакцию</DialogTitle>
          <DialogDescription className="mb-4">
            Выберите тип транзакции и заполните форму
          </DialogDescription>
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setActiveTab(TransactionType.EXPENSE)}
              className={cn(
                "px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0",
                activeTab === TransactionType.EXPENSE
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDown className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Расход</span>
            </button>
            <button
              onClick={() => setActiveTab(TransactionType.INCOME)}
              className={cn(
                "px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0",
                activeTab === TransactionType.INCOME
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUp className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Доход</span>
            </button>
            <button
              onClick={() => setActiveTab(TransactionType.TRANSFER)}
              className={cn(
                "px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0",
                activeTab === TransactionType.TRANSFER
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">Перевод</span>
            </button>
          </div>
        </DialogHeader>
        <DialogContent>
          {activeTab === TransactionType.EXPENSE && (
            <TransactionForm
              workspaceId={workspaceId}
              form={transactionForm}
              accounts={accounts}
              allCategories={allCategories}
              temporaryCategories={temporaryCategories}
              categoryModalOpen={categoryModalOpen}
              onCategoryModalOpenChange={setCategoryModalOpen}
              onCategorySelect={handleCategorySelect}
              onCategorySearch={handleCategorySearch}
              onSubmit={handleTransactionSubmit}
              type={TransactionType.EXPENSE}
            />
          )}
          {activeTab === TransactionType.INCOME && (
            <TransactionForm
              workspaceId={workspaceId}
              form={transactionForm}
              accounts={accounts}
              allCategories={allCategories}
              temporaryCategories={temporaryCategories}
              categoryModalOpen={categoryModalOpen}
              onCategoryModalOpenChange={setCategoryModalOpen}
              onCategorySelect={handleCategorySelect}
              onCategorySearch={handleCategorySearch}
              onSubmit={handleTransactionSubmit}
              type={TransactionType.INCOME}
            />
          )}
          {activeTab === TransactionType.TRANSFER && (
            <TransferForm
              workspaceId={workspaceId}
              form={transferForm}
              accounts={accounts}
              onSubmit={handleTransferSubmit}
            />
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          {activeTab === TransactionType.TRANSFER && (
            <TransferFormSubmitButton
              form={transferForm}
              onSubmit={handleTransferSubmit}
            />
          )}
          {activeTab !== TransactionType.TRANSFER && (
            <TransactionFormSubmitButton
              form={transactionForm}
              type={activeTab}
              onSubmit={handleTransactionSubmit}
            />
          )}
        </DialogFooter>
      </DialogWindow>
    </Dialog>
  );
}
