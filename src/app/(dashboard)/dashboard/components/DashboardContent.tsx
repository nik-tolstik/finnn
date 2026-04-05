"use client";

import type { Account } from "@prisma/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { getVisibleAccounts, resolveViewerUserId } from "@/modules/accounts/account-visibility";
import { AccountsCards } from "@/modules/accounts/components/accounts-cards";
import { CreateAccountDialog } from "@/modules/accounts/components/create-account-dialog";
import { getCategories } from "@/modules/categories/category.service";
import { CombinedTransactionsList } from "@/modules/transactions/components/combined-transactions-list";
import {
  TransactionsFilterButton,
  TransactionsFilterDrawer,
  useTransactionFilters,
} from "@/modules/transactions/components/transactions-filters";
import { TransactionsListSkeleton } from "@/modules/transactions/components/transactions-list-skeleton";
import { getCombinedTransactions } from "@/modules/transactions/transaction.service";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { getWorkspaceMembers } from "@/modules/workspace/workspace.service";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { accountKeys, categoryKeys, transactionKeys, workspaceKeys } from "@/shared/lib/query-keys";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";

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
  allAccounts?: AccountWithOwner[];
  initialCurrentUserId?: string;
  workspaceId: string;
}

const TRANSACTIONS_PER_PAGE = 20;

function isSuccessResponse(data: any): data is { data: CombinedTransaction[]; total: number } {
  return data && "data" in data && !("error" in data);
}

export function DashboardContent({ accounts, allAccounts, initialCurrentUserId, workspaceId }: DashboardContentProps) {
  const { data: session } = useSession();
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
  const createAccountDialog = useDialogState();

  const {
    appliedFilters,
    appliedFiltersCount,
    appliedFiltersKey,
    includeDebtTransactions,
    isNavigationPending: isFiltersNavigationPending,
    applyFilters,
    resetFilters,
  } = useTransactionFilters();

  const {
    data: accountsData,
    isLoading: isLoadingAccounts,
    isFetching: isFetchingAccounts,
  } = useQuery({
    queryKey: accountKeys.list(workspaceId),
    queryFn: () => getAccounts(workspaceId),
    initialData: { data: allAccounts || accounts },
    staleTime: 5000,
  });

  const { data: membersData } = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
    staleTime: 5000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => getCategories(workspaceId),
    staleTime: 5000,
  });

  const viewerUserId = resolveViewerUserId(session?.user?.id, initialCurrentUserId);
  const availableAccounts = useMemo(
    () => accountsData?.data || allAccounts || accounts,
    [accountsData?.data, allAccounts, accounts]
  );

  const displayAccounts = useMemo(() => {
    return getVisibleAccounts(availableAccounts, viewerUserId, showAllAccounts);
  }, [availableAccounts, showAllAccounts, viewerUserId]);

  const isAccountsLoading = isLoadingAccounts || (isFetchingAccounts && accounts.length === 0);
  const transactionFilters = useMemo(
    () => ({
      ...appliedFilters,
      skip: 0,
      take: displayedCount,
      includeDebtTransactions,
    }),
    [appliedFilters, displayedCount, includeDebtTransactions]
  );

  const {
    data: transactionsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: transactionKeys.list(workspaceId, transactionFilters),
    queryFn: () => getCombinedTransactions(workspaceId, transactionFilters),
    placeholderData: keepPreviousData,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!appliedFiltersKey) {
      return;
    }

    setDisplayedCount(TRANSACTIONS_PER_PAGE);
    setIsLoadingMore(false);
  }, [appliedFiltersKey]);

  useEffect(() => {
    if (!isFetching && isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [isFetching, isLoadingMore]);

  const displayedTransactions = isSuccessResponse(transactionsData) ? transactionsData.data : [];
  const total = isSuccessResponse(transactionsData) ? transactionsData.total : 0;

  const hasMore = total > displayedCount;
  const isInitialLoading = isLoading && displayedTransactions.length === 0;

  const handleApplyFilters = (nextFilters: Parameters<typeof applyFilters>[0]) => {
    setDisplayedCount(TRANSACTIONS_PER_PAGE);
    setIsLoadingMore(false);
    setIsFiltersDrawerOpen(false);
    applyFilters(nextFilters);
  };

  const handleResetFilters = () => {
    setDisplayedCount(TRANSACTIONS_PER_PAGE);
    setIsLoadingMore(false);
    setIsFiltersDrawerOpen(false);
    resetFilters();
  };

  return (
    <div className="w-full max-w-[1024px] mx-auto">
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-semibold">{showAllAccounts ? "Все счета" : "Ваши счета"}</h2>
              <Badge variant="secondary" className="text-xs">
                {displayAccounts.length}
              </Badge>
              <TooltipProvider delayDuration={200} disableHoverableContent>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowAllAccounts(!showAllAccounts)}
                      className="h-8 w-8"
                    >
                      {showAllAccounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block">
                    <p>{showAllAccounts ? "Показать только ваши счета" : "Показать все счета"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <AccountsMenu
              isReorderMode={isReorderMode}
              onReorderModeChange={setIsReorderMode}
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
            initialCurrentUserId={initialCurrentUserId}
            workspaceId={workspaceId}
            isLoading={isAccountsLoading}
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-semibold">Последние транзакции</h2>
            <TransactionsFilterButton
              appliedFiltersCount={appliedFiltersCount}
              disabled={isFiltersNavigationPending}
              onClick={() => {
                setIsFiltersDrawerOpen(true);
              }}
            />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {isInitialLoading ? (
                <TransactionsListSkeleton count={30} />
              ) : displayedTransactions && displayedTransactions.length > 0 ? (
                <CombinedTransactionsList
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
          </div>
        </div>
      </div>

      <TransactionsFilterDrawer
        open={isFiltersDrawerOpen}
        onOpenChange={setIsFiltersDrawerOpen}
        appliedFilters={appliedFilters}
        members={membersData?.data || []}
        categories={categoriesData?.data || []}
        accounts={availableAccounts}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </div>
  );
}
