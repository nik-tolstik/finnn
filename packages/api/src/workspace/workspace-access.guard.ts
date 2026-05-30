import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import { WORKSPACE_ROLES, type WorkspaceRole } from "./workspace.constants";
import { WORKSPACE_PARAM_METADATA, WORKSPACE_ROLES_METADATA } from "./workspace-access.decorator";

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WORKSPACE_ROLES.MEMBER]: 1,
  [WORKSPACE_ROLES.ADMIN]: 2,
  [WORKSPACE_ROLES.OWNER]: 3,
};

type WorkspaceAccessRequest = AuthenticatedRequest & {
  params: Record<string, string | undefined>;
  workspaceAccess?: {
    workspaceId: string;
    role: WorkspaceRole;
  };
};

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceAccessRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }

    const paramName = this.reflector.get<string>(WORKSPACE_PARAM_METADATA, context.getHandler()) ?? "workspaceId";
    const workspaceId = request.params[paramName];

    if (!workspaceId) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const effectiveRole =
      workspace.ownerId === user.id
        ? WORKSPACE_ROLES.OWNER
        : (((
            await this.prisma.workspaceMember.findUnique({
              where: {
                workspaceId_userId: {
                  workspaceId,
                  userId: user.id,
                },
              },
              select: { role: true },
            })
          )?.role as WorkspaceRole | undefined) ?? null);

    if (!effectiveRole) {
      throw new ForbiddenException("Доступ запрещён");
    }

    const requiredRoles = this.reflector.get<WorkspaceRole[]>(WORKSPACE_ROLES_METADATA, context.getHandler()) ?? [];
    if (requiredRoles.length > 0) {
      const requiredRank = Math.min(...requiredRoles.map((role) => WORKSPACE_ROLE_RANK[role]));
      if (WORKSPACE_ROLE_RANK[effectiveRole] < requiredRank) {
        throw new ForbiddenException("Доступ запрещён");
      }
    }

    request.workspaceAccess = { workspaceId, role: effectiveRole };
    return true;
  }
}
