import { WORKSPACE_ROLES, type WorkspaceRole } from "@/modules/workspace/workspace.constants";

import { getCachedServerSession } from "./auth-session";
import { prisma } from "./prisma";

interface WorkspaceAccessOptions {
  roles?: WorkspaceRole[];
}

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WORKSPACE_ROLES.MEMBER]: 1,
  [WORKSPACE_ROLES.ADMIN]: 2,
  [WORKSPACE_ROLES.OWNER]: 3,
};

export async function requireUserId(): Promise<string> {
  const session = await getCachedServerSession();

  if (!session?.user?.id) {
    throw new Error("Не авторизован");
  }

  return session.user.id;
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  options: WorkspaceAccessOptions = {}
): Promise<{ userId: string }> {
  const userId = await requireUserId();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) {
    throw new Error("Рабочий стол не найден");
  }

  const effectiveRole: WorkspaceRole | null =
    workspace.ownerId === userId
      ? WORKSPACE_ROLES.OWNER
      : (((
          await prisma.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId,
                userId,
              },
            },
            select: {
              role: true,
            },
          })
        )?.role as WorkspaceRole | undefined) ?? null);

  if (!effectiveRole) {
    throw new Error("Доступ запрещён");
  }

  if (options.roles?.length) {
    const requiredRank = Math.min(...options.roles.map((role) => WORKSPACE_ROLE_RANK[role]));
    if (WORKSPACE_ROLE_RANK[effectiveRole] < requiredRank) {
      throw new Error("Доступ запрещён");
    }
  }

  return { userId };
}
