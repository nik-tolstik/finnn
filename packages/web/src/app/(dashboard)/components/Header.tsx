"use client";

import { Grip } from "lucide-react";
import dynamic from "next/dynamic";

const BurgerMenu = dynamic(() => import("./BurgerMenu").then((mod) => mod.BurgerMenu), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="inline-flex items-center justify-center rounded-md md:hidden p-0 size-6">
      <Grip className="size-5" />
    </div>
  ),
});

export function Header() {
  return (
    <header className="border-b bg-background py-2 sticky top-0 z-20 flex h-16 items-center md:hidden">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center gap-4 flex-1">
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
}
