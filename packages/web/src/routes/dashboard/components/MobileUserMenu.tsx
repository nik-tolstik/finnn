import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";

import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession } from "@/shared/lib/api-session";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

const MobileUserMenuContent = lazy(() =>
  import("./MobileUserMenuContent").then((module) => ({ default: module.MobileUserMenuContent }))
);
const UserSettingsDialog = lazy(() =>
  import("@/modules/auth/components/user-settings-dialog").then((module) => ({ default: module.UserSettingsDialog }))
);
const CategorySettingsDialog = lazy(() =>
  import("@/modules/accounts/components/category-settings-dialog").then((module) => ({
    default: module.CategorySettingsDialog,
  }))
);

function MenuContentFallback() {
  return (
    <div aria-hidden="true" className="space-y-4 px-4 pt-6">
      <div className="h-16 rounded-lg bg-muted animate-pulse" />
      <div className="h-32 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

export function MobileUserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [categorySettingsDialogOpen, setCategorySettingsDialogOpen] = useState(false);
  const [categorySettingsDialogMounted, setCategorySettingsDialogMounted] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDialogMounted, setSettingsDialogMounted] = useState(false);
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;
  const email = session?.user?.email;
  const openCategorySettingsDialog = () => {
    setCategorySettingsDialogMounted(true);
    setCategorySettingsDialogOpen(true);
  };
  const openUserSettingsDialog = () => {
    setSettingsDialogMounted(true);
    setSettingsDialogOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Открыть меню пользователя"
          aria-expanded={open}
          aria-haspopup="dialog"
          className="p-0 size-9 rounded-full"
          onClick={() => setOpen(true)}
        >
          <UserAvatar name={session?.user?.name || telegramName} email={email} image={session?.user?.image} size="lg" />
        </Button>
        <SheetContent side="right" showCloseButton={false} className="w-[calc(100vw-48px)] max-w-sm p-0">
          <SheetTitle className="sr-only">Меню пользователя</SheetTitle>
          {open ? (
            <Suspense fallback={<MenuContentFallback />}>
              <MobileUserMenuContent
                workspaceId={workspaceId}
                onMenuOpenChange={setOpen}
                onUserSettingsOpen={openUserSettingsDialog}
                onCategorySettingsOpen={openCategorySettingsDialog}
              />
            </Suspense>
          ) : null}
        </SheetContent>
      </Sheet>
      {settingsDialogMounted ? (
        <Suspense fallback={null}>
          <UserSettingsDialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen} />
        </Suspense>
      ) : null}
      {workspaceId &&
        (categorySettingsDialogMounted ? (
          <Suspense fallback={null}>
            <CategorySettingsDialog
              workspaceId={workspaceId}
              open={categorySettingsDialogOpen}
              onOpenChange={setCategorySettingsDialogOpen}
            />
          </Suspense>
        ) : null)}
    </>
  );
}
