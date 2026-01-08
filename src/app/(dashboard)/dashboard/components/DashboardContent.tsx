"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, X, Check, Plus, MoreVertical, ArrowLeftRight } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountsCards } from "@/modules/accounts/components/AccountsCards";
import { CreateAccountDialog } from "@/modules/accounts/components/CreateAccountDialog";
import { TransactionsFilters } from "@/modules/transactions/components/TransactionsFilters";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";
import { TransactionsListSkeleton } from "@/modules/transactions/components/TransactionsListSkeleton";
import { getTransactions, type TransactionFilters } from "@/modules/transactions/transaction.service";
import type { TransactionWithRelations } from "@/modules/transactions/transaction.types";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

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
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);
  const [localFilters, setLocalFilters] = useState<TransactionFilters>({});
  const [debouncedFilters, setDebouncedFilters] = useState<TransactionFilters>({});
  const [cachedTransactions, setCachedTransactions] = useState<{
    data: TransactionWithRelations[];
    total: number;
    filtersKey: string;
  } | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const createAccountDialog = useDialogState();

  const filtersKey = JSON.stringify(debouncedFilters);

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
            {!isReorderMode ? (
              <>
                <div className="hidden md:flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createAccountDialog.openDialog(null)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Новый
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsReorderMode(true)} className="gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Изменить порядок
                  </Button>
                </div>
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon-sm" className="md:hidden">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          createAccountDialog.openDialog(null);
                          setMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                        )}
                      >
                        <Plus className="h-4 w-4" />
                        Новый
                      </button>
                      <button
                        onClick={() => {
                          setIsReorderMode(true);
                          setMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                        )}
                      >
                        <GripVertical className="h-4 w-4" />
                        Изменить порядок
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const event = new CustomEvent("cancelReorder");
                    window.dispatchEvent(event);
                    setIsReorderMode(false);
                  }}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Отменить
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const event = new CustomEvent("saveReorder");
                    window.dispatchEvent(event);
                  }}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Сохранить
                </Button>
              </div>
            )}
          </div>
          <AccountsCards
            accounts={displayAccounts}
            workspaceId={workspaceId}
            isLoading={isLoadingAccounts}
            reorderMode={isReorderMode}
            onReorderModeChange={setIsReorderMode}
            onCancelReorder={() => setIsReorderMode(false)}
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
                <TransactionsFilters
                  workspaceId={workspaceId}
                  filters={localFilters}
                  onFiltersChange={(newFilters) => {
                    setLocalFilters(newFilters);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
