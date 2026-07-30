import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";

import {
  CategorySettingsDialog,
  useCategorySettingsPreload,
} from "@/modules/accounts/components/category-settings-dialog";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { useSession } from "@/shared/lib/api-session";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

import { MobileUserMenuContent } from "./MobileUserMenuContent";

const loadUserSettingsDialog = () =>
  import("@/modules/auth/components/user-settings-dialog").then((module) => ({ default: module.UserSettingsDialog }));
const UserSettingsDialog = lazy(loadUserSettingsDialog);

export function MobileUserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [categorySettingsDialogOpen, setCategorySettingsDialogOpen] = useState(false);
  const [categorySettingsDialogMounted, setCategorySettingsDialogMounted] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDialogMounted, setSettingsDialogMounted] = useState(false);
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || undefined;
  const preloadCategorySettings = useCategorySettingsPreload(workspaceId);

  const telegramName = session?.user?.telegram.username
    ? `@${session.user.telegram.username}`
    : session?.user?.telegram.displayName;
  const email = session?.user?.email;
  const openCategorySettingsDialog = () => {
    preloadCategorySettings();
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
          onFocus={preloadCategorySettings}
          onPointerDown={preloadCategorySettings}
          onPointerEnter={preloadCategorySettings}
          onClick={() => {
            void loadUserSettingsDialog().catch(() => undefined);
            preloadCategorySettings();
            setOpen(true);
          }}
        >
          <UserAvatar name={session?.user?.name || telegramName} email={email} image={session?.user?.image} size="lg" />
        </Button>
        <SheetContent side="right" showCloseButton={false} className="w-[calc(100vw-48px)] max-w-sm p-0">
          <SheetTitle className="sr-only">Меню пользователя</SheetTitle>
          {open ? (
            <MobileUserMenuContent
              workspaceId={workspaceId}
              onMenuOpenChange={setOpen}
              onUserSettingsOpen={openUserSettingsDialog}
              onCategorySettingsOpen={openCategorySettingsDialog}
            />
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
          <CategorySettingsDialog
            workspaceId={workspaceId}
            open={categorySettingsDialogOpen}
            onOpenChange={setCategorySettingsDialogOpen}
          />
        ) : null)}
    </>
  );
}
