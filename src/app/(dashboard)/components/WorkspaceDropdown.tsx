"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Settings,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
  ArrowRight,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";

import { ArchivedAccountsDialog } from "@/modules/accounts/components/ArchivedAccountsDialog";
import { SettingsDialog } from "@/modules/accounts/components/SettingsDialog";
import { CreateWorkspaceDialog } from "@/modules/workspace/components/CreateWorkspaceDialog";
import { getWorkspaces } from "@/modules/workspace/workspace.service";
import { useDialogState } from "@/shared/hooks/useDialogState";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";

import { LeaveWorkspaceDialog } from "./LeaveWorkspaceDialog";

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  Building2,
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
} as const;

function getWorkspaceIcon(iconName?: string | null): LucideIcon {
  if (iconName && iconName in WORKSPACE_ICONS) {
    return WORKSPACE_ICONS[iconName];
  }
  return Building2;
}

interface WorkspaceDropdownProps {
  currentWorkspaceId?: string;
  className?: string;
}

export function WorkspaceDropdown({ currentWorkspaceId, className }: WorkspaceDropdownProps) {
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
    queryKey: ["workspaces"],
    queryFn: () => getWorkspaces(),
    staleTime: 5000,
    refetchInterval: 5000,
  });

  const workspaces = workspacesData?.data || [];
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const CurrentWorkspaceIcon = currentWorkspace ? getWorkspaceIcon(currentWorkspace.icon) : Building2;

  const isOwner = currentWorkspace?.owner.id === session?.user?.id;

  const handleWorkspaceSelect = (workspaceId: string) => {
    router.push(`/dashboard?workspaceId=${workspaceId}`);
    setOpen(false);
    setSwitchOpen(false);
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
      >
        <PopoverTrigger asChild>
          <div
            className={cn(
              "cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent",
              className
            )}
          >
            <CurrentWorkspaceIcon className="h-4 w-4" />
            <span className="max-w-[200px] truncate">{currentWorkspace?.name || "Выберите workspace"}</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2">
            <div className="mt-2 space-y-1">
              {currentWorkspaceId && (
                <>
                  <button
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
                  <Popover open={switchOpen} onOpenChange={setSwitchOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                        onMouseEnter={handleSwitchMouseEnter}
                        onMouseLeave={handleSwitchMouseLeave}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>Перейти</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-64 p-0"
                      side="right"
                      align="start"
                      sideOffset={8}
                      onMouseEnter={handleSwitchMouseEnter}
                      onMouseLeave={handleSwitchMouseLeave}
                    >
                      <div className="p-2">
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Workspaces</div>
                        <div className="space-y-1">
                          {workspaces
                            .filter((w) => w.id !== currentWorkspaceId)
                            .map((workspace) => {
                              const WorkspaceIcon = getWorkspaceIcon(workspace.icon);
                              return (
                                <button
                                  key={workspace.id}
                                  onClick={() => handleWorkspaceSelect(workspace.id)}
                                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                                >
                                  <WorkspaceIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate">{workspace.name}</span>
                                </button>
                              );
                            })}
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <button
                            onClick={handleCreateWorkspace}
                            className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4 text-muted-foreground" />
                            <span>Создать новый</span>
                          </button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
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
        </PopoverContent>
      </Popover>
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
}
