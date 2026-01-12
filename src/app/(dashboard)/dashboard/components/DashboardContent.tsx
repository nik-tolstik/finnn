"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import * as React from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountsCards } from "@/modules/accounts/components/AccountsCards";
import { CreateAccountDialog } from "@/modules/accounts/components/CreateAccountDialog";
import { TransactionsFilters } from "@/modules/transactions/components/TransactionsFilters";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";
import { TransactionsListSkeleton } from "@/modules/transactions/components/TransactionsListSkeleton";
import { TransactionType } from "@/modules/transactions/transaction.constants";
import { getTransactions, type TransactionFilters } from "@/modules/transactions/transaction.service";
import type { TransactionWithRelations } from "@/modules/transactions/transaction.types";
import { useDialogState } from "@/shared/hooks/useDialogState";

import { AccountsMenu } from "./AccountsMenu";

type AccountWithOwner = Account & {
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

interface DashboardContentProps {
  accounts: AccountWithOwner[];
  workspaceId: string;
}

const TRANSACTIONS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300;

function isSuccessResponse(data: any): data is { data: TransactionWithRelations[]; total: number } {
  return data && "data" in data && !("error" in data);
}

export function DashboardContent({ accounts, workspaceId }: DashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);

  const parseFiltersFromURL = (): TransactionFilters => {
    const filters: TransactionFilters = {};

    const parseArray = (value: string | null): string[] | undefined => {
      if (!value) return undefined;
      const arr = value.split(",").filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    };

    const parseDate = (value: string | null): Date | undefined => {
      if (!value) return undefined;
      const date = new Date(value);
      return !isNaN(date.getTime()) ? date : undefined;
    };

    const categoryIds = parseArray(searchParams.get("categoryIds"));
    if (categoryIds) filters.categoryIds = categoryIds;

    const accountIds = parseArray(searchParams.get("accountIds"));
    if (accountIds) filters.accountIds = accountIds;

    const types = parseArray(searchParams.get("types"));
    if (types) filters.types = types as TransactionType[];

    const dateFrom = parseDate(searchParams.get("dateFrom"));
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = parseDate(searchParams.get("dateTo"));
    if (dateTo) filters.dateTo = dateTo;

    const search = searchParams.get("search");
    if (search) filters.search = search;

    const minAmount = searchParams.get("minAmount");
    if (minAmount) filters.minAmount = minAmount;

    const maxAmount = searchParams.get("maxAmount");
    if (maxAmount) filters.maxAmount = maxAmount;

    return filters;
  };

  const [localFilters, setLocalFilters] = useState<TransactionFilters>(() => parseFiltersFromURL());
  const [debouncedFilters, setDebouncedFilters] = useState<TransactionFilters>({});
  const [cachedTransactions, setCachedTransactions] = useState<{
    data: TransactionWithRelations[];
    total: number;
    filtersKey: string;
  } | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const createAccountDialog = useDialogState();

  const filtersKey = JSON.stringify(debouncedFilters);

  const updateFilters = useCallback(
    (newFilters: TransactionFilters) => {
      setLocalFilters(newFilters);

      const params = new URLSearchParams();
      params.set("workspaceId", workspaceId);

      const setArrayParam = (key: string, value: string[] | undefined) => {
        if (value && value.length > 0) {
          params.set(key, value.join(","));
        }
      };

      const setDateParam = (key: string, value: Date | undefined) => {
        if (value) {
          params.set(key, value.toISOString());
        }
      };

      setArrayParam("categoryIds", newFilters.categoryIds);
      setArrayParam("accountIds", newFilters.accountIds);
      setArrayParam("types", newFilters.types);

      setDateParam("dateFrom", newFilters.dateFrom);
      setDateParam("dateTo", newFilters.dateTo);

      if (newFilters.search) params.set("search", newFilters.search);
      if (newFilters.minAmount) params.set("minAmount", newFilters.minAmount);
      if (newFilters.maxAmount) params.set("maxAmount", newFilters.maxAmount);

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [workspaceId, pathname, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(localFilters);
      setDisplayedCount(TRANSACTIONS_PER_PAGE);
      setHasInitiallyLoaded(false);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [localFilters]);

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    initialData: { data: accounts },
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const {
    data: transactionsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["transactions", workspaceId, debouncedFilters, displayedCount],
    queryFn: () =>
      getTransactions(workspaceId, {
        ...debouncedFilters,
        skip: 0,
        take: displayedCount,
      } as TransactionFilters),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!isFetching && isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [isFetching, isLoadingMore]);

  useEffect(() => {
    if (isSuccessResponse(transactionsData)) {
      setCachedTransactions({
        data: transactionsData.data,
        total: transactionsData.total,
        filtersKey,
      });
      if (!hasInitiallyLoaded && transactionsData.data.length > 0) {
        setHasInitiallyLoaded(true);
      }
    }
  }, [transactionsData, filtersKey, hasInitiallyLoaded]);

  const displayAccounts = accountsData?.data || accounts;

  let displayedTransactions: TransactionWithRelations[] = [];
  let total = 0;

  if (isSuccessResponse(transactionsData)) {
    displayedTransactions = transactionsData.data;
    total = transactionsData.total;
  } else if (cachedTransactions && cachedTransactions.filtersKey === filtersKey) {
    displayedTransactions = cachedTransactions.data;
    total = cachedTransactions.total;
  }

  const hasMore = total > displayedCount;
  const isInitialLoading = isLoading && !hasInitiallyLoaded && displayedTransactions.length === 0;

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Счета</h2>
            <AccountsMenu
              isReorderMode={isReorderMode}
              showAllAccounts={showAllAccounts}
              onReorderModeChange={setIsReorderMode}
              onShowAllAccountsChange={setShowAllAccounts}
              onCreateAccount={() => createAccountDialog.openDialog(null)}
              onCancelReorder={() => {
                const event = new CustomEvent("cancelReorder");
                window.dispatchEvent(event);
                setIsReorderMode(false);
                setShowAllAccounts(false);
              }}
              onSaveReorder={() => {
                const event = new CustomEvent("saveReorder");
                window.dispatchEvent(event);
              }}
            />
          </div>
          <AccountsCards
            accounts={displayAccounts}
            workspaceId={workspaceId}
            isLoading={isLoadingAccounts}
            reorderMode={isReorderMode}
            onReorderModeChange={setIsReorderMode}
            onCancelReorder={() => {
              setIsReorderMode(false);
              setShowAllAccounts(false);
            }}
            showAllAccounts={showAllAccounts}
            onShowAllAccountsChange={setShowAllAccounts}
          />
        </div>

        {createAccountDialog.mounted && (
          <CreateAccountDialog
            workspaceId={workspaceId}
            open={createAccountDialog.open}
            onOpenChange={createAccountDialog.closeDialog}
            onCloseComplete={createAccountDialog.unmountDialog}
          />
        )}

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Последние транзакции</h2>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {isInitialLoading ? (
                <TransactionsListSkeleton />
              ) : displayedTransactions && displayedTransactions.length > 0 ? (
                <TransactionsList
                  transactions={displayedTransactions}
                  showLoadMore={hasMore}
                  onLoadMore={() => {
                    setIsLoadingMore(true);
                    setDisplayedCount((prev) => prev + TRANSACTIONS_PER_PAGE);
                  }}
                  workspaceId={workspaceId}
                  isLoadingMore={isLoadingMore}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">Нет транзакций.</div>
              )}
            </div>
            <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
              <div className="lg:sticky lg:top-4 lg:bg-card lg:rounded-lg lg:p-4">
                <TransactionsFilters workspaceId={workspaceId} filters={localFilters} onFiltersChange={updateFilters} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
