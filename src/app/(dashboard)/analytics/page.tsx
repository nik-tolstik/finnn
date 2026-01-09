import { redirect } from "next/navigation";

import { getWorkspace, getWorkspaces } from "@/modules/workspace/workspace.service";

import { AnalyticsContent } from "./components/AnalyticsContent";

interface AnalyticsPageProps {
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const workspacesResult = await getWorkspaces();

  if (workspacesResult.error || !workspacesResult.data || workspacesResult.data.length === 0) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const requestedWorkspaceId = resolvedSearchParams.workspaceId;
  const workspaceId =
    requestedWorkspaceId && workspacesResult.data.some((w) => w.id === requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspacesResult.data[0].id;

  if (!requestedWorkspaceId || !workspacesResult.data.some((w) => w.id === requestedWorkspaceId)) {
    redirect(`/analytics?workspaceId=${workspaceId}`);
  }

  const workspaceResult = await getWorkspace(workspaceId);
  const baseCurrency =
    workspaceResult && "data" in workspaceResult && workspaceResult.data
      ? workspaceResult.data.baseCurrency || "BYN"
      : "BYN";

  return <AnalyticsContent workspaceId={workspaceId} baseCurrency={baseCurrency} />;
}
