"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, X, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import * as React from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { CategoryType } from "@/modules/categories/category.constants";
import { getCategories } from "@/modules/categories/category.service";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { type SelectOption } from "@/shared/ui/select/types";
import { RenderOption } from "@/shared/ui/select/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { getAccountIcon } from "@/shared/utils/account-icons";

import type { TransactionFilters } from "../transaction.service";

interface TransactionsFiltersProps {
  workspaceId: string;
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionsFilters({ workspaceId, filters, onFiltersChange }: TransactionsFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: session } = useSession();

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const allAccounts = React.useMemo(() => accountsData?.data || [], [accountsData?.data]);
  const currentUserId = session?.user?.id;
  const categories = React.useMemo(() => categoriesData?.data || [], [categoriesData?.data]);

  const sortedAccounts = React.useMemo(() => {
    if (!currentUserId) {
      return allAccounts;
    }

    const userAccounts = allAccounts.filter((acc) => acc.ownerId === currentUserId);
    const otherAccounts = allAccounts.filter((acc) => acc.ownerId !== currentUserId);

    return [...userAccounts, ...otherAccounts];
  }, [allAccounts, currentUserId]);

  const accountsByOwner = React.useMemo(() => {
    const grouped = new Map<string | null, typeof sortedAccounts>();

    for (const account of sortedAccounts) {
      const ownerId = account.ownerId || null;
      if (!grouped.has(ownerId)) {
        grouped.set(ownerId, []);
      }
      grouped.get(ownerId)!.push(account);
    }

    const result: Array<{
      ownerId: string | null;
      ownerName: string;
      owner: { name?: string | null; email?: string | null; image?: string | null } | null;
      accounts: typeof sortedAccounts;
    }> = [];

    for (const [ownerId, accounts] of grouped.entries()) {
      const firstAccount = accounts[0];
      const ownerName = firstAccount.owner?.name || firstAccount.owner?.email || "Общие";
      result.push({ ownerId, ownerName, owner: firstAccount.owner, accounts });
    }

    return result;
  }, [sortedAccounts]);

  const selectedAccountIds = filters.accountIds || [];
  const selectedCategoryIds = filters.categoryIds || [];
  const selectedTypes: TransactionType[] = filters.types || [];

  const updateFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const typeOptions: SelectOption[] = [
    { value: TransactionType.INCOME, label: "Доход" },
    { value: TransactionType.EXPENSE, label: "Расход" },
    { value: TransactionType.TRANSFER, label: "Перевод" },
  ];

  const accountOptions: SelectOption[] = React.useMemo(() => {
    if (sortedAccounts.length === 0) {
      return [];
    }

    const options: SelectOption[] = [];

    for (const { ownerId, ownerName, accounts } of accountsByOwner) {
      const groupId = ownerId ? `__group_${ownerId}__` : "__group_null__";
      options.push({ value: groupId, label: ownerName });
      options.push(
        ...accounts.map((account) => ({
          value: account.id,
          label: account.name,
        }))
      );
    }

    return options;
  }, [accountsByOwner, sortedAccounts.length]);

  const renderAccountOption: RenderOption<string> = ({ option, selected, props: { multiple }, isTrigger }) => {
    if (option.value.startsWith("__group_") && option.value.endsWith("__")) {
      const ownerId = option.value.replace("__group_", "").replace("__", "") || null;
      const ownerGroup = accountsByOwner.find(
        (group) => group.ownerId === ownerId || (ownerId === "null" && group.ownerId === null)
      );

      if (ownerGroup) {
        if (ownerGroup.owner) {
          return (
            <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
              <UserDisplay
                name={ownerGroup.owner.name}
                email={ownerGroup.owner.email || undefined}
                image={ownerGroup.owner.image}
                size="sm"
                showName={true}
              />
            </div>
          );
        }
        return (
          <div className="px-2 py-1.5 text-sm font-medium" onClick={(e) => e.stopPropagation()}>
            {ownerGroup.ownerName}
          </div>
        );
      }

      return (
        <div
          className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          onClick={(e) => e.stopPropagation()}
        >
          {option.label}
        </div>
      );
    }

    const account = sortedAccounts.find((acc) => acc.id === option.value);
    if (!account) return null;

    const AccountIcon = getAccountIcon(account.icon);

    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {multiple && !isTrigger && (
          <Checkbox checked={selected} className="shrink-0" onClick={(e) => e.stopPropagation()} />
        )}
        {account.icon && <AccountIcon className="h-4 w-4 text-primary" style={{ color: account.color || undefined }} />}
        <div className="flex-1 flex flex-col min-w-0">
          <span className="text-sm">
            {option.label}
            {account.currency && <span className="text-muted-foreground text-xs"> ({account.currency})</span>}
          </span>
        </div>
        {!multiple && selected && !isTrigger && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </div>
    );
  };

