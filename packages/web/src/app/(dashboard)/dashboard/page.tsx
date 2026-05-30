import { redirect } from "next/navigation";

import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import {
  buildWorkspaceRedirectQueryString,
  getFirstSearchParamValue,
  type WorkspacePageSearchParams,
} from "@/modules/workspace/workspace-search-params";
import { getCachedServerSession, getServerApiRequestOptions } from "@/shared/lib/api-session";

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

  return <DashboardContent initialCurrentUserId={currentUserId} workspaceId={workspaceId} />;
}
