"use client";

import type { Account } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AccountsCards } from "@/modules/accounts/components/AccountsCards";
import { TransactionsList } from "@/modules/transactions/components/TransactionsList";
import { TransactionsFilters } from "@/modules/transactions/components/TransactionsFilters";
import {
  getTransactions,
  type TransactionFilters,
} from "@/modules/transactions/transaction.service";

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(localFilters);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [localFilters]);

  const { data: allTransactionsData } = useQuery({
    queryKey: ["transactions", workspaceId, debouncedFilters],
    queryFn: () => getTransactions(workspaceId, debouncedFilters),
  });

  const allTransactions = allTransactionsData?.data || [];
  const displayedTransactions = allTransactions.slice(0, displayedCount);
  const hasMore = allTransactions.length > displayedCount;

  return (
    <div className="w-full max-w-[1440px] mx-auto">
      <div className="space-y-8">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Счета</h2>
          <AccountsCards accounts={accounts} workspaceId={workspaceId} />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Последние транзакции</h2>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {displayedTransactions.length > 0 ? (
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
