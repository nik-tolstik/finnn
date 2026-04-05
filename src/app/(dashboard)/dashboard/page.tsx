import { redirect } from "next/navigation";

import { getAccounts } from "@/modules/accounts/account.service";
import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { getWorkspaces } from "@/modules/workspace/workspace.service";
import { getCachedServerSession } from "@/shared/lib/auth-session";

import { DashboardContent } from "./components/DashboardContent";
import {
  buildWorkspaceRedirectQueryString,
  type DashboardPageSearchParams,
  getFirstSearchParamValue,
} from "./utils/workspace-search-params";

interface DashboardPageProps {
  searchParams: Promise<DashboardPageSearchParams>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [session, workspacesResult] = await Promise.all([getCachedServerSession(), getWorkspaces()]);

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

  const accountsResult = await getAccounts(workspaceId);
  const allAccounts = accountsResult.data || [];

  const currentUserId = session?.user?.id;
  const initialAccounts = currentUserId
    ? allAccounts.filter((account) => account.ownerId === currentUserId)
    : allAccounts;

  return (
    <DashboardContent
      accounts={initialAccounts}
      allAccounts={allAccounts}
      initialCurrentUserId={currentUserId}
      workspaceId={workspaceId}
    />
  );
}
