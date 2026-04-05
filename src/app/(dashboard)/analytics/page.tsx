import { redirect } from "next/navigation";

import { getAccounts } from "@/modules/accounts/account.service";
import { getCategories } from "@/modules/categories/category.service";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaceMembers, getWorkspaces } from "@/modules/workspace/workspace.service";
import {
  buildWorkspaceRedirectQueryString,
  getFirstSearchParamValue,
  type WorkspacePageSearchParams,
} from "@/modules/workspace/workspace-search-params";

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

  const [accountsResult, categoriesResult, membersResult] = await Promise.all([
    getAccounts(workspaceId),
    getCategories(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  return (
    <AnalyticsContent
      workspaceId={workspaceId}
      initialAccounts={accountsResult.data || []}
      initialCategories={categoriesResult.data || []}
      initialMembers={membersResult.data || []}
    />
  );
}
