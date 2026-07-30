import { ChevronRight, LogOut } from "lucide-react";

import { AppearanceSettings } from "@/modules/auth/components/appearance-settings";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession, useSignOut } from "@/shared/lib/api-session";
import { cn } from "@/shared/utils/cn";

import { WorkspaceDropdown } from "./WorkspaceDropdown";

interface MobileUserMenuContentProps {
  onCategorySettingsOpen: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onUserSettingsOpen: () => void;
  workspaceId?: string;
}

export function MobileUserMenuContent({
  onCategorySettingsOpen,
  onMenuOpenChange,
  onUserSettingsOpen,
  workspaceId,
}: MobileUserMenuContentProps) {
  const { data: session } = useSession();
  const signOut = useSignOut();
  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;
  const displayName = session?.user?.name || session?.user?.email || telegramName || "User";
  const email = session?.user?.email;

  const handleLogout = async () => {
    onMenuOpenChange(false);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 mt-6">
        <button
          type="button"
          onClick={onUserSettingsOpen}
          className="flex w-full items-center gap-3 rounded-lg bg-card p-3 text-left text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <UserAvatar name={session?.user?.name || telegramName} email={email} image={session?.user?.image} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            {email && <div className="text-xs text-muted-foreground truncate">{email}</div>}
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 mt-4">
        <WorkspaceDropdown
          currentWorkspaceId={workspaceId}
          onCategorySettingsOpen={() => {
            onMenuOpenChange(false);
            onCategorySettingsOpen();
          }}
          variant="list"
          onWorkspaceSelect={() => onMenuOpenChange(false)}
        />
      </div>

      <div className="px-4 mt-6">
        <AppearanceSettings title="Интерфейс" className="space-y-3" />
      </div>

      <div className="mt-auto border-t p-4 space-y-1">
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          )}
        >
          <LogOut className="h-5 w-5" />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}
