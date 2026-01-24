"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import * as React from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import {
  getCategoryAnalytics,
  getTotalAmount,
  type CategoryAnalyticsFilters,
} from "@/modules/analytics/analytics.service";
import { getWorkspaceCapital } from "@/modules/analytics/capital.service";
import type { CapitalFilters } from "@/modules/analytics/capital.types";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { getWorkspace } from "@/modules/workspace/workspace.service";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select/select";
import { type SelectOption, type RenderOption } from "@/shared/ui/select/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { formatMoney } from "@/shared/utils/money";

type PeriodType = "week" | "month" | "6months" | "year" | "custom";

interface Period {
  type: PeriodType;
  label: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function AnalyticsContent({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [transactionType, setTransactionType] = useState<TransactionType.INCOME | TransactionType.EXPENSE>(
    TransactionType.EXPENSE
  );
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [capitalAccountIds, setCapitalAccountIds] = useState<string[] | undefined>();
  const [capitalDebtType, setCapitalDebtType] = useState<"lent" | "borrowed" | "all">("all");

  const { data: workspaceData } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const { data: accountsData } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const allAccounts = React.useMemo(() => accountsData?.data || [], [accountsData?.data]);
  const currentUserId = session?.user?.id;

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

  const accountOptions: SelectOption<string>[] = React.useMemo(() => {
    if (sortedAccounts.length === 0) {
      return [];
    }

    const options: SelectOption<string>[] = [];

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
        const groupAccountIds = ownerGroup.accounts.map((acc) => acc.id);
        const allSelected = multiple && groupAccountIds.every((id) => capitalAccountIds?.includes(id));
        
        if (ownerGroup.owner) {
          return (
            <div className="px-2 py-1.5 flex items-center gap-2">
              {multiple && (
                <Checkbox checked={allSelected} className="shrink-0" onClick={(e) => e.stopPropagation()} />
              )}
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
          <div className="px-2 py-1.5 text-sm font-medium flex items-center gap-2">
            {multiple && (
              <Checkbox checked={allSelected} className="shrink-0" onClick={(e) => e.stopPropagation()} />
            )}
            <span>{ownerGroup.ownerName}</span>
          </div>
        );
      }

      return (
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {multiple && <div className="w-4" />}
          <span>{option.label}</span>
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

  const capitalFilters: CapitalFilters = useMemo(
    () => ({
      accountIds: capitalAccountIds && capitalAccountIds.length > 0 ? capitalAccountIds : undefined,
      debtType: capitalDebtType,
    }),
    [capitalAccountIds, capitalDebtType]
  );

  const { data: capitalData, isLoading: isCapitalLoading } = useQuery({
    queryKey: ["capital", workspaceId, capitalFilters],
    queryFn: () => getWorkspaceCapital(workspaceId, capitalFilters),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const capital = capitalData && "data" in capitalData ? capitalData.data : null;

  const debtTypeOptions: SelectOption<"lent" | "borrowed" | "all">[] = useMemo(
    () => [
      { value: "all", label: "Все" },
      { value: "lent", label: "Мне должны" },
      { value: "borrowed", label: "Я должен" },
    ],
    []
  );

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;

  const period = useMemo<Period>(() => {
    const now = new Date();
    const today = endOfDay(now);

    switch (periodType) {
      case "week":
        return {
          type: "week",
          label: "За последнюю неделю",
          dateFrom: startOfDay(subDays(now, 7)),
          dateTo: today,
        };
      case "month":
        return {
          type: "month",
          label: "За последний месяц",
          dateFrom: startOfDay(subMonths(now, 1)),
          dateTo: today,
        };
      case "6months":
        return {
          type: "6months",
          label: "За последние 6 месяцев",
          dateFrom: startOfDay(subMonths(now, 6)),
          dateTo: today,
        };
      case "year":
        return {
          type: "year",
          label: "За последний год",
          dateFrom: startOfDay(subMonths(now, 12)),
          dateTo: today,
        };
      case "custom":
        return {
          type: "custom",
          label: "Произвольный период",
          dateFrom: customDateFrom ? startOfDay(customDateFrom) : undefined,
          dateTo: customDateTo ? endOfDay(customDateTo) : undefined,
        };
      default:
        return {
          type: "month",
          label: "За последний месяц",
          dateFrom: startOfDay(subMonths(now, 1)),
          dateTo: today,
        };
    }
  }, [periodType, customDateFrom, customDateTo]);

  const filters: CategoryAnalyticsFilters = useMemo(
    () => ({
      type: transactionType,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    }),
    [transactionType, period.dateFrom, period.dateTo]
  );

  const dateFilters = useMemo(
    () => ({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    }),
    [period.dateFrom, period.dateTo]
  );

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["categoryAnalytics", workspaceId, filters],
    queryFn: () => getCategoryAnalytics(workspaceId, filters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const { data: totalIncomeData } = useQuery({
    queryKey: ["totalIncome", workspaceId, dateFilters],
    queryFn: () => getTotalAmount(workspaceId, TransactionType.INCOME, dateFilters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const { data: totalExpenseData } = useQuery({
    queryKey: ["totalExpense", workspaceId, dateFilters],
    queryFn: () => getTotalAmount(workspaceId, TransactionType.EXPENSE, dateFilters),
    enabled: !!workspaceId && !!period.dateFrom && !!period.dateTo,
    staleTime: 5000,
  });

  const analytics = analyticsData && "data" in analyticsData ? analyticsData.data : [];
  const totalIncome = totalIncomeData && "data" in totalIncomeData ? totalIncomeData.data : "0";
  const totalExpense = totalExpenseData && "data" in totalExpenseData ? totalExpenseData.data : "0";

  const periodOptions: SelectOption<PeriodType>[] = useMemo(
    () => [
      { value: "week", label: "За последнюю неделю" },
      { value: "month", label: "За последний месяц" },
      { value: "6months", label: "За последние 6 месяцев" },
      { value: "year", label: "За последний год" },
      { value: "custom", label: "Произвольный период" },
    ],
    []
  );

  const handleViewDetails = (categoryId: string | null) => {
    const params = new URLSearchParams();
    params.set("workspaceId", workspaceId);

    if (categoryId) {
      params.set("categoryIds", categoryId);
    }

    if (period.dateFrom) {
      params.set("dateFrom", period.dateFrom.toISOString());
    }

    if (period.dateTo) {
      params.set("dateTo", period.dateTo.toISOString());
    }

    params.set("types", transactionType);

    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h1 className="text-2xl font-bold">Аналитика</h1>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Капитал</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
              <div className="w-full sm:w-auto">
                <Select
                  options={accountOptions}
                  value={capitalAccountIds}
                  onChange={(value) => setCapitalAccountIds(Array.isArray(value) && value.length > 0 ? value : undefined)}
                  placeholder="Все счета"
                  label="Счета"
                  multiple
                  allowClear
                  renderOption={renderAccountOption}
                  popoverClassName="w-fit max-w-[200px]"
                />
              </div>
              <div className="w-full sm:w-auto">
                <Select
                  options={debtTypeOptions}
                  value={capitalDebtType}
                  onChange={(value) => setCapitalDebtType(value as "lent" | "borrowed" | "all")}
                  placeholder="Все долги"
                  label="Долги"
                  multiple={false}
                  popoverClassName="w-fit max-w-[200px]"
                />
              </div>
            </div>
            {isCapitalLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка капитала...</div>
            ) : capital ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Капитал (USD)</div>
                  <div className="text-2xl font-semibold">{formatMoney(capital.USD, Currency.USD)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Капитал (EUR)</div>
                  <div className="text-2xl font-semibold">{formatMoney(capital.EUR, Currency.EUR)}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Капитал (BYN)</div>
                  <div className="text-2xl font-semibold">{formatMoney(capital.BYN, Currency.BYN)}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Не удалось загрузить капитал</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Segmented
              options={[
                { value: TransactionType.EXPENSE, label: "Расходы" },
                { value: TransactionType.INCOME, label: "Доходы" },
              ]}
              value={transactionType}
              onChange={(value) => setTransactionType(value as TransactionType.INCOME | TransactionType.EXPENSE)}
            />

            <div className="flex-1" />

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select
                value={periodType}
                onChange={(value) => setPeriodType(value as PeriodType)}
                options={periodOptions}
                placeholder="Выберите период"
                multiple={false}
              />

              {periodType === "custom" && (
                <>
                  <DatePicker
                    date={customDateFrom}
                    onSelect={setCustomDateFrom}
                    placeholder="От"
                    className="w-full sm:w-[150px]"
                  />
                  <DatePicker
                    date={customDateTo}
                    onSelect={setCustomDateTo}
                    placeholder="До"
                    className="w-full sm:w-[150px]"
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Общий доход</div>
              <div className="text-2xl font-semibold text-success-primary">
                {formatMoney(totalIncome, baseCurrency)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Общий расход</div>
              <div className="text-2xl font-semibold text-error-primary">{formatMoney(totalExpense, baseCurrency)}</div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Категория</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Процент</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : analytics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                analytics.map((item) => (
                  <TableRow
                    key={item.categoryId || "no-category"}
                    onClick={() => handleViewDetails(item.categoryId)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.categoryColor && (
                          <div className="size-3 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                        )}
                        <span>{item.categoryName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(item.totalAmount, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
