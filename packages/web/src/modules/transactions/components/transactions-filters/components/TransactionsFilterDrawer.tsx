import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CategoryIcon } from "@/shared/components/category-icon";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NumberInput } from "@/shared/ui/number-input";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { AccountIcon } from "@/shared/utils/account-icons";
import { cn } from "@/shared/utils/cn";
import { formatMoney } from "@/shared/utils/money";

import type {
  TransactionFilterAccount,
  TransactionFilterCategory,
  TransactionFilterMember,
  TransactionViewFilters,
} from "../types";
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
  appliedFilters: TransactionViewFilters;
  members: TransactionFilterMember[];
  categories: TransactionFilterCategory[];
  accounts: TransactionFilterAccount[];
  isCategoriesLoading?: boolean;
  isMembersLoading?: boolean;
  onApply: (filters: TransactionViewFilters) => void;
  onReset: () => void;
}

export function TransactionsFilterDrawer({
  open,
  onOpenChange,
  appliedFilters,
  members,
  categories,
  accounts,
  isCategoriesLoading = false,
  isMembersLoading = false,
  onApply,
  onReset,
}: TransactionsFilterDrawerProps) {
  const [draftFilters, setDraftFilters] = useState<TransactionViewFilters>(() =>
    normalizeTransactionFilters(appliedFilters)
  );

  const updateDraftFilter = <TKey extends keyof TransactionViewFilters>(
    key: TKey,
    value: TransactionViewFilters[TKey]
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
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
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
    if (isCategoriesLoading || !draftFilters.categoryIds?.length) {
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
  }, [draftFilters.categoryIds, isCategoriesLoading, selectableCategoryIds]);

  const isCategorySelectDisabled = isCategoriesLoading || allowedCategoryTypes.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 pb-4">
          <SheetTitle>Фильтр транзакций</SheetTitle>
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
              disabled={isMembersLoading}
              label="Пользователи"
              options={memberOptions}
              renderOption={({ option, selected, isTrigger }) => {
                const member = membersById.get(String(option.value));

                return (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {member && <UserAvatar name={member.name} email={member.email} image={member.image} size="sm" />}
                    <span className={cn("min-w-0 flex-1 truncate font-normal", !isTrigger && "text-xs")}>
                      {option.label}
                    </span>
                    {selected && !isTrigger && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                );
              }}
              value={draftFilters.userIds || []}
              onChange={(userIds) => {
                updateDraftFilter("userIds", userIds);
              }}
              placeholder={isMembersLoading ? "Загрузка…" : "Все пользователи"}
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
              renderOption={({ option, selected, isTrigger }) => {
                const category = categoriesById.get(String(option.value));

                if (!category) {
                  return <span className="text-xs font-medium text-muted-foreground">{option.label}</span>;
                }

                return (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <CategoryIcon icon={category.icon} iconAssetId={category.iconAssetId} className="size-4" />
                    <span className={cn("min-w-0 flex-1 truncate font-normal", !isTrigger && "text-xs")}>
                      {option.label}
                    </span>
                    {selected && !isTrigger && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                );
              }}
              onChange={(categoryIds) => {
                updateDraftFilter("categoryIds", categoryIds);
              }}
              placeholder={
                isCategoriesLoading
                  ? "Загрузка…"
                  : isCategorySelectDisabled
                    ? "Недоступно для выбранных типов"
                    : "Все категории"
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Счета</Label>
            <Select
              multiple
              allowClear
              label="Счета"
              options={accountOptions}
              renderOption={({ option, selected, isTrigger }) => {
                const account = accountsById.get(String(option.value));

                return (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {account && (
                      <AccountIcon
                        iconName={account.icon}
                        accountColor={account.color}
                        accountName={account.name}
                        className="size-4 shrink-0"
                      />
                    )}
                    <span className={cn("min-w-0 flex-1 truncate font-normal", !isTrigger && "text-xs")}>
                      {option.label}
                    </span>
                    {account && !isTrigger && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatMoney(account.balance, account.currency)}
                      </span>
                    )}
                    {selected && !isTrigger && <Check className="size-4 shrink-0 text-primary" />}
                  </span>
                );
              }}
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

          <div className="space-y-2 md:hidden">
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
          <Button variant="secondary" size="lg" onClick={onReset}>
            Сбросить
          </Button>
          <Button
            size="lg"
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
