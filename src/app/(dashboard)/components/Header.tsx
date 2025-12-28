"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import { UserMenu } from "./UserMenu";
import { WorkspaceDropdown } from "./WorkspaceDropdown";

export function Header() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <WorkspaceDropdown currentWorkspaceId={workspaceId} />
        </div>
        <div className="flex items-center gap-4">
          {session?.user && (
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          )}
        </div>
      </div>
    </header>
  );
}

