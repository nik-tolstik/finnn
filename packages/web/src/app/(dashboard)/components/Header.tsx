"use client";

import { Building2, ChevronDown, Grip } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const BurgerMenu = dynamic(() => import("./BurgerMenu").then((mod) => mod.BurgerMenu), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="inline-flex items-center justify-center rounded-md md:hidden p-0 size-6">
      <Grip className="size-5" />
    </div>
  ),
});

const WorkspaceDropdown = dynamic(() => import("./WorkspaceDropdown").then((mod) => mod.WorkspaceDropdown), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="cursor-default flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground"
    >
      <Building2 className="h-4 w-4" />
      <span className="max-w-[200px] truncate">Workspace</span>
      <ChevronDown className="h-4 w-4" />
    </div>
  ),
});

export function Header() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  return (
    <header className="border-b bg-background py-2 sticky top-0 z-20 flex h-16 items-center md:hidden">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center gap-4 flex-1">
          <BurgerMenu />
          <WorkspaceDropdown currentWorkspaceId={workspaceId} className="ml-auto" />
        </div>
      </div>
    </header>
  );
}
