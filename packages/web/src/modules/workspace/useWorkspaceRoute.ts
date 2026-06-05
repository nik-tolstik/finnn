"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { workspacesKeys } from "@/shared/lib/query-keys";

import { getWorkspaces } from "./workspace.api";
import { buildWorkspaceSearchString, resolveWorkspaceIdFromList } from "./workspace-search-params";

export function useWorkspaceRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedWorkspaceId = searchParams.get("workspaceId");

  const workspacesQuery = useQuery({
    queryKey: workspacesKeys.list(),
    queryFn: () => getWorkspaces(),
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

    router.replace(`${pathname}?${buildWorkspaceSearchString(searchParams, workspaceId)}`, { scroll: false });
  }, [pathname, requestedWorkspaceId, router, searchParams, workspaceId]);

  return {
    workspaceId,
    isInitialLoading: workspacesQuery.isLoading && workspaces.length === 0,
    shouldShowCreateWorkspacePrompt:
      !workspacesQuery.isLoading && (Boolean(workspacesQuery.data?.error) || workspaces.length === 0),
  };
}
