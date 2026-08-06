import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Eye, EyeOff, HandCoins, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getAccounts, updateAccountsOrder } from "@/modules/accounts/account.api";
import type { Account } from "@/modules/accounts/account.types";
import { getVisibleAccounts, resolveViewerUserId } from "@/modules/accounts/account-visibility";
import { AccountBalanceSummary } from "@/modules/accounts/components/account-balance-summary";
import { AccountsCards } from "@/modules/accounts/components/accounts-cards";
import {
  type AccountDisplaySort,
  getAccountDisplayModel,
  getCanonicalAccountOrder,
  mergeReorderedVisibleAccounts,
} from "@/modules/accounts/components/accounts-cards/account-display";
import { CreateAccountDialog } from "@/modules/accounts/components/create-account-dialog/CreateAccountDialog";
import { useAccountDisplayPreferences } from "@/modules/accounts/hooks/useAccountDisplayPreferences";
import { getDashboardBalanceDateRange, toDashboardBalanceSummary } from "@/modules/analytics/analytics.api";
import { CreateDebtDialog } from "@/modules/debts/components/create-debt-dialog";
import { CombinedTransactionsList } from "@/modules/transactions/components/combined-transactions-list";
import { TransactionsFilterButton } from "@/modules/transactions/components/transactions-filters/components/TransactionsFilterButton";
import { TransactionsFilterDrawer } from "@/modules/transactions/components/transactions-filters/components/TransactionsFilterDrawer";
import { useTransactionFilters } from "@/modules/transactions/components/transactions-filters/hooks/useTransactionFilters";
import { TransactionsListSkeleton } from "@/modules/transactions/components/transactions-list-skeleton";
import { getCombinedTransactions } from "@/modules/transactions/transaction.api";
import { PaymentTransactionType } from "@/modules/transactions/transaction.constants";
import type { CombinedTransaction } from "@/modules/transactions/transaction.types";
import { getWorkspaceMembers, getWorkspaceSummary } from "@/modules/workspace/workspace.api";
import { getAnalyticsOverview as getApiAnalyticsOverview } from "@/shared/api/generated/analytics/analytics";
import { getTodayExchangeRates } from "@/shared/api/generated/currency/currency";
import {
  CURRENCY_OPTIONS,
  Currency,
  type Currency as CurrencyCode,
  DEFAULT_CURRENCY,
} from "@/shared/constants/currency";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { useSession } from "@/shared/lib/api-session";
import { runOptimisticWorkspaceMutation, updateAccountsInCache } from "@/shared/lib/optimistic-workspace-updates";
import {
  accountKeys,
  analyticsKeys,
  categoryKeys,
  exchangeRateKeys,
  transactionKeys,
  workspaceKeys,
} from "@/shared/lib/query-keys";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useDashboardAmountsVisibility } from "../hooks/useDashboardAmountsVisibility";
import { AccountDisplayControls, type BalanceSortStatus } from "./AccountDisplayControls";
import { AccountsMenu } from "./AccountsMenu";

interface DashboardContentProps {
  initialCurrentUserId?: string;
  workspaceId: string;
}

type AccountWithOwner = Account & {
  owner: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  } | null;
};

type QuickTransactionDialogData = {
  defaultMode?: "transfer";
  defaultType?: PaymentTransactionType.INCOME | PaymentTransactionType.EXPENSE;
  lockType?: boolean;
};

const TRANSACTIONS_PER_PAGE = 20;

const loadCreateTransactionDialog = () =>
  import("@/modules/transactions/components/create-transaction-dialog/CreateTransactionDialog").then((module) => ({
    default: module.CreateTransactionDialog,
  }));
const CreateTransactionDialog = lazy(loadCreateTransactionDialog);

function isSuccessResponse(data: any): data is { data: CombinedTransaction[]; total: number } {
  return data && "data" in data && !("error" in data);
}

function isCurrency(value: string | null | undefined): value is CurrencyCode {
  return CURRENCY_OPTIONS.some((option) => option.value === value);
}

function hasActionError(data: unknown): data is { error: string } {
  return data !== null && typeof data === "object" && "error" in data;
}

