import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { useWorkspaceRoute } from "@/modules/workspace/useWorkspaceRoute";
import { useSession } from "@/shared/lib/api-session";

import { DashboardContent } from "./components/DashboardContent";

export default function DashboardRoute() {
  const { data: session } = useSession();
  const { workspaceId, isInitialLoading, shouldShowCreateWorkspacePrompt } = useWorkspaceRoute();

  if (shouldShowCreateWorkspacePrompt) {
    return <CreateWorkspacePrompt />;
  }

  if (isInitialLoading || !workspaceId) {
    return null;
  }

  return <DashboardContent initialCurrentUserId={session?.user.id} workspaceId={workspaceId} />;
}
