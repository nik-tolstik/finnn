"use client";

import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { useWorkspaceRoute } from "@/modules/workspace/useWorkspaceRoute";

import { AnalyticsContent } from "./components/AnalyticsContent";

export default function AnalyticsPage() {
  const { workspaceId, isInitialLoading, shouldShowCreateWorkspacePrompt } = useWorkspaceRoute();

  if (shouldShowCreateWorkspacePrompt) {
    return <CreateWorkspacePrompt />;
  }

  if (isInitialLoading || !workspaceId) {
    return null;
  }

  return <AnalyticsContent workspaceId={workspaceId} />;
}
