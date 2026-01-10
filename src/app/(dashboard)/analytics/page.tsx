import { redirect } from "next/navigation";

import { getWorkspaces } from "@/modules/workspace/workspace.service";

import { AnalyticsContent } from "./components/AnalyticsContent";

interface AnalyticsPageProps {
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const workspacesResult = await getWorkspaces();

  if (workspacesResult.error || !workspacesResult.data || workspacesResult.data.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Аналитика</h1>
        <p className="text-muted-foreground">Создайте рабочий стол для просмотра аналитики</p>
      </div>
    );
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

  return <AnalyticsContent workspaceId={workspaceId} />;
}
