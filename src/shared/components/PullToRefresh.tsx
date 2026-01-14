"use client";

import { useEffect } from "react";

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
};

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isStandalone()) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PullToRefreshLib = require("pulltorefreshjs") as {
      init: (options: {
        mainElement?: string;
        triggerElement?: string;
        onRefresh?: () => void;
      }) => void;
      destroyAll: () => void;
    };

    PullToRefreshLib.init({
      mainElement: "body",
      triggerElement: "body",
      onRefresh() {
        window.location.reload();
      },
    });

    return () => {
      PullToRefreshLib.destroyAll();
    };
  }, []);

  return <>{children}</>;
}
