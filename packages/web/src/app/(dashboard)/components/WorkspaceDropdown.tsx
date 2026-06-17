"use client";

import type { Placement } from "@floating-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, Building, Check, LogOut, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ArchivedAccountsDialog } from "@/modules/accounts/components/archived-accounts-dialog";
import { SettingsDialog } from "@/modules/accounts/components/settings-dialog";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/create-workspace-dialog";
import { getWorkspaces } from "@/modules/workspace/workspace.api";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { useSession } from "@/shared/lib/api-session-client";
import { workspacesKeys } from "@/shared/lib/query-keys";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogWindow } from "@/shared/ui/dialog";
import { Popover } from "@/shared/ui/popover";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

import { LeaveWorkspaceDialog } from "./LeaveWorkspaceDialog";

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
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const createDialog = useDialogState();
  const settingsDialog = useDialogState<{ workspaceId: string }>();
  const archivedAccountsDialog = useDialogState();
  const leaveDialog = useDialogState<{
    workspaceId: string;
    workspaceName: string;
  }>();
  const switchCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: workspacesData } = useQuery({
    queryKey: workspacesKeys.list(),
    queryFn: () => getWorkspaces(),
    staleTime: 5000,
  });

  const workspaces = workspacesData?.data || [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const triggerLabel = currentWorkspace?.name || "Выберите workspace";

  const isOwner = currentWorkspace?.owner.id === session?.user?.id;

  const handleWorkspaceSelect = (workspaceId: string) => {
    router.push(`/dashboard?workspaceId=${workspaceId}`);
    setOpen(false);
    setSwitchOpen(false);
    onWorkspaceSelect?.();
  };

  const handleCreateWorkspace = () => {
    setOpen(false);
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
      {leaveDialog.mounted && (
        <LeaveWorkspaceDialog
          workspaceId={leaveDialog.data.workspaceId}
          workspaceName={leaveDialog.data.workspaceName}
          open={leaveDialog.open}
          onOpenChange={leaveDialog.closeDialog}
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
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </div>

          <div className="space-y-1">
            {currentWorkspaceId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (currentWorkspaceId) {
                      settingsDialog.openDialog({
                        workspaceId: currentWorkspaceId,
                      });
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Settings className="size-4 text-muted-foreground" />
                  <span>Настройки</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSwitchOpen(true)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span>Перейти</span>
                </button>
                <button
                  type="button"
                  onClick={() => archivedAccountsDialog.openDialog(null)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Archive className="size-4 text-muted-foreground" />
                  <span>Архив</span>
                </button>
              </>
            )}
            {currentWorkspaceId && !isOwner && (
              <button
                type="button"
                onClick={() => {
                  if (currentWorkspaceId && currentWorkspace) {
                    leaveDialog.openDialog({
                      workspaceId: currentWorkspaceId,
                      workspaceName: currentWorkspace.name,
                    });
                  }
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                <span>Покинуть</span>
              </button>
            )}
          </div>
        </section>

        <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
          <DialogWindow mobilePosition="bottom" className="max-h-[82dvh] rounded-t-lg sm:w-100">
            <DialogHeader>
              <DialogTitle>Перейти в workspace</DialogTitle>
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
                      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      selected ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <span className="truncate">{workspace.name}</span>
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
              <div className="border-t pt-2">
                <button
                  type="button"
                  onClick={handleCreateWorkspace}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Plus className="size-4 text-muted-foreground" />
                  <span>Создать новый</span>
                </button>
              </div>
            </DialogContent>
          </DialogWindow>
        </Dialog>

        {dialogs}
      </>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
          if (!newOpen) {
            setSwitchOpen(false);
          }
        }}
        placement={placement}
        className="w-64 p-0"
        trigger={({ ref, ...triggerProps }) => (
          <Tooltip content={triggerLabel} disabled={!collapsed} side="right">
            <button
              ref={ref}
              type="button"
              aria-label={collapsed ? `Workspace: ${triggerLabel}` : undefined}
              className={cn(
                "cursor-pointer flex items-center gap-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent",
                collapsed ? "size-10 justify-center px-0 py-0" : "px-3 py-2",
                className
              )}
              {...triggerProps}
            >
              <Building className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="max-w-[200px] truncate">{triggerLabel}</span>}
            </button>
          </Tooltip>
        )}
      >
        <div className="p-2">
          <div className="mt-2 space-y-1">
            {currentWorkspaceId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (currentWorkspaceId) {
                      settingsDialog.openDialog({
                        workspaceId: currentWorkspaceId,
                      });
                    }
                  }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Настройки</span>
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
                      className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                      {...triggerProps}
                      onMouseEnter={handleSwitchMouseEnter}
                      onMouseLeave={handleSwitchMouseLeave}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span>Перейти</span>
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
                            className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                          >
                            <span className="truncate">{workspace.name}</span>
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={handleCreateWorkspace}
                        className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <span>Создать новый</span>
                      </button>
                    </div>
                  </div>
                </Popover>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (currentWorkspaceId) {
                      archivedAccountsDialog.openDialog(null);
                    }
                  }}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span>Архив</span>
                </button>
              </>
            )}
            {currentWorkspaceId && !isOwner && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (currentWorkspaceId && currentWorkspace) {
                    leaveDialog.openDialog({
                      workspaceId: currentWorkspaceId,
                      workspaceName: currentWorkspace.name,
                    });
                  }
                }}
                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2 text-destructive"
              >
                <LogOut className="h-4 w-4 text-destructive" />
                <span>Покинуть</span>
              </button>
            )}
          </div>
        </div>
      </Popover>
      {dialogs}
    </>
  );
}
