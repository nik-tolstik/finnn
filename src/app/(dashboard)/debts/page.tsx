import { redirect } from "next/navigation";

import { CreateWorkspacePrompt } from "@/modules/workspace/components/CreateWorkspacePrompt";
import { getWorkspaces } from "@/modules/workspace/workspace.service";

import { DebtsContent } from "./components/DebtsContent";

interface DebtsPageProps {
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function DebtsPage({ searchParams }: DebtsPageProps) {
  const workspacesResult = await getWorkspaces();

  if (workspacesResult.error || !workspacesResult.data || workspacesResult.data.length === 0) {
    return <CreateWorkspacePrompt />;
  }

  const resolvedSearchParams = await searchParams;
  const requestedWorkspaceId = resolvedSearchParams.workspaceId;
  const workspaceId =
    requestedWorkspaceId && workspacesResult.data.some((w) => w.id === requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspacesResult.data[0].id;

  if (!requestedWorkspaceId || !workspacesResult.data.some((w) => w.id === requestedWorkspaceId)) {
    redirect(`/debts?workspaceId=${workspaceId}`);
  }

  return <DebtsContent workspaceId={workspaceId} />;
}
