"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

import type { DashboardTransactionFilters, FilterAccount, FilterCategory, FilterMember } from "../types";
import { toDateString, toDateValue } from "../utils/date";
import {
  buildAccountOptions,
  buildCategoryOptions,
  buildMemberOptions,
  buildTransactionTypeOptions,
} from "../utils/options";
import { getAllowedCategoryTypes, normalizeTransactionFilters } from "../utils/search-params";

interface TransactionsFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appliedFilters: DashboardTransactionFilters;
  members: FilterMember[];
  categories: FilterCategory[];
  accounts: FilterAccount[];
  onApply: (filters: DashboardTransactionFilters) => void;
  onReset: () => void;
}

export function TransactionsFilterDrawer({
  open,
  onOpenChange,
  appliedFilters,
  members,
  categories,
  accounts,
  onApply,
  onReset,
}: TransactionsFilterDrawerProps) {
  const [draftFilters, setDraftFilters] = useState<DashboardTransactionFilters>(() =>
    normalizeTransactionFilters(appliedFilters)
  );

  const updateDraftFilter = <TKey extends keyof DashboardTransactionFilters>(
    key: TKey,
    value: DashboardTransactionFilters[TKey]
  ) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftFilters(normalizeTransactionFilters(appliedFilters));
  }, [appliedFilters, open]);

  const transactionTypeOptions = useMemo(() => buildTransactionTypeOptions(), []);
  const memberOptions = useMemo(() => buildMemberOptions(members), [members]);
  const accountOptions = useMemo(() => buildAccountOptions(accounts), [accounts]);
  const allowedCategoryTypes = useMemo(
    () => getAllowedCategoryTypes(draftFilters.transactionTypes),
    [draftFilters.transactionTypes]
  );
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories, allowedCategoryTypes),
    [allowedCategoryTypes, categories]
  );
  const selectableCategoryIds = useMemo(
    () =>
      new Set(
        categoryOptions
          .filter((option) => !String(option.value).startsWith("__group_"))
          .map((option) => String(option.value))
      ),
    [categoryOptions]
  );

  useEffect(() => {
    if (!draftFilters.categoryIds?.length) {
      return;
    }

    const nextCategoryIds = draftFilters.categoryIds.filter((categoryId) => selectableCategoryIds.has(categoryId));

    if (nextCategoryIds.length === draftFilters.categoryIds.length) {
      return;
    }

    setDraftFilters((prev) =>
      normalizeTransactionFilters({
        ...prev,
        categoryIds: nextCategoryIds,
      })
    );
  }, [draftFilters.categoryIds, selectableCategoryIds]);

  const isCategorySelectDisabled = allowedCategoryTypes.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 pb-4">
          <SheetTitle>Фильтр транзакций</SheetTitle>
          <SheetDescription>Настройте фильтры и примените их к списку транзакций.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <Label>Сумма</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberInput
                value={draftFilters.amountFrom || ""}
                onChange={(event) => {
                  updateDraftFilter("amountFrom", event.currentTarget.value || undefined);
                }}
                placeholder="От"
              />
              <NumberInput
                value={draftFilters.amountTo || ""}
                onChange={(event) => {
                  updateDraftFilter("amountTo", event.currentTarget.value || undefined);
                }}
                placeholder="До"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Пользователи</Label>
            <Select
              multiple
              allowClear
              label="Пользователи"
              options={memberOptions}
              value={draftFilters.userIds || []}
              onChange={(userIds) => {
                updateDraftFilter("userIds", userIds);
              }}
              placeholder="Все пользователи"
            />
          </div>

          <div className="space-y-2">
            <Label>Типы транзакций</Label>
            <Select
              multiple
              allowClear
              label="Типы транзакций"
              options={transactionTypeOptions}
              value={draftFilters.transactionTypes || []}
              onChange={(transactionTypes) => {
                updateDraftFilter("transactionTypes", transactionTypes);
              }}
              placeholder="Все типы"
            />
          </div>

          <div className="space-y-2">
            <Label>Категории</Label>
            <Select
              multiple
              allowClear
              disabled={isCategorySelectDisabled}
              label="Категории"
              options={categoryOptions}
              value={draftFilters.categoryIds || []}
              onChange={(categoryIds) => {
                updateDraftFilter("categoryIds", categoryIds);
              }}
              placeholder={isCategorySelectDisabled ? "Недоступно для выбранных типов" : "Все категории"}
            />
          </div>

          <div className="space-y-2">
            <Label>Счета</Label>
            <Select
              multiple
              allowClear
              label="Счета"
              options={accountOptions}
              value={draftFilters.accountIds || []}
              onChange={(accountIds) => {
                updateDraftFilter("accountIds", accountIds);
              }}
              placeholder="Все счета"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactions-filter-description">Описание</Label>
            <Input
              id="transactions-filter-description"
              value={draftFilters.description || ""}
              onChange={(event) => {
                updateDraftFilter("description", event.currentTarget.value || undefined);
              }}
              placeholder="Например, зарплата или аренда"
            />
          </div>

          <div className="space-y-2">
            <Label>Дата транзакции</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DatePicker
                date={toDateValue(draftFilters.dateFrom)}
                onSelect={(date) => {
                  updateDraftFilter("dateFrom", toDateString(date));
                }}
                placeholder="От"
              />
              <DatePicker
                date={toDateValue(draftFilters.dateTo)}
                onSelect={(date) => {
                  updateDraftFilter("dateTo", toDateString(date));
                }}
                placeholder="До"
              />
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-4 py-4">
          <Button variant="outline" onClick={onReset}>
            Сбросить
          </Button>
          <Button
            onClick={() => {
              onApply(normalizeTransactionFilters(draftFilters));
            }}
          >
            Применить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
