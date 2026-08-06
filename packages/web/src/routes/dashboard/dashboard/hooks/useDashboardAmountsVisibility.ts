import { useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "finnn:dashboard-amounts-hidden:v1:";

function readAmountsHidden(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function useDashboardAmountsVisibility(workspaceId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${workspaceId}`;
  const [amountsHidden, setAmountsHidden] = useState(() => readAmountsHidden(storageKey));
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);

  useEffect(() => {
    if (loadedStorageKey === storageKey) {
      return;
    }

    setAmountsHidden(readAmountsHidden(storageKey));
    setLoadedStorageKey(storageKey);
  }, [loadedStorageKey, storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, String(amountsHidden));
    } catch {
      // The preference remains available for the current dashboard session.
    }
  }, [amountsHidden, loadedStorageKey, storageKey]);

  return { amountsHidden, setAmountsHidden };
}
