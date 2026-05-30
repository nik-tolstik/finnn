import { redirect } from "next/navigation";

import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import {
  buildWorkspaceRedirectQueryString,
  getFirstSearchParamValue,
  type WorkspacePageSearchParams,
} from "@/modules/workspace/workspace-search-params";
import { getServerApiRequestOptions } from "@/shared/lib/api-session";

import { AnalyticsContent } from "./components/AnalyticsContent";

interface AnalyticsPageProps {
  searchParams: Promise<WorkspacePageSearchParams>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const requestOptions = await getServerApiRequestOptions();
  const workspacesResult = await getWorkspaces(requestOptions);

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

  return <AnalyticsContent workspaceId={workspaceId} />;
}
