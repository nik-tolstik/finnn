import { create } from "zustand";

import type { WorkspaceWithOwner } from "@/modules/workspace/workspace.types";

interface WorkspaceState {
  currentWorkspace: WorkspaceWithOwner | null;
  workspaces: WorkspaceWithOwner[];
  setCurrentWorkspace: (workspace: WorkspaceWithOwner | null) => void;
  setWorkspaces: (workspaces: WorkspaceWithOwner[]) => void;
  addWorkspace: (workspace: WorkspaceWithOwner) => void;
  updateWorkspace: (id: string, workspace: Partial<WorkspaceWithOwner>) => void;
  removeWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspace: null,
  workspaces: [],
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  updateWorkspace: (id, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
      currentWorkspace:
        state.currentWorkspace?.id === id
          ? { ...state.currentWorkspace, ...updates }
          : state.currentWorkspace,
    })),
  removeWorkspace: (id) =>
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      currentWorkspace:
        state.currentWorkspace?.id === id ? null : state.currentWorkspace,
    })),
}));
