import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { getAccounts } from "@/modules/accounts/account.service";
import { getAnalyticsOverview } from "@/modules/analytics/analytics.service";
import { getCategories } from "@/modules/categories/category.service";
import { parseTransactionFilters } from "@/modules/transactions/components/transactions-filters";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaceMembers, getWorkspaces } from "@/modules/workspace/workspace.service";
import {
  buildWorkspaceRedirectQueryString,
  getFirstSearchParamValue,
  toURLSearchParams,
  type WorkspacePageSearchParams,
} from "@/modules/workspace/workspace-search-params";
import { accountKeys, analyticsKeys, categoryKeys, workspaceKeys } from "@/shared/lib/query-keys";

import { AnalyticsContent } from "./components/AnalyticsContent";

interface AnalyticsPageProps {
  searchParams: Promise<WorkspacePageSearchParams>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const workspacesResult = await getWorkspaces();

  if (workspacesResult.error || !workspacesResult.data || workspacesResult.data.length === 0) {
    return <CreateWorkspacePrompt />;
  }

  const resolvedSearchParams = await searchParams;
  const requestedWorkspaceId = getFirstSearchParamValue(resolvedSearchParams.workspaceId);
  const workspaceId =
    requestedWorkspaceId && workspacesResult.data.some((workspace) => workspace.id === requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspacesResult.data[0].id;

  if (!requestedWorkspaceId || !workspacesResult.data.some((workspace) => workspace.id === requestedWorkspaceId)) {
    redirect(`/analytics?${buildWorkspaceRedirectQueryString(resolvedSearchParams, workspaceId)}`);
  }

  const queryClient = new QueryClient();
  const appliedFilters = parseTransactionFilters(toURLSearchParams(resolvedSearchParams));

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: accountKeys.list(workspaceId),
      queryFn: () => getAccounts(workspaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: categoryKeys.list(workspaceId),
      queryFn: () => getCategories(workspaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.members(workspaceId),
      queryFn: () => getWorkspaceMembers(workspaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: analyticsKeys.overview(workspaceId, appliedFilters),
      queryFn: () => getAnalyticsOverview(workspaceId, appliedFilters),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalyticsContent workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
