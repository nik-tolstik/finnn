import type { Placement } from "@floating-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeftRight, Building, Check, Plus, Tags } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

import { ArchivedAccountsDialog } from "@/modules/accounts/components/archived-accounts-dialog";
import { SettingsDialog } from "@/modules/accounts/components/settings-dialog";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { workspacesKeys } from "@/shared/lib/query-keys";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Popover } from "@/shared/ui/popover";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

interface WorkspaceDropdownProps {
  currentWorkspaceId?: string;
  className?: string;
  collapsed?: boolean;
  onCategorySettingsOpen?: () => void;
  onWorkspaceSelect?: () => void;
  placement?: Placement;
  variant?: "dropdown" | "list";
}

export function WorkspaceDropdown({
  currentWorkspaceId,
  className,
  collapsed = false,
  onCategorySettingsOpen,
  onWorkspaceSelect,
  placement = "bottom-start",
  variant = "dropdown",
}: WorkspaceDropdownProps) {
  const navigate = useNavigate();
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
    navigate(`/dashboard?workspaceId=${workspaceId}`);
    setSwitchOpen(false);
    onWorkspaceSelect?.();
  };

  const handleCreateWorkspace = () => {
    setSwitchOpen(false);
    createDialog.openDialog(null);
  };

  const handleOpenCategorySettings = () => {
    if (currentWorkspaceId) {
      onCategorySettingsOpen?.();
    }
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
            className="flex w-full items-center gap-3 rounded-lg bg-card p-4 text-left text-card-foreground shadow-sm transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-default"
          >
            <Building className="size-4 text-muted-foreground" />
            <span className="block truncate text-sm font-semibold">{triggerLabel}</span>
          </button>

          {currentWorkspaceId ? (
            <div className="space-y-1">
              <Button
                type="button"
                variant="ghost"
                onClick={handleOpenCategorySettings}
                className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Tags className="size-4" />
                <span className="truncate">Категории</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSwitchOpen(true)}
                className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeftRight className="size-4" />
                <span className="truncate">Перейти</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => archivedAccountsDialog.openDialog(null)}
                className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Archive className="size-4" />
                <span className="truncate">Архив</span>
              </Button>
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

        <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
          <DialogWindow className="sm:w-100">
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
            className="flex w-full items-center gap-3 rounded-lg bg-card p-4 text-left text-card-foreground shadow-sm transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-default"
          >
            <Building className="size-4 text-muted-foreground" />
            <span className="block truncate text-sm font-semibold">{triggerLabel}</span>
          </button>

          {currentWorkspaceId ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleOpenCategorySettings}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Tags className="size-4" />
                <span className="truncate">Категории</span>
              </button>
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
            <Tooltip content="Категории" delayDuration={0} side="right">
              <button
                type="button"
                aria-label="Категории"
                onClick={handleOpenCategorySettings}
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Tags className="size-5" />
              </button>
            </Tooltip>
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
