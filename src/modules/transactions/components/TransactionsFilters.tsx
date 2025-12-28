"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";

import { getAccounts } from "@/modules/accounts/account.service";
import { getCategories } from "@/modules/categories/category.service";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";
import type { TransactionFilters } from "../transaction.service";

interface TransactionsFiltersProps {
  workspaceId: string;
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionsFilters({
  workspaceId,
  filters,
  onFiltersChange,
}: TransactionsFiltersProps) {
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => getCategories(workspaceId),
  });

  const accounts = accountsData?.data || [];
  const categories = categoriesData?.data || [];

  const selectedAccountIds = filters.accountIds || [];
  const selectedCategoryIds = filters.categoryIds || [];
  const selectedTypes: ("income" | "expense" | "transfer")[] =
    filters.types || [];

  const updateFilter = <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const toggleAccount = (accountId: string) => {
    const newIds = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter((id) => id !== accountId)
      : [...selectedAccountIds, accountId];
    updateFilter("accountIds", newIds.length > 0 ? newIds : undefined);
  };

  const toggleCategory = (categoryId: string) => {
    const newIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    updateFilter("categoryIds", newIds.length > 0 ? newIds : undefined);
  };

  const toggleType = (type: "income" | "expense" | "transfer") => {
    const newTypes: ("income" | "expense" | "transfer")[] =
      selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type)
        : [...selectedTypes, type];
    onFiltersChange({
      ...filters,
      types: (newTypes.length > 0
        ? newTypes
        : undefined) as TransactionFilters["types"],
    });
  };

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

  return (
    <div className="flex flex-wrap lg:flex-col lg:items-stretch items-end gap-2">
      <h3 className="hidden lg:block text-lg font-semibold mb-2 w-full">
        Фильтры
      </h3>

      <div className="relative w-[200px] lg:w-full lg:space-y-2">
        <Label htmlFor="search" className="hidden lg:block text-sm font-medium">
          Поиск
        </Label>
        <div className="relative">
          <Input
            id="search"
            placeholder="Поиск..."
            value={filters.search || ""}
            onChange={(e) =>
              updateFilter("search", e.target.value || undefined)
            }
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
        <Label className="hidden lg:block text-sm font-medium">
          Тип транзакции
        </Label>
        <div className="relative">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between",
                  selectedTypes.length > 0 && "bg-accent"
                )}
              >
                <span className="truncate">
                  {selectedTypes.length === 0
                    ? "Все типы"
                    : selectedTypes.length === 3
                      ? "Все типы"
                      : selectedTypes.length === 2
                        ? `${selectedTypes.length} типа`
                        : selectedTypes[0] === "income"
                          ? "Доход"
                          : selectedTypes[0] === "expense"
                            ? "Расход"
                            : "Перевод"}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[140px] p-2" align="start">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="type-income"
                    checked={selectedTypes.includes("income")}
                    onCheckedChange={() => toggleType("income")}
                  />
                  <Label
                    htmlFor="type-income"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Доход
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="type-expense"
                    checked={selectedTypes.includes("expense")}
                    onCheckedChange={() => toggleType("expense")}
                  />
                  <Label
                    htmlFor="type-expense"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Расход
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="type-transfer"
                    checked={selectedTypes.includes("transfer")}
                    onCheckedChange={() => toggleType("transfer")}
                  />
                  <Label
                    htmlFor="type-transfer"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Перевод
                  </Label>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {selectedTypes.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateFilter("types", undefined);
              }}
              className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="w-[160px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Счета</Label>
        <div className="relative">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between",
                  selectedAccountIds.length > 0 && "bg-accent"
                )}
              >
                <span className="truncate">
                  {selectedAccountIds.length === 0
                    ? "Все счета"
                    : selectedAccountIds.length === 1
                      ? accounts.find((a) => a.id === selectedAccountIds[0])
                          ?.name || "Выбрано"
                      : `Выбрано: ${selectedAccountIds.length}`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={selectedAccountIds.includes(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <Label
                      htmlFor={`account-${account.id}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {account.name}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {selectedAccountIds.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateFilter("accountIds", undefined);
              }}
              className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="w-[160px] lg:w-full lg:space-y-2">
        <Label className="hidden lg:block text-sm font-medium">Категории</Label>
        <div className="relative">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between",
                  selectedCategoryIds.length > 0 && "bg-accent"
                )}
              >
                <span className="truncate">
                  {selectedCategoryIds.length === 0
                    ? "Все категории"
                    : selectedCategoryIds.length === 1
                      ? categories.find((c) => c.id === selectedCategoryIds[0])
                          ?.name || "Выбрано"
                      : `Выбрано: ${selectedCategoryIds.length}`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={selectedCategoryIds.includes(category.id)}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                    <Label
                      htmlFor={`category-${category.id}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {category.name}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {selectedCategoryIds.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateFilter("categoryIds", undefined);
              }}
              className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
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
              onChange={(e) =>
                updateFilter("minAmount", e.target.value || undefined)
              }
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
              onChange={(e) =>
                updateFilter("maxAmount", e.target.value || undefined)
              }
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
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          Очистить
        </Button>
      )}
    </div>
  );
}