  const renderCategoryOption: RenderOption<string> = ({ props, option, selected, isTrigger }) => {
    if (option.value === "__group_expense__" || option.value === "__group_income__") {
      return (
        <div
          className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          onClick={(e) => e.stopPropagation()}
        >
          {option.label}
        </div>
      );
    }

    const category = categories.find((cat) => cat.id === option.value);
    if (!category) return null;

    const transactionCount = (category as any)._count?.transactions || 0;

    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {props.multiple && !isTrigger && (
          <Checkbox checked={selected} className="shrink-0" onClick={(e) => e.stopPropagation()} />
        )}
        <div style={{ backgroundColor: category.color || undefined }} className="size-4 rounded-full" />
        <span className="flex-1 text-sm">{option.label}</span>
        {!isTrigger && transactionCount > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">{transactionCount}</span>
        )}
      </div>
    );
  };

  const categoryOptions: SelectOption[] = React.useMemo(() => {
    if (categories.length === 0) {
      return [];
    }

    const incomeCategories = categories.filter((cat) => cat.type === CategoryType.INCOME);
    const expenseCategories = categories.filter((cat) => cat.type === CategoryType.EXPENSE);

    const options: SelectOption[] = [];

    if (expenseCategories.length > 0) {
      options.push({ value: "__group_expense__", label: "Расходы" });
      options.push(
        ...expenseCategories.map((category) => ({
          value: category.id,
          label: category.name,
        }))
      );
    }

    if (incomeCategories.length > 0) {
      options.push({ value: "__group_income__", label: "Доходы" });
      options.push(
        ...incomeCategories.map((category) => ({
          value: category.id,
          label: category.name,
        }))
      );
    }

    return options;
  }, [categories]);

  const clearFilter = (key: keyof TransactionFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    (filters.categoryIds?.length || 0) > 0 ||
    (filters.accountIds?.length || 0) > 0 ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.search ||
    (filters.types?.length || 0) > 0;

  const filtersContent = (
    <div className="flex flex-col gap-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="search" className="text-sm font-medium">
          Поиск
        </Label>
        <div className="relative">
          <Input
            id="search"
            placeholder="Поиск..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="pr-8"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => clearFilter("search")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Тип транзакции</Label>
        <Select
          options={typeOptions}
          value={selectedTypes}
          onChange={(newValue) => {
            updateFilter(
              "types",
              (Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined) as TransactionFilters["types"]
            );
          }}
          placeholder="Все типы"
          label="Тип транзакции"
          multiple
          allowClear
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Счета</Label>
        <Select
          options={accountOptions}
          value={selectedAccountIds}
          onChange={(newValue) => {
            updateFilter("accountIds", Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined);
          }}
          placeholder="Все счета"
          label="Счета"
          multiple
          allowClear
          renderOption={renderAccountOption}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Категории</Label>
        <Select
          options={categoryOptions}
          value={selectedCategoryIds}
          onChange={(newValue) => {
            updateFilter("categoryIds", Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined);
          }}
          placeholder="Все категории"
          label="Категории"
          multiple
          allowClear
          renderOption={renderCategoryOption}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Сумма</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="minAmount"
              type="number"
              step="0.01"
              placeholder="От"
              value={filters.minAmount || ""}
              onChange={(e) => updateFilter("minAmount", e.target.value || undefined)}
              className="pr-8"
            />
            {filters.minAmount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearFilter("minAmount")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="relative flex-1">
            <Input
              id="maxAmount"
              type="number"
              step="0.01"
              placeholder="До"
              value={filters.maxAmount || ""}
              onChange={(e) => updateFilter("maxAmount", e.target.value || undefined)}
              className="pr-8"
            />
            {filters.maxAmount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearFilter("maxAmount")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Дата</Label>
        <div className="flex gap-2">
          <DatePicker
            date={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
            onSelect={(date) => {
              updateFilter("dateFrom", date);
            }}
            placeholder="От"
            className="flex-1"
          />
          <DatePicker
            date={filters.dateTo ? new Date(filters.dateTo) : undefined}
            onSelect={(date) => {
              updateFilter("dateTo", date);
            }}
            placeholder="До"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden">
        <Button variant="outline" onClick={() => setSheetOpen(true)} className="justify-start">
          <Filter className="mr-2 h-4 w-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Активно</span>
          )}
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-dvh p-0 flex flex-col">
            <SheetHeader>
              <SheetTitle>Фильтры</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6">{filtersContent}</div>
            <div className="border-t px-4 pb-5 pt-3 flex flex-col gap-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAllFilters();
                    setSheetOpen(false);
                  }}
                  className="w-full"
                >
                  Очистить
                </Button>
              )}
              <Button onClick={() => setSheetOpen(false)} className="w-full">
                Применить
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden md:flex flex-wrap lg:flex-col lg:items-stretch items-end gap-2">
      <h3 className="hidden lg:block text-lg font-semibold mb-2 w-full">Фильтры</h3>

      <div className="relative w-[200px] lg:w-full lg:space-y-2">
        <Label htmlFor="search" className="hidden lg:block text-sm font-medium">
          Поиск
        </Label>
        <div className="relative">
          <Input
            id="search"
            placeholder="Поиск..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="pr-8"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => clearFilter("search")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="w-[140px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Тип транзакции</Label>
        <Select
          options={typeOptions}
          value={selectedTypes}
          onChange={(newValue) => {
            updateFilter(
              "types",
              (Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined) as TransactionFilters["types"]
            );
          }}
          placeholder="Все типы"
          label="Тип транзакции"
          multiple
          allowClear
        />
      </div>

      <div className="w-[160px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Счета</Label>
        <Select
          options={accountOptions}
          value={selectedAccountIds}
          onChange={(newValue) => {
            updateFilter("accountIds", Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined);
          }}
          placeholder="Все счета"
          label="Счета"
          multiple
          allowClear
          renderOption={renderAccountOption}
        />
      </div>

      <div className="w-[160px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Категории</Label>
        <Select
          options={categoryOptions}
          value={selectedCategoryIds}
          onChange={(newValue) => {
            updateFilter("categoryIds", Array.isArray(newValue) && newValue.length > 0 ? newValue : undefined);
          }}
          renderOption={renderCategoryOption}
          placeholder="Все категории"
          label="Категории"
          multiple
          allowClear
        />
      </div>

      <div className="w-[120px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Сумма</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="minAmount"
              type="number"
              step="0.01"
              placeholder="От"
              value={filters.minAmount || ""}
              onChange={(e) => updateFilter("minAmount", e.target.value || undefined)}
              className="pr-8"
            />
            {filters.minAmount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearFilter("minAmount")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="relative flex-1">
            <Input
              id="maxAmount"
              type="number"
              step="0.01"
              placeholder="До"
              value={filters.maxAmount || ""}
              onChange={(e) => updateFilter("maxAmount", e.target.value || undefined)}
              className="pr-8"
            />
            {filters.maxAmount && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearFilter("maxAmount")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="w-[140px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Дата</Label>
        <div className="flex gap-2">
          <DatePicker
            date={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
            onSelect={(date) => {
              updateFilter("dateFrom", date);
            }}
            placeholder="От"
            className="flex-1"
          />
          <DatePicker
            date={filters.dateTo ? new Date(filters.dateTo) : undefined}
            onSelect={(date) => {
              updateFilter("dateTo", date);
            }}
            placeholder="До"
            className="flex-1"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
          <X className="mr-1 h-3 w-3" />
          Очистить
        </Button>
      )}
    </div>
    </>
  );
}
