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
