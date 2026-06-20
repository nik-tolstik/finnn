"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useMemo, useState } from "react";

import type { AnalyticsCalendarCell } from "@/modules/analytics/analytics.view-model";
import { CombinedTransactionsList } from "@/modules/transactions/components/combined-transactions-list";
import type { TransactionViewFilters } from "@/modules/transactions/components/transactions-filters";
import { shouldIncludeDebtTransactions } from "@/modules/transactions/components/transactions-filters";
import { getCombinedTransactions } from "@/modules/transactions/transaction.api";
import type { TransactionListFilters } from "@/modules/transactions/transaction-filter.types";
import { useBreakpoints } from "@/shared/hooks/useBreakpoints";
import { transactionKeys } from "@/shared/lib/query-keys";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";

interface AnalyticsDayDetailsProps {
  appliedFilters: TransactionViewFilters;
  day: AnalyticsCalendarCell | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  workspaceId: string;
}

const DAY_TRANSACTIONS_PAGE_SIZE = 50;

type CombinedTransactionsResult = Awaited<ReturnType<typeof getCombinedTransactions>>;
type CombinedTransactionsSuccess = Extract<CombinedTransactionsResult, { data: unknown[]; total: number }>;

function isTransactionsSuccess(data: CombinedTransactionsResult | undefined): data is CombinedTransactionsSuccess {
  return Boolean(data && "data" in data);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/35 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function AnalyticsDayDetails({
  appliedFilters,
  day,
  onOpenChange,
  open,
  workspaceId,
}: AnalyticsDayDetailsProps) {
  const { isMobile } = useBreakpoints();
  const dayDate = day?.date;
  const filtersKey = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
  const paginationKey = `${dayDate ?? ""}:${filtersKey}`;
  const [pagination, setPagination] = useState({ count: DAY_TRANSACTIONS_PAGE_SIZE, key: paginationKey });
  const displayedCount = pagination.key === paginationKey ? pagination.count : DAY_TRANSACTIONS_PAGE_SIZE;

  const dayFilters = useMemo<TransactionListFilters | null>(() => {
    if (!dayDate) {
      return null;
    }

    return {
      ...appliedFilters,
      dateFrom: dayDate,
      dateTo: dayDate,
      skip: 0,
      take: displayedCount,
      includeDebtTransactions: shouldIncludeDebtTransactions(appliedFilters.transactionTypes),
    };
  }, [appliedFilters, dayDate, displayedCount]);

  const queryKeyFilters = dayFilters ?? { dateFrom: "", dateTo: "", skip: 0, take: 0 };
  const { data, isFetching, isLoading } = useQuery({
    queryKey: transactionKeys.list(workspaceId, queryKeyFilters),
    queryFn: () =>
      dayFilters ? getCombinedTransactions(workspaceId, dayFilters) : Promise.resolve({ data: [], total: 0 }),
    enabled: open && Boolean(dayFilters),
    placeholderData: keepPreviousData,
  });

  const transactions = isTransactionsSuccess(data) ? data.data : [];
  const total = isTransactionsSuccess(data) ? data.total : 0;
  const summary = {
    incomeLabel: day?.incomeLabel ?? "0",
    expenseLabel: day?.expenseLabel ?? "0",
    netLabel: day?.netLabel ?? "0",
  };
  const hasMore = total > displayedCount;
  const dateLabel = day?.date ? format(new Date(`${day.date}T00:00:00`), "d MMMM yyyy", { locale: ru }) : "";
  const showInitialLoading = isLoading && transactions.length === 0;
  const errorMessage = data && "error" in data ? data.error : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[92vh] min-h-[78vh] rounded-t-2xl"
            : "h-full w-full border-l sm:max-w-none md:max-w-[520px] lg:max-w-[620px]"
        }
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg">{dateLabel || "День"}</SheetTitle>
          <SheetDescription>
            {day ? `${day.transactionCount} операций по текущим фильтрам` : "Выберите день календаря"}
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 px-4">
          <SummaryItem label="Доход" value={summary.incomeLabel} />
          <SummaryItem label="Расход" value={summary.expenseLabel} />
          <SummaryItem label="Итого" value={summary.netLabel} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {showInitialLoading ? (
            <div className="space-y-3 pt-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-md" />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{errorMessage}</div>
          ) : (
            <CombinedTransactionsList
              transactions={transactions}
              workspaceId={workspaceId}
              showLoadMore={hasMore}
              showDateHeaders={false}
              isLoadingMore={isFetching && transactions.length > 0}
              onLoadMore={() => {
                setPagination({
                  key: paginationKey,
                  count: displayedCount + DAY_TRANSACTIONS_PAGE_SIZE,
                });
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
