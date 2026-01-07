"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { Check } from "lucide-react";
import { useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { getCategories } from "@/modules/categories/category.service";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select/select";
import { type SelectOption } from "@/shared/ui/select/types";
import { RenderOption } from "@/shared/ui/select/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { getAccountIcon } from "@/shared/utils/account-icons";

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
  const { isMobile } = useBreakpoints();
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const selectedTypes: TransactionType[] = filters.types || [];

  const updateFilter = <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K]
  ) => {
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

  const accountOptions: SelectOption[] = accounts.map((account) => ({
    value: account.id,
    label: account.name,
  }));

  const renderAccountOption: RenderOption<string> = ({
    option,
    selected,
    props: { multiple },
  }) => {
    const account = accounts.find((acc) => acc.id === option.value);
    if (!account) return null;

    const AccountIcon = getAccountIcon(account.icon);

    return (
      <>
        {multiple && (
          <Checkbox
            checked={selected}
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {account.icon && (
          <AccountIcon
            className="h-4 w-4 text-primary"
            style={{ color: account.color || undefined }}
          />
        )}
        <span className="flex-1 text-sm">{option.label}</span>
        {!multiple && selected && (
          <Check className="h-4 w-4 shrink-0 text-primary" />
        )}
      </>
    );
  };

  const renderCategoryOption: RenderOption<string> = ({
    props,
    option,
    selected,
  }) => {
    const category = categories.find((cat) => cat.id === option.value)!;

    return (
      <>
        {props.multiple && <Checkbox checked={selected} className="shrink-0" />}
        <div
          style={{ backgroundColor: category.color || undefined }}
          className="size-4 rounded-full"
        />
        <span className="flex-1 text-sm">{option.label}</span>
      </>
    );
  };

  const categoryOptions: SelectOption[] = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));

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

      <div className="space-y-2">
        <Label className="text-sm font-medium">Тип транзакции</Label>
        <Select
          options={typeOptions}
          value={selectedTypes}
          onChange={(newValue) => {
            updateFilter(
              "types",
              (Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined) as TransactionFilters["types"]
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
            updateFilter(
              "accountIds",
              Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined
            );
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
            updateFilter(
              "categoryIds",
              Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined
            );
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

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          className="justify-start"
        >
          <Filter className="mr-2 h-4 w-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              Активно
            </span>
          )}
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-dvh p-0 flex flex-col">
            <SheetHeader>
              <SheetTitle>Фильтры</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6">
              {filtersContent}
            </div>
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
      </>
    );
  }

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
        <Select
          options={typeOptions}
          value={selectedTypes}
          onChange={(newValue) => {
            updateFilter(
              "types",
              (Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined) as TransactionFilters["types"]
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
            updateFilter(
              "accountIds",
              Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined
            );
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
            updateFilter(
              "categoryIds",
              Array.isArray(newValue) && newValue.length > 0
                ? newValue
                : undefined
            );
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
