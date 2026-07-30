import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { categoryKeys } from "@/shared/lib/query-keys";

const CATEGORY_STALE_TIME_MS = 5000;
const PRELOAD_TIMEOUT_MS = 2000;

export function useCategorySettingsPreload(workspaceId?: string) {
  const queryClient = useQueryClient();

  const preload = useCallback(() => {
    if (!workspaceId) {
      return;
    }

    void queryClient
      .prefetchQuery({
        queryKey: categoryKeys.list(workspaceId),
        queryFn: async () => {
          const { getCategories } = await import("@/modules/categories/category.api");
          return getCategories(workspaceId);
        },
        staleTime: CATEGORY_STALE_TIME_MS,
      })
      .catch(() => undefined);
  }, [queryClient, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(preload, { timeout: PRELOAD_TIMEOUT_MS });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = setTimeout(preload, PRELOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [preload, workspaceId]);

  return preload;
}
