"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, X, Check, Plus, MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccounts } from "@/modules/accounts/account.service";
import { AccountsCards } from "@/modules/accounts/components/AccountsCards";
import { CreateAccountDialog } from "@/modules/accounts/components/CreateAccountDialog";
import { TransactionsFilters } from "@/modules/transactions/components/TransactionsFilters";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";
import { TransactionsListSkeleton } from "@/modules/transactions/components/TransactionsListSkeleton";
import {
  getTransactions,
  type TransactionFilters,
} from "@/modules/transactions/transaction.service";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

interface DashboardContentProps {
  accounts: Account[];
  workspaceId: string;
}

const TRANSACTIONS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300;

export function DashboardContent({
  accounts,
  workspaceId,
}: DashboardContentProps) {
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);
  const [localFilters, setLocalFilters] = useState<TransactionFilters>({});
  const [debouncedFilters, setDebouncedFilters] = useState<TransactionFilters>(
    {}
  );
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const createAccountDialog = useDialogState();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(localFilters);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [localFilters]);

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["accounts", workspaceId],
    queryFn: () => getAccounts(workspaceId),
    initialData: { data: accounts },
  });

  const { data: allTransactionsData, isLoading } = useQuery({
    queryKey: ["transactions", workspaceId, debouncedFilters],
    queryFn: () => getTransactions(workspaceId, debouncedFilters),
  });

  const displayAccounts = accountsData?.data || accounts;
  const allTransactions = allTransactionsData?.data || [];
  const displayedTransactions = allTransactions.slice(0, displayedCount);
  const hasMore = allTransactions.length > displayedCount;

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
                    onClick={() => createAccountDialog.openDialog(null)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Новый
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReorderMode(true)}
                    className="gap-2"
                  >
                    <GripVertical className="h-4 w-4" />
                    Изменить порядок
                  </Button>
                </div>
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="md:hidden"
                    >
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
              {isLoading ? (
                <TransactionsListSkeleton />
              ) : displayedTransactions.length > 0 ? (
                <TransactionsList
                  transactions={displayedTransactions}
                  showLoadMore={hasMore}
                  onLoadMore={() =>
                    setDisplayedCount((prev) => prev + TRANSACTIONS_PER_PAGE)
                  }
                  workspaceId={workspaceId}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет транзакций.
                </div>
              )}
            </div>
            <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
              <div className="lg:sticky lg:top-4 lg:bg-card lg:rounded-lg lg:p-4">
                <TransactionsFilters
                  workspaceId={workspaceId}
                  filters={localFilters}
                  onFiltersChange={(newFilters) => {
                    setLocalFilters(newFilters);
                    setDisplayedCount(TRANSACTIONS_PER_PAGE);
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
