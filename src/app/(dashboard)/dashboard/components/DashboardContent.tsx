"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountsCards } from "@/modules/accounts/components/AccountsCards";
import { CreateAccountDialog } from "@/modules/accounts/components/CreateAccountDialog";
import { CombinedTransactionsList } from "@/modules/transactions/components/CombinedTransactionsList";
import { TransactionsListSkeleton } from "@/modules/transactions/components/TransactionsListSkeleton";
import { getCombinedTransactions } from "@/modules/transactions/transaction.service";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { useDialogState } from "@/shared/hooks/useDialogState";
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
  workspaceId: string;
}

const TRANSACTIONS_PER_PAGE = 20;

function isSuccessResponse(data: any): data is { data: CombinedTransaction[]; total: number } {
  return data && "data" in data && !("error" in data);
}

export function DashboardContent({ accounts, allAccounts, workspaceId }: DashboardContentProps) {
  const { data: session } = useSession();
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const createAccountDialog = useDialogState();

  const {
    data: accountsData,
    isLoading: isLoadingAccounts,
    isFetching: isFetchingAccounts,
  } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    initialData: { data: allAccounts || accounts },
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const currentUserId = session?.user?.id;

  const displayAccounts = useMemo(() => {
    if (showAllAccounts) {
      const allAccountsToUse = accountsData?.data || allAccounts;
      if (allAccountsToUse) {
        return allAccountsToUse;
      }
      return accounts;
    }

    if (!currentUserId) {
      return accounts;
    }

    const allAccountsToUse = accountsData?.data || allAccounts;
    const accountsToFilter = allAccountsToUse || accounts;
    return accountsToFilter.filter((account) => account.ownerId === currentUserId);
  }, [accountsData?.data, allAccounts, accounts, showAllAccounts, currentUserId]);

  const isAccountsLoading = isLoadingAccounts || (isFetchingAccounts && accounts.length === 0);

  const {
    data: transactionsData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["combinedTransactions", workspaceId, displayedCount],
    queryFn: () =>
      getCombinedTransactions(workspaceId, {
        skip: 0,
        take: displayedCount,
        includeDebtTransactions: true,
      }),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!isFetching && isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [isFetching, isLoadingMore]);

  const displayedTransactions = isSuccessResponse(transactionsData) ? transactionsData.data : [];
  const total = isSuccessResponse(transactionsData) ? transactionsData.total : 0;

  const hasMore = total > displayedCount;
  const isInitialLoading = isLoading && displayedTransactions.length === 0;

  return (
    <div className="w-full max-w-[1024px] mx-auto">
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold">{showAllAccounts ? "Все счета" : "Ваши счета"}</h2>
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
          <h2 className="mb-4 text-2xl font-semibold">Последние транзакции</h2>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {isInitialLoading ? (
                <TransactionsListSkeleton />
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
    </div>
  );
}
