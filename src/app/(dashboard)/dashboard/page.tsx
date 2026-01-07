import { redirect } from "next/navigation";

import { getAccounts } from "@/modules/accounts/account.service";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/CreateWorkspacePrompt";
import { getWorkspaces } from "@/modules/workspace/workspace.service";

import { DashboardContent } from "./components/DashboardContent";

interface DashboardPageProps {
  searchParams: Promise<{ workspaceId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
    redirect(`/dashboard?workspaceId=${workspaceId}`);
  }

  const accountsResult = await getAccounts(workspaceId);

  return <DashboardContent accounts={accountsResult.data || []} workspaceId={workspaceId} />;
}
