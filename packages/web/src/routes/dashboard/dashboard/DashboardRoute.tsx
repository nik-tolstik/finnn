import { lazy, Suspense } from "react";

import { useWorkspaceRoute } from "@/modules/workspace/useWorkspaceRoute";
import { useSession } from "@/shared/lib/api-session";

import { DashboardRouteSkeleton } from "./components/DashboardRouteSkeleton";

const dashboardContentModule = import("./components/DashboardContent");

const DashboardContent = lazy(() =>
  dashboardContentModule.then((module) => ({
    default: module.DashboardContent,
  }))
);
const CreateWorkspacePrompt = lazy(() =>
  import("@/modules/workspace/components/create-workspace-prompt").then((module) => ({
    default: module.CreateWorkspacePrompt,
  }))
);

export default function DashboardRoute() {
  const { data: session } = useSession();
  const { workspaceId, isInitialLoading, shouldShowCreateWorkspacePrompt } = useWorkspaceRoute();

  if (shouldShowCreateWorkspacePrompt) {
    return (
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <CreateWorkspacePrompt />
      </Suspense>
    );
  }

  if (isInitialLoading || !workspaceId) {
    return <DashboardRouteSkeleton />;
  }

  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <DashboardContent initialCurrentUserId={session?.user.id} workspaceId={workspaceId} />
    </Suspense>
  );
}
