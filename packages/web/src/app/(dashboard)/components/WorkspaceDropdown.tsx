"use client";

import type { Placement } from "@floating-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeftRight, Building, Check, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ArchivedAccountsDialog } from "@/modules/accounts/components/archived-accounts-dialog";
import { SettingsDialog } from "@/modules/accounts/components/settings-dialog";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { workspacesKeys } from "@/shared/lib/query-keys";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Popover } from "@/shared/ui/popover";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

interface WorkspaceDropdownProps {
  currentWorkspaceId?: string;
  className?: string;
  collapsed?: boolean;
  onWorkspaceSelect?: () => void;
  placement?: Placement;
  variant?: "dropdown" | "list";
}

export function WorkspaceDropdown({
  currentWorkspaceId,
  className,
  collapsed = false,
  onWorkspaceSelect,
  placement = "bottom-start",
  variant = "dropdown",
}: WorkspaceDropdownProps) {
  const router = useRouter();
  const [switchOpen, setSwitchOpen] = useState(false);
  const createDialog = useDialogState();
  const settingsDialog = useDialogState<{ workspaceId: string }>();
  const archivedAccountsDialog = useDialogState();
  const switchCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: workspacesData } = useQuery({
    queryKey: workspacesKeys.list(),
    queryFn: () => getWorkspaces(),
    staleTime: 5000,
  });

  const workspaces = workspacesData?.data || [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const triggerLabel = currentWorkspace?.name || "Выберите workspace";

  const handleWorkspaceSelect = (workspaceId: string) => {
    router.push(`/dashboard?workspaceId=${workspaceId}`);
    setSwitchOpen(false);
    onWorkspaceSelect?.();
  };

  const handleCreateWorkspace = () => {
    setSwitchOpen(false);
    createDialog.openDialog(null);
  };

  const handleSwitchMouseEnter = () => {
    if (switchCloseTimeoutRef.current) {
      clearTimeout(switchCloseTimeoutRef.current);
      switchCloseTimeoutRef.current = null;
    }
    setSwitchOpen(true);
  };

  const handleSwitchMouseLeave = () => {
    switchCloseTimeoutRef.current = setTimeout(() => {
      setSwitchOpen(false);
    }, 150);
  };

  const dialogs = (
    <>
      {createDialog.mounted && (
        <CreateWorkspaceDialog open={createDialog.open} onOpenChange={createDialog.closeDialog} />
      )}
      {settingsDialog.mounted && currentWorkspaceId && (
        <SettingsDialog
          workspaceId={settingsDialog.data.workspaceId}
          open={settingsDialog.open}
          onOpenChange={settingsDialog.closeDialog}
        />
      )}
      {archivedAccountsDialog.mounted && currentWorkspaceId && (
        <ArchivedAccountsDialog
          workspaceId={currentWorkspaceId}
          open={archivedAccountsDialog.open}
          onOpenChange={archivedAccountsDialog.closeDialog}
          onCloseComplete={archivedAccountsDialog.unmountDialog}
        />
      )}
    </>
  );

  if (variant === "list") {
    return (
      <>
        <section className={cn("space-y-2", className)}>
          <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
            <button
              type="button"
              disabled={!currentWorkspaceId}
              onClick={() => {
                if (currentWorkspaceId) {
                  settingsDialog.openDialog({
                    workspaceId: currentWorkspaceId,
                  });
                }
              }}
              className="flex w-full items-start gap-3 rounded-md text-left transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-default"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-muted-foreground">
                <Building className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted-foreground">Workspace</div>
                <div className="truncate text-sm font-semibold">{triggerLabel}</div>
              </div>
              {currentWorkspaceId && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground">
                  <Settings className="size-4" />
                  <span className="sr-only">Открыть настройки workspace</span>
                </span>
              )}
            </button>

            {currentWorkspaceId && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSwitchOpen(true)}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeftRight className="size-4" />
                  <span className="truncate">Сменить</span>
                </button>
                <button
                  type="button"
                  onClick={() => archivedAccountsDialog.openDialog(null)}
                  className="flex min-w-0 items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Archive className="size-4" />
                  <span className="truncate">Архив</span>
                </button>
              </div>
            )}

            {!currentWorkspaceId && (
              <button
                type="button"
                onClick={handleCreateWorkspace}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="size-4 text-muted-foreground" />
                <span>Создать workspace</span>
              </button>
            )}
          </div>
        </section>

        <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
          <DialogWindow mobilePosition="bottom" className="max-h-[82dvh] rounded-t-lg sm:w-100">
            <DialogHeader>
              <DialogTitle>Выберите workspace</DialogTitle>
            </DialogHeader>
            <DialogContent className="space-y-2">
              {workspaces.map((workspace) => {
                const selected = workspace.id === currentWorkspaceId;

                return (
                  <button
                    type="button"
                    key={workspace.id}
                    disabled={selected}
                    onClick={() => handleWorkspaceSelect(workspace.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "border-primary/30 bg-accent text-accent-foreground"
                        : "bg-card hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Building className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
              <div className="border-t pt-2">
                <button
                  type="button"
                  onClick={handleCreateWorkspace}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="size-4 text-muted-foreground" />
                  <span>Создать workspace</span>
                </button>
              </div>
            </DialogContent>
          </DialogWindow>
        </Dialog>

        {dialogs}
      </>
    );
  }

  if (!collapsed) {
    return (
      <>
        <section className={cn("space-y-2", className)}>
          <button
            type="button"
            disabled={!currentWorkspaceId}
            onClick={() => {
              if (currentWorkspaceId) {
                settingsDialog.openDialog({
                  workspaceId: currentWorkspaceId,
                });
              }
            }}
            className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left text-card-foreground shadow-sm transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-default"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-muted-foreground">
              <Building className="size-4" />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted-foreground">Workspace</span>
              <span className="block truncate text-sm font-semibold">{triggerLabel}</span>
            </span>
            {currentWorkspaceId && <Settings className="mt-1 size-4 shrink-0 text-muted-foreground" />}
          </button>

          {currentWorkspaceId ? (
            <div className="space-y-1">
              <Popover
                open={switchOpen}
                onOpenChange={setSwitchOpen}
                placement="right-start"
                offset={8}
                className="w-64 p-0"
                onMouseEnter={handleSwitchMouseEnter}
                onMouseLeave={handleSwitchMouseLeave}
                trigger={({ ref, ...triggerProps }) => (
                  <button
                    ref={ref}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    {...triggerProps}
                    onMouseEnter={handleSwitchMouseEnter}
                    onMouseLeave={handleSwitchMouseLeave}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <ArrowLeftRight className="size-4" />
                    <span className="truncate">Сменить</span>
                  </button>
                )}
              >
                <div className="p-2">
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Workspaces</div>
                  <div className="space-y-1">
                    {workspaces
                      .filter((w) => w.id !== currentWorkspaceId)
                      .map((workspace) => (
                        <button
                          type="button"
                          key={workspace.id}
                          onClick={() => handleWorkspaceSelect(workspace.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <span className="truncate">{workspace.name}</span>
                        </button>
                      ))}
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <button
                      type="button"
                      onClick={handleCreateWorkspace}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <Plus className="size-4 text-muted-foreground" />
                      <span>Создать workspace</span>
                    </button>
                  </div>
                </div>
              </Popover>
              <button
                type="button"
                onClick={() => archivedAccountsDialog.openDialog(null)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Archive className="size-4" />
                <span className="truncate">Архив</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreateWorkspace}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="size-4 text-muted-foreground" />
              <span>Создать workspace</span>
            </button>
          )}
        </section>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <section className={cn("flex flex-col items-center gap-1", className)}>
        {currentWorkspaceId ? (
          <>
            <Tooltip content={triggerLabel} delayDuration={0} side="right">
              <button
                type="button"
                aria-label={`Workspace: ${triggerLabel}`}
                onClick={() => {
                  settingsDialog.openDialog({
                    workspaceId: currentWorkspaceId,
                  });
                }}
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Building className="size-5" />
              </button>
            </Tooltip>
            <Popover
              open={switchOpen}
              onOpenChange={setSwitchOpen}
              placement={placement}
              offset={8}
              className="w-64 p-0"
              trigger={({ ref, ...triggerProps }) => (
                <Tooltip content="Сменить workspace" delayDuration={0} side="right">
                  <button
                    ref={ref}
                    type="button"
                    aria-label="Сменить workspace"
                    className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    {...triggerProps}
                    onClick={(event) => {
                      triggerProps.onClick?.(event);
                    }}
                  >
                    <ArrowLeftRight className="size-5" />
                  </button>
                </Tooltip>
              )}
            >
              <div className="p-2">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Workspaces</div>
                <div className="space-y-1">
                  {workspaces
                    .filter((w) => w.id !== currentWorkspaceId)
                    .map((workspace) => (
                      <button
                        type="button"
                        key={workspace.id}
                        onClick={() => handleWorkspaceSelect(workspace.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="truncate">{workspace.name}</span>
                      </button>
                    ))}
                </div>
                <div className="mt-2 border-t pt-2">
                  <button
                    type="button"
                    onClick={handleCreateWorkspace}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <Plus className="size-4 text-muted-foreground" />
                    <span>Создать workspace</span>
                  </button>
                </div>
              </div>
            </Popover>
            <Tooltip content="Архив" delayDuration={0} side="right">
              <button
                type="button"
                aria-label="Архив"
                onClick={() => archivedAccountsDialog.openDialog(null)}
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Archive className="size-5" />
              </button>
            </Tooltip>
          </>
        ) : (
          <Tooltip content="Создать workspace" delayDuration={0} side="right">
            <button
              type="button"
              aria-label="Создать workspace"
              onClick={handleCreateWorkspace}
              className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-5" />
            </button>
          </Tooltip>
        )}
      </section>
      {dialogs}
    </>
  );
}
