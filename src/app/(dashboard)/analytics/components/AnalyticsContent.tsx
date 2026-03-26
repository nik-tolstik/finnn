"use client";

import { Currency } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
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
import { getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { UserDisplay } from "@/shared/components/UserDisplay";
import { DEFAULT_CURRENCY } from "@/shared/constants/currency";
import { accountKeys, analyticsKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Segmented } from "@/shared/ui/segmented";
import { Select } from "@/shared/ui/select/select";
import type { SelectOption, RenderOption } from "@/shared/ui/select/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { getAccountIcon } from "@/shared/utils/account-icons";
import { formatMoney } from "@/shared/utils/money";

export function AnalyticsContent({ workspaceId }: { workspaceId: string }) {
  const { data: session } = useSession();
  const [transactionType, setTransactionType] = useState<TransactionType.INCOME | TransactionType.EXPENSE>(
    TransactionType.EXPENSE
  );
  const now = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfDay(subMonths(now, 1)));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfDay(now));
  const [capitalAccountIds, setCapitalAccountIds] = useState<string[] | undefined>();
  const [excludeDebts, setExcludeDebts] = useState(false);

  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const { data: accountsData } = useQuery({
    queryKey: accountKeys.list(workspaceId),
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
      grouped.get(ownerId)?.push(account);
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
        if (ownerGroup.owner) {
          return (
            <div className="px-2 py-1.5">
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
        return <div className="px-2 py-1.5 text-sm font-medium">{ownerGroup.ownerName}</div>;
      }

      return (
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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

  const capitalFilters: CapitalFilters = useMemo(
    () => ({
      accountIds: capitalAccountIds && capitalAccountIds.length > 0 ? capitalAccountIds : undefined,
      excludeDebts,
    }),
    [capitalAccountIds, excludeDebts]
  );

  const { data: capitalData, isLoading: isCapitalLoading } = useQuery({
    queryKey: analyticsKeys.capital(workspaceId, capitalFilters),
    queryFn: () => getWorkspaceCapital(workspaceId, capitalFilters),
    enabled: !!workspaceId,
    staleTime: 5000,
  });

  const capital = capitalData && "data" in capitalData ? capitalData.data : null;

  const baseCurrency =
    workspaceData && "data" in workspaceData && workspaceData.data
      ? (workspaceData.data.baseCurrency as Currency) || DEFAULT_CURRENCY
      : DEFAULT_CURRENCY;

  const setPeriod = (days: number) => {
    const today = endOfDay(new Date());
    setDateFrom(startOfDay(subDays(today, days)));
    setDateTo(today);
  };

  const setPeriodMonths = (months: number) => {
    const today = endOfDay(new Date());
    setDateFrom(startOfDay(subMonths(today, months)));
    setDateTo(today);
  };

  const filters: CategoryAnalyticsFilters = useMemo(
    () => ({
      type: transactionType,
      dateFrom,
      dateTo,
    }),
    [transactionType, dateFrom, dateTo]
  );

  const dateFilters = useMemo(
    () => ({
      dateFrom,
      dateTo,
    }),
    [dateFrom, dateTo]
  );

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: analyticsKeys.category(workspaceId, filters),
    queryFn: () => getCategoryAnalytics(workspaceId, filters),
    enabled: !!workspaceId && !!dateFrom && !!dateTo,
    staleTime: 5000,
  });

  const { data: totalIncomeData } = useQuery({
    queryKey: analyticsKeys.total(workspaceId, TransactionType.INCOME, dateFilters),
    queryFn: () => getTotalAmount(workspaceId, TransactionType.INCOME, dateFilters),
    enabled: !!workspaceId && !!dateFrom && !!dateTo,
    staleTime: 5000,
  });

  const { data: totalExpenseData } = useQuery({
    queryKey: analyticsKeys.total(workspaceId, TransactionType.EXPENSE, dateFilters),
    queryFn: () => getTotalAmount(workspaceId, TransactionType.EXPENSE, dateFilters),
    enabled: !!workspaceId && !!dateFrom && !!dateTo,
    staleTime: 5000,
  });

  const analytics = analyticsData && "data" in analyticsData ? analyticsData.data : [];
  const totalIncome = totalIncomeData && "data" in totalIncomeData ? totalIncomeData.data : "0";
  const totalExpense = totalExpenseData && "data" in totalExpenseData ? totalExpenseData.data : "0";

  const daysDifference = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    const diffTime = dateTo.getTime() - dateFrom.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  }, [dateFrom, dateTo]);

  const averageExpensePerDay = useMemo(() => {
    if (daysDifference === 0) return "0";
    const total = parseFloat(totalExpense);
    return (total / daysDifference).toFixed(2);
  }, [totalExpense, daysDifference]);

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h1 className="text-2xl font-bold">Аналитика</h1>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Капитал</h2>
            {accountsData ? (
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center mb-4">
                <div className="w-full sm:w-auto">
                  <Select
                    options={accountOptions}
                    value={capitalAccountIds}
                    onChange={(value) =>
                      setCapitalAccountIds(Array.isArray(value) && value.length > 0 ? value : undefined)
                    }
                    placeholder="Все счета"
                    label="Счета"
                    multiple
                    allowClear
                    renderOption={renderAccountOption}
                    popoverClassName="w-fit max-w-[200px]"
                  />
                </div>
                <label htmlFor="exclude-debts" className="flex items-center gap-2">
                  <Checkbox
                    id="exclude-debts"
                    checked={excludeDebts}
                    onCheckedChange={(checked) => setExcludeDebts(checked === true)}
                  />
                  <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Без долгов
                  </span>
                </label>
              </div>
            ) : null}
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

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-start sm:items-center">
              <DatePicker date={dateFrom} onSelect={setDateFrom} placeholder="От" className="w-full sm:w-[150px]" />
              <DatePicker date={dateTo} onSelect={setDateTo} placeholder="До" className="w-full sm:w-[150px]" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPeriod(7)}>
              7 дней
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPeriod(30)}>
              30 дней
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodMonths(6)}>
              6 месяцев
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodMonths(12)}>
              1 год
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Ср. расход в день</div>
              <div className="text-2xl font-semibold text-error-primary">
                {formatMoney(averageExpensePerDay, baseCurrency)}
              </div>
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
                  <TableRow key={item.categoryId || "no-category"}>
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
