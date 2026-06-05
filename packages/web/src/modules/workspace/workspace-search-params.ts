type SearchParamValue = string | string[] | undefined;

export type WorkspacePageSearchParams = Record<string, SearchParamValue>;

export function getFirstSearchParamValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function buildWorkspaceRedirectQueryString(searchParams: WorkspacePageSearchParams, workspaceId: string) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "workspaceId" || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          params.append(key, item);
        }
      });
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  params.set("workspaceId", workspaceId);

  return params.toString();
}

export function toURLSearchParams(searchParams: WorkspacePageSearchParams) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) {
          params.append(key, item);
        }
      });
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  return params;
}

export function resolveWorkspaceIdFromList<TWorkspace extends { id: string }>(
  workspaces: TWorkspace[],
  requestedWorkspaceId?: string | null
) {
  if (requestedWorkspaceId && workspaces.some((workspace) => workspace.id === requestedWorkspaceId)) {
    return requestedWorkspaceId;
  }

  return workspaces[0]?.id ?? null;
}

export function buildWorkspaceSearchString(searchParams: URLSearchParams, workspaceId: string) {
  const nextSearchParams = new URLSearchParams(searchParams.toString());
  nextSearchParams.set("workspaceId", workspaceId);
  return nextSearchParams.toString();
}