export function DashboardContent({ initialCurrentUserId, workspaceId }: DashboardContentProps) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [displayedCount, setDisplayedCount] = useState(TRANSACTIONS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isReorderSaving, setIsReorderSaving] = useState(false);
  const [reorderDraft, setReorderDraft] = useState<AccountWithOwner[] | null>(null);
  const [isReorderDirty, setIsReorderDirty] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
  const [isFiltersDrawerMounted, setIsFiltersDrawerMounted] = useState(false);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const createAccountDialog = useDialogState();
  const createTransactionDialog = useDialogState<QuickTransactionDialogData | null>();
  const createDebtDialog = useDialogState<null>();
  const { amountsHidden: areAmountsHidden, setAmountsHidden: setAreAmountsHidden } =
    useDashboardAmountsVisibility(workspaceId);
  const { preferences, selectGrouping, selectSort } = useAccountDisplayPreferences(workspaceId);

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
  });

  const { data: membersData, isLoading: isMembersLoading } = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: isFiltersDrawerOpen,
  });

  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: async () => {
      const { getCategories } = await import("@/modules/categories/category.api");
      return getCategories(workspaceId);
    },
    enabled: isFiltersDrawerOpen,
  });

  const shouldSortByBalance = preferences.sort === "balance";
  const { data: workspaceData, isLoading: isWorkspaceLoading } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
    staleTime: 5000,
  });
  const workspace = workspaceData && "data" in workspaceData ? workspaceData.data : null;
  const baseCurrency = isCurrency(workspace?.baseCurrency) ? workspace.baseCurrency : DEFAULT_CURRENCY;

  const {
    data: exchangeRatesData,
    isError: isExchangeRatesError,
    isLoading: isExchangeRatesLoading,
  } = useQuery({
    queryKey: exchangeRateKeys.today(),
    queryFn: () => getTodayExchangeRates(),
    enabled: shouldSortByBalance && Boolean(workspace),
    staleTime: 60 * 60_000,
  });

  const viewerUserId = resolveViewerUserId(session?.user?.id, initialCurrentUserId);
  const availableAccounts = useMemo<AccountWithOwner[]>(
    () => (accountsData?.data || []) as AccountWithOwner[],
    [accountsData?.data]
  );
  const visibleAccounts = useMemo(
    () => getVisibleAccounts(availableAccounts, viewerUserId, showAllAccounts),
    [availableAccounts, showAllAccounts, viewerUserId]
  );
  const exchangeRates = useMemo(
    () => ({
      [Currency.BYN]: 1,
      ...(exchangeRatesData?.data ?? {}),
    }),
    [exchangeRatesData?.data]
  );
  const accountDisplayModel = useMemo(
    () =>
      getAccountDisplayModel({
        accounts: visibleAccounts,
        baseCurrency,
        direction: preferences.direction,
        exchangeRates,
        grouping: preferences.grouping,
        sort: preferences.sort,
        viewerUserId,
      }),
    [
      baseCurrency,
      exchangeRates,
      preferences.direction,
      preferences.grouping,
      preferences.sort,
      viewerUserId,
      visibleAccounts,
    ]
  );

  const [dashboardBalanceDateRange, setDashboardBalanceDateRange] = useState(() => getDashboardBalanceDateRange());
  const dashboardBalanceAccountIds = useMemo(
    () => visibleAccounts.map((account) => account.id).sort(),
    [visibleAccounts]
  );
  const dashboardBalanceFilters = useMemo(
    () => ({
      accountIds: dashboardBalanceAccountIds,
      dateFrom: dashboardBalanceDateRange.previousDay,
      dateTo: dashboardBalanceDateRange.today,
    }),
    [dashboardBalanceAccountIds, dashboardBalanceDateRange]
  );
  const {
    data: dashboardBalance,
    isError: isDashboardBalanceQueryError,
    isLoading: isDashboardBalanceQueryLoading,
  } = useQuery({
    queryKey: analyticsKeys.overview(workspaceId, dashboardBalanceFilters),
    queryFn: async () => {
      const response = await getApiAnalyticsOverview(workspaceId, dashboardBalanceFilters);
      return toDashboardBalanceSummary(response, dashboardBalanceDateRange);
    },
    enabled: !isLoadingAccounts && dashboardBalanceAccountIds.length > 0 && !hasActionError(accountsData),
    staleTime: 60_000,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextDateRange = getDashboardBalanceDateRange();
      setDashboardBalanceDateRange((currentDateRange) =>
        currentDateRange.today === nextDateRange.today ? currentDateRange : nextDateRange
      );
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const dashboardAccountChanges = useMemo(() => {
    const changesByAccountId = new Map(
      dashboardBalance?.accountChanges.map((change) => [change.accountId, change.dailyChangeAmount])
    );

    return visibleAccounts.map((account) => ({
      accountColor: account.color,
      accountIcon: account.icon,
      accountId: account.id,
      accountName: account.name,
      dailyChangeAmount: changesByAccountId.get(account.id) ?? "0",
    }));
  }, [dashboardBalance?.accountChanges, visibleAccounts]);

  const balanceSortStatus: BalanceSortStatus = useMemo(() => {
    if (!shouldSortByBalance) {
      return "idle";
    }

    if (hasActionError(workspaceData) || isExchangeRatesError) {
      return "error";
    }

    if (isWorkspaceLoading || !workspace || isExchangeRatesLoading) {
      return accountDisplayModel.ratesAvailable ? "ready" : "loading";
    }

    return accountDisplayModel.ratesAvailable ? "ready" : "error";
  }, [
    accountDisplayModel.ratesAvailable,
    isExchangeRatesError,
    isExchangeRatesLoading,
    isWorkspaceLoading,
    shouldSortByBalance,
    workspace,
    workspaceData,
  ]);

  const isAccountsLoading = isLoadingAccounts || (isFetchingAccounts && availableAccounts.length === 0);
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
  });

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    setIsReorderMode(false);
    setIsReorderSaving(false);
    setIsReorderDirty(false);
    setReorderDraft(null);
  }, [workspaceId]);

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

  const handleBalanceAccountClick = useCallback(
    (accountId: string) => {
      applyFilters({ ...appliedFilters, accountIds: [accountId] });
      window.requestAnimationFrame(() => {
        historySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [appliedFilters, applyFilters]
  );

  const handleSortChange = useCallback(
    (sort: AccountDisplaySort) => {
      selectSort(sort);

      if (sort !== "custom" || visibleAccounts.length === 0) {
        return;
      }

      setReorderDraft(getCanonicalAccountOrder(visibleAccounts));
      setIsReorderDirty(false);
      setIsReorderMode(true);
    },
    [selectSort, visibleAccounts]
  );

  const handleCancelReorder = useCallback(() => {
    if (isReorderSaving) {
      return;
    }

    setIsReorderDirty(false);
    setIsReorderMode(false);
    setReorderDraft(null);
  }, [isReorderSaving]);

  const handleSaveReorder = useCallback(async () => {
    if (!reorderDraft || isReorderSaving) {
      return;
    }

    if (!isReorderDirty) {
      handleCancelReorder();
      return;
    }

    const reorderedAccounts = mergeReorderedVisibleAccounts(availableAccounts, reorderDraft);
    const accountOrders = reorderedAccounts.map((account, order) => ({ id: account.id, order }));

    setIsReorderSaving(true);

    try {
      const result = await runOptimisticWorkspaceMutation({
        queryClient,
        workspaceId,
        domains: ["accounts"],
        apply: (context) => {
          updateAccountsInCache(context, accountOrders);
        },
        mutation: () => updateAccountsOrder(workspaceId, { accountOrders }),
      });

      if (hasActionError(result)) {
        toast.error(result.error);
        return;
      }

      setIsReorderDirty(false);
      setIsReorderMode(false);
      setReorderDraft(null);
    } catch {
      toast.error("Не удалось изменить порядок счетов");
    } finally {
      setIsReorderSaving(false);
    }
  }, [availableAccounts, handleCancelReorder, isReorderDirty, isReorderSaving, queryClient, reorderDraft, workspaceId]);

  const quickActions = useMemo(
    () => [
      {
        id: "expense",
        label: "Расход",
        icon: ArrowDownLeft,
        onClick: () =>
          createTransactionDialog.openDialog({
            defaultType: PaymentTransactionType.EXPENSE,
            lockType: true,
          }),
      },
      {
        id: "income",
        label: "Доход",
        icon: ArrowUpRight,
        onClick: () =>
          createTransactionDialog.openDialog({
            defaultType: PaymentTransactionType.INCOME,
            lockType: true,
          }),
      },
      {
        id: "transfer",
        label: "Перевод",
        icon: ArrowLeftRight,
        onClick: () =>
          createTransactionDialog.openDialog({
            defaultMode: "transfer",
            lockType: true,
          }),
      },
      {
        id: "debt",
        label: "Долг",
        icon: HandCoins,
        onClick: () => createDebtDialog.openDialog(null),
      },
    ],
    [createDebtDialog.openDialog, createTransactionDialog.openDialog]
  );

  const isDashboardBalanceLoading =
    isLoadingAccounts || (dashboardBalanceAccountIds.length > 0 && isDashboardBalanceQueryLoading);
  const isDashboardBalanceError =
    hasActionError(accountsData) || (dashboardBalanceAccountIds.length > 0 && isDashboardBalanceQueryError);

  return (
    <div className="w-full max-w-[1024px] mx-auto">
      <div className="space-y-8">
        <div>
          <AccountBalanceSummary
            accountChanges={dashboardAccountChanges}
            actions={quickActions}
            amountsHidden={areAmountsHidden}
            balance={dashboardBalance?.currentBalance ?? "0"}
            baseCurrency={dashboardBalance?.baseCurrency ?? baseCurrency}
            dailyChangeAmount={dashboardBalance?.dailyChangeAmount ?? "0"}
            dailyChangePercent={dashboardBalance?.percentageChange ?? null}
            hasAccounts={dashboardBalanceAccountIds.length > 0}
            isError={isDashboardBalanceError}
            isLoading={isDashboardBalanceLoading}
            onAccountClick={handleBalanceAccountClick}
            onBalanceClick={() => setAreAmountsHidden((current) => !current)}
          />

          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-xl font-semibold">{showAllAccounts ? "Все счета" : "Ваши счета"}</h2>
              <Badge variant="secondary" className="text-xs">
                {visibleAccounts.length}
              </Badge>
            </div>

            {isReorderMode ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Отменить изменение порядка"
                  onClick={handleCancelReorder}
                  disabled={isReorderSaving}
                  className="sm:w-auto sm:px-3"
                >
                  <X className="size-4" />
                  <span className="hidden sm:inline">Отменить</span>
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  aria-label="Сохранить порядок"
                  onClick={handleSaveReorder}
                  disabled={isReorderSaving}
                  className="sm:w-auto sm:px-3"
                >
                  <Check className="size-4" />
                  <span className="hidden sm:inline">Сохранить</span>
                </Button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <Tooltip
                  content={<p>{showAllAccounts ? "Показать только ваши счета" : "Показать все счета"}</p>}
                  disableHoverableContent
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    aria-label={showAllAccounts ? "Показать только ваши счета" : "Показать все счета"}
                    onClick={() => setShowAllAccounts((current) => !current)}
                    className="hidden md:inline-flex"
                  >
                    {showAllAccounts ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </Tooltip>
                <AccountDisplayControls
                  balanceSortStatus={balanceSortStatus}
                  preferences={preferences}
                  onCreateAccount={() => createAccountDialog.openDialog(null)}
                  onGroupingChange={selectGrouping}
                  onSortChange={handleSortChange}
                />
                <AccountsMenu
                  preferences={preferences}
                  showAllAccounts={showAllAccounts}
                  onCreateAccount={() => createAccountDialog.openDialog(null)}
                  onGroupingChange={selectGrouping}
                  onShowAllAccountsChange={setShowAllAccounts}
                  onSortChange={handleSortChange}
                />
              </div>
            )}
          </div>

          <AccountsCards
            groups={accountDisplayModel.groups}
            grouping={preferences.grouping}
            hideBalances={areAmountsHidden}
            isLoading={isAccountsLoading}
            isReorderSaving={isReorderSaving}
            reorderAccounts={reorderDraft}
            reorderMode={isReorderMode}
            workspaceId={workspaceId}
            onReorderAccountsChange={(accounts) => {
              setReorderDraft(accounts);
              setIsReorderDirty(true);
            }}
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

        <div ref={historySectionRef}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">История</h2>
            <TransactionsFilterButton
              appliedFiltersCount={appliedFiltersCount}
              disabled={isFiltersNavigationPending}
              onClick={() => {
                setIsFiltersDrawerMounted(true);
                setIsFiltersDrawerOpen(true);
              }}
            />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              {isInitialLoading ? (
                <TransactionsListSkeleton count={8} />
              ) : displayedTransactions && displayedTransactions.length > 0 ? (
                <CombinedTransactionsList
                  hideAmounts={areAmountsHidden}
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

      {isFiltersDrawerMounted ? (
        <TransactionsFilterDrawer
          open={isFiltersDrawerOpen}
          onOpenChange={setIsFiltersDrawerOpen}
          appliedFilters={appliedFilters}
          members={membersData?.data || []}
          categories={categoriesData?.data || []}
          accounts={availableAccounts}
          hideBalances={areAmountsHidden}
          isCategoriesLoading={isCategoriesLoading}
          isMembersLoading={isMembersLoading}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      ) : null}
      {createTransactionDialog.mounted ? (
        <Suspense fallback={null}>
          <CreateTransactionDialog
            workspaceId={workspaceId}
            open={createTransactionDialog.open}
            onOpenChange={createTransactionDialog.closeDialog}
            onCloseComplete={createTransactionDialog.unmountDialog}
            defaultMode={createTransactionDialog.data?.defaultMode}
            defaultType={createTransactionDialog.data?.defaultType}
            lockType={createTransactionDialog.data?.lockType}
          />
        </Suspense>
      ) : null}
      {createDebtDialog.mounted ? (
        <CreateDebtDialog
          workspaceId={workspaceId}
          open={createDebtDialog.open}
          onOpenChange={createDebtDialog.closeDialog}
          onCloseComplete={createDebtDialog.unmountDialog}
        />
      ) : null}
    </div>
  );
}
