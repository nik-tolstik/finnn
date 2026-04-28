"use client";

import * as React from "react";

const OverlayPortalRootContext = React.createContext<HTMLElement | null>(null);

function OverlayPortalRootProvider({ children, root }: { children: React.ReactNode; root: HTMLElement | null }) {
  return <OverlayPortalRootContext.Provider value={root}>{children}</OverlayPortalRootContext.Provider>;
}

function useOverlayPortalRoot() {
  return React.useContext(OverlayPortalRootContext);
}

export { OverlayPortalRootProvider, useOverlayPortalRoot };
