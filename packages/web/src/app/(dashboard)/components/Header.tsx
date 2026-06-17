"use client";

import dynamic from "next/dynamic";

const BurgerMenu = dynamic(() => import("./BurgerMenu").then((mod) => mod.BurgerMenu), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="size-8 rounded-full bg-muted animate-pulse md:hidden" />,
});

export function Header() {
  return (
    <header className="bg-background py-2 sticky top-0 z-20 flex h-16 items-center md:hidden">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center justify-end gap-4 flex-1">
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
}
