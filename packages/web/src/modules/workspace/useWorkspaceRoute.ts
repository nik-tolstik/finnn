import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { workspacesKeys } from "@/shared/lib/query-keys";

import { getWorkspaces } from "./workspace.api";
import { buildWorkspaceSearchString, resolveWorkspaceIdFromList } from "./workspace-search-params";

export function useWorkspaceRoute() {
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspaceId");

  const workspacesQuery = useQuery({
    queryKey: workspacesKeys.list(),
    queryFn: () => getWorkspaces(),
    staleTime: 5000,
  });

  const workspaces = useMemo(() => workspacesQuery.data?.data ?? [], [workspacesQuery.data?.data]);
  const workspaceId = useMemo(
    () => resolveWorkspaceIdFromList(workspaces, requestedWorkspaceId),
    [workspaces, requestedWorkspaceId]
  );

  useEffect(() => {
    if (!workspaceId || requestedWorkspaceId === workspaceId) {
      return;
    }

    navigate(
      {
        pathname,
        search: `?${buildWorkspaceSearchString(searchParams, workspaceId)}`,
        hash,
      },
      { replace: true, preventScrollReset: true }
    );
  }, [hash, navigate, pathname, requestedWorkspaceId, searchParams, workspaceId]);

  return {
    workspaceId,
    isInitialLoading: workspacesQuery.isLoading && workspaces.length === 0,
    shouldShowCreateWorkspacePrompt:
      !workspacesQuery.isLoading && (Boolean(workspacesQuery.data?.error) || workspaces.length === 0),
  };
}
