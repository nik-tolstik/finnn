"use client";

import { CreateWorkspacePrompt } from "@/modules/workspace/components/create-workspace-prompt";
import { useWorkspaceRoute } from "@/modules/workspace/useWorkspaceRoute";

import { DebtsContent } from "./components/DebtsContent";

export default function DebtsPage() {
  const { workspaceId, isInitialLoading, shouldShowCreateWorkspacePrompt } = useWorkspaceRoute();

  if (shouldShowCreateWorkspacePrompt) {
    return <CreateWorkspacePrompt />;
  }

  if (isInitialLoading || !workspaceId) {
    return null;
  }

  return <DebtsContent workspaceId={workspaceId} />;
}
