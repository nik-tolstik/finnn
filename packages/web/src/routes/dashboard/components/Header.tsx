import { lazy, Suspense } from "react";

const MobileUserMenu = lazy(() => import("./MobileUserMenu").then((module) => ({ default: module.MobileUserMenu })));

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-20 flex h-16 items-center md:hidden">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center justify-end gap-4 flex-1">
          <Suspense
            fallback={<div aria-hidden="true" className="size-8 rounded-full bg-muted animate-pulse md:hidden" />}
          >
            <MobileUserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
