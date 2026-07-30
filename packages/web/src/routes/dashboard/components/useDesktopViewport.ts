import { useSyncExternalStore } from "react";

export const DESKTOP_VIEWPORT_QUERY = "(min-width: 768px)";

let desktopMediaQuery: MediaQueryList | null = null;

function getDesktopMediaQuery() {
  if (typeof window === "undefined") {
    return null;
  }

  desktopMediaQuery ??= window.matchMedia(DESKTOP_VIEWPORT_QUERY);
  return desktopMediaQuery;
}

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const mediaQuery = getDesktopMediaQuery();

  if (!mediaQuery) {
    return () => undefined;
  }

  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopViewportSnapshot() {
  return getDesktopMediaQuery()?.matches ?? false;
}

export function useDesktopViewport() {
  return useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => false);
}
