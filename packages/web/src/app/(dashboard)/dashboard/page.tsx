import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { getAccounts } from "@/modules/accounts/account.api";
import { getCategories } from "@/modules/categories/category.api";
import {
  parseTransactionFilters,
  shouldIncludeDebtTransactions,
} from "@/modules/transactions/components/transactions-filters";
import { getCombinedTransactions } from "@/modules/transactions/transaction.service";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaceMembers, getWorkspaces } from "@/modules/workspace/workspace.api";
import {
  buildWorkspaceRedirectQueryString,
  getFirstSearchParamValue,
  toURLSearchParams,
  type WorkspacePageSearchParams,
} from "@/modules/workspace/workspace-search-params";
import { getCachedServerSession, getServerApiRequestOptions } from "@/shared/lib/api-session";
import { accountKeys, categoryKeys, transactionKeys, workspaceKeys } from "@/shared/lib/query-keys";

import { DashboardContent } from "./components/DashboardContent";

interface DashboardPageProps {
  searchParams: Promise<WorkspacePageSearchParams>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const requestOptions = await getServerApiRequestOptions();
  const [session, workspacesResult] = await Promise.all([getCachedServerSession(), getWorkspaces(requestOptions)]);

  if (workspacesResult.error || !workspacesResult.data || workspacesResult.data.length === 0) {
    return <CreateWorkspacePrompt />;
  }

  const resolvedSearchParams = await searchParams;
  const requestedWorkspaceId = getFirstSearchParamValue(resolvedSearchParams.workspaceId);
  const workspaceId =
    requestedWorkspaceId && workspacesResult.data.some((w) => w.id === requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspacesResult.data[0].id;

  if (!requestedWorkspaceId || !workspacesResult.data.some((w) => w.id === requestedWorkspaceId)) {
    redirect(`/dashboard?${buildWorkspaceRedirectQueryString(resolvedSearchParams, workspaceId)}`);
  }

  const currentUserId = session?.user?.id;
  const queryClient = new QueryClient();
  const appliedFilters = parseTransactionFilters(toURLSearchParams(resolvedSearchParams));
  const initialTransactionFilters = {
    ...appliedFilters,
    skip: 0,
    take: 20,
    includeDebtTransactions: shouldIncludeDebtTransactions(appliedFilters.transactionTypes),
  };

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: accountKeys.list(workspaceId),
      queryFn: () => getAccounts(workspaceId, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.members(workspaceId),
      queryFn: () => getWorkspaceMembers(workspaceId, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: categoryKeys.list(workspaceId),
      queryFn: () => getCategories(workspaceId, undefined, requestOptions),
    }),
    queryClient.prefetchQuery({
      queryKey: transactionKeys.list(workspaceId, initialTransactionFilters),
      queryFn: () => getCombinedTransactions(workspaceId, initialTransactionFilters),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardContent initialCurrentUserId={currentUserId} workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
