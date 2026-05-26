import type { WorkspaceMemberDto, WorkspaceSummaryDto } from "@/shared/api/generated/model";
import {
  createWorkspace as createApiWorkspace,
  getWorkspaceMembers as getApiWorkspaceMembers,
  getWorkspaceSummary as getApiWorkspaceSummary,
  leaveWorkspace as leaveApiWorkspace,
  listWorkspaces as listApiWorkspaces,
  updateWorkspace as updateApiWorkspace,
} from "@/shared/api/generated/workspaces/workspaces";
import { fail, ok, success } from "@/shared/lib/action-result";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@/shared/lib/validations/workspace";

import type { WorkspaceSummary, WorkspaceWithOwner } from "./workspace.types";

function toWorkspaceWithOwner(workspace: WorkspaceSummaryDto): WorkspaceWithOwner {
  const now = new Date();

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    icon: workspace.icon ?? null,
    baseCurrency: workspace.baseCurrency,
    ownerId: workspace.ownerId,
    createdAt: now,
    updatedAt: now,
    owner: {
      id: workspace.owner.id,
      name: workspace.owner.name,
      email: workspace.owner.email,
      image: workspace.owner.image ?? null,
    },
    _count: {
      members: workspace.membersCount,
    },
  } as WorkspaceWithOwner;
}

function toWorkspaceSummary(workspace: WorkspaceSummaryDto): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    icon: workspace.icon ?? null,
    baseCurrency: workspace.baseCurrency,
    ownerId: workspace.ownerId,
  };
}

function toWorkspaceMember(member: WorkspaceMemberDto) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    image: member.image ?? null,
  };
}

export async function createWorkspace(input: CreateWorkspaceInput, options?: RequestInit) {
  try {
    const response = await createApiWorkspace(input, options);
    return ok(toWorkspaceWithOwner(response.workspace));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать рабочий стол");
  }
}

export async function updateWorkspace(id: string, input: UpdateWorkspaceInput, options?: RequestInit) {
  try {
    const response = await updateApiWorkspace(id, input, options);
    return ok(toWorkspaceSummary(response.workspace));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить рабочий стол");
  }
}

export async function getWorkspaces(options?: RequestInit) {
  try {
    const response = await listApiWorkspaces(options);
    return ok(response.workspaces.map(toWorkspaceWithOwner));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить рабочие столы");
  }
}

export async function getWorkspaceSummary(id: string, options?: RequestInit) {
  try {
    const response = await getApiWorkspaceSummary(id, options);
    return ok(toWorkspaceSummary(response.workspace));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить рабочий стол");
  }
}

export async function getWorkspaceMembers(workspaceId: string, options?: RequestInit) {
  try {
    const response = await getApiWorkspaceMembers(workspaceId, options);
    return ok(response.members.map(toWorkspaceMember));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить участников рабочего стола");
  }
}

export async function leaveWorkspace(workspaceId: string, options?: RequestInit) {
  try {
    await leaveApiWorkspace(workspaceId, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось покинуть рабочий стол");
  }
}
