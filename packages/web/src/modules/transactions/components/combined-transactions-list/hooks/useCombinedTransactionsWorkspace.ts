import { useQuery } from "@tanstack/react-query";

import { getWorkspaceSummary } from "@/modules/workspace/workspace.service";
import { workspaceKeys } from "@/shared/lib/query-keys";

import { getWorkspaceIcon } from "../utils/workspace-icons";

interface UseCombinedTransactionsWorkspaceParams {
  workspaceId: string;
}

export function useCombinedTransactionsWorkspace({ workspaceId }: UseCombinedTransactionsWorkspaceParams) {
  const { data: workspaceData } = useQuery({
    queryKey: workspaceKeys.summary(workspaceId),
    queryFn: () => getWorkspaceSummary(workspaceId),
    staleTime: 5000,
  });

  const workspace = workspaceData && "data" in workspaceData ? workspaceData.data : undefined;

  return {
    workspaceName: workspace?.name ?? "",
    WorkspaceIcon: getWorkspaceIcon(workspace?.icon),
  };
}
