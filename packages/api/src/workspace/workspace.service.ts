import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma, User, Workspace } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { EmailService } from "@/email/email.service";
import { PrismaService } from "@/prisma/prisma.service";

import { WORKSPACE_ROLES } from "./workspace.constants";
import type { CreateInviteDto, CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceMemberDto } from "./workspace.dto";

const INVITE_TOKEN_BYTES = 32;
const STANDARD_EXPENSE_CATEGORIES = [
  "Продукты",
  "Питание",
  "Подарки",
  "Машина",
  "Одежда",
  "Общ. транспорт",
  "Развлечения",
  "Кредит",
  "Дом",
  "Спорт",
  "Здоровье",
  "Подписки",
  "Перевод",
];
const STANDARD_INCOME_CATEGORIES = ["Зарплата"];

const WORKSPACE_SUMMARY_INCLUDE = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  _count: {
    select: {
      members: true,
    },
  },
} satisfies Prisma.WorkspaceInclude;

const WORKSPACE_DETAIL_INCLUDE = {
  ...WORKSPACE_SUMMARY_INCLUDE,
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  },
} satisfies Prisma.WorkspaceInclude;

type WorkspaceWithSummary = Workspace & {
  owner: Pick<User, "id" | "name" | "email" | "image">;
  _count: {
    members: number;
  };
};

type WorkspaceWithDetail = WorkspaceWithSummary & {
  members: Array<{
    role: string;
    user: Pick<User, "id" | "name" | "email" | "image">;
  }>;
};

function getInviteExpiryDate(expiresInDays: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  return expiresAt;
}

function toWorkspaceSummary(workspace: WorkspaceWithSummary) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    baseCurrency: workspace.baseCurrency,
    ownerId: workspace.ownerId,
    membersCount: workspace._count.members,
    owner: workspace.owner,
  };
}

function toWorkspaceMember(member: WorkspaceWithDetail["members"][number]): WorkspaceMemberDto {
  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    image: member.user.image,
    role: member.role,
  };
}

function toWorkspaceDetail(workspace: WorkspaceWithDetail) {
  const membersById = new Map<string, WorkspaceMemberDto>();
  membersById.set(workspace.owner.id, {
    id: workspace.owner.id,
    name: workspace.owner.name,
    email: workspace.owner.email,
    image: workspace.owner.image,
    role: WORKSPACE_ROLES.OWNER,
  });

  for (const member of workspace.members) {
    membersById.set(member.user.id, toWorkspaceMember(member));
  }

  return {
    ...toWorkspaceSummary(workspace),
    members: Array.from(membersById.values()),
  };
}

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  async createWorkspace(currentUser: AuthenticatedUser, input: CreateWorkspaceDto) {
    const existing = await this.prisma.workspace.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Рабочий стол с таким идентификатором уже существует");
    }

    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name: input.name,
          slug: input.slug,
          baseCurrency: "BYN",
          ownerId: currentUser.id,
          members: {
            create: {
              userId: currentUser.id,
              role: WORKSPACE_ROLES.OWNER,
            },
          },
        },
        include: WORKSPACE_DETAIL_INCLUDE,
      });

      await tx.category.createMany({
        data: [
          ...STANDARD_EXPENSE_CATEGORIES.map((name) => ({
            workspaceId: created.id,
            name,
            type: "expense",
          })),
          ...STANDARD_INCOME_CATEGORIES.map((name) => ({
            workspaceId: created.id,
            name,
            type: "income",
          })),
        ],
      });

      return created;
    });

    return { workspace: toWorkspaceDetail(workspace) };
  }

  async listWorkspaces(currentUser: AuthenticatedUser) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          {
            ownerId: currentUser.id,
          },
          {
            members: {
              some: {
                userId: currentUser.id,
              },
            },
          },
        ],
      },
      include: WORKSPACE_SUMMARY_INCLUDE,
      orderBy: {
        createdAt: "desc",
      },
    });

    return { workspaces: workspaces.map(toWorkspaceSummary) };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: WORKSPACE_DETAIL_INCLUDE,
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    return { workspace: toWorkspaceDetail(workspace) };
  }

  async getWorkspaceSummary(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: WORKSPACE_SUMMARY_INCLUDE,
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    return { workspace: toWorkspaceSummary(workspace) };
  }

  async getWorkspaceMembers(workspaceId: string) {
    const { workspace } = await this.getWorkspace(workspaceId);
    return { members: workspace.members };
  }

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceDto) {
    const existing = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (input.slug) {
      const duplicate = await this.prisma.workspace.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== workspaceId) {
        throw new ConflictException("Рабочий стол с таким идентификатором уже существует");
      }
    }

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: input,
      include: WORKSPACE_DETAIL_INCLUDE,
    });

    return { workspace: toWorkspaceDetail(workspace) };
  }

  async deleteWorkspace(workspaceId: string) {
    await this.prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return { success: true };
  }

  async leaveWorkspace(workspaceId: string, currentUser: AuthenticatedUser) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (workspace.ownerId === currentUser.id) {
      throw new BadRequestException("Создатель рабочего стола не может покинуть его");
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException("Вы не являетесь участником этого рабочего стола");
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
    });

    return { success: true };
  }

  async createInvite(workspaceId: string, input: CreateInviteDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const user = await this.prisma.user.findFirst({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException("Пользователь с таким email не зарегистрирован");
    }

    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (existingMember) {
      throw new ConflictException("Пользователь уже является участником этого рабочего стола");
    }

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email: input.email,
        token: randomBytes(INVITE_TOKEN_BYTES).toString("hex"),
        expiresAt: getInviteExpiryDate(input.expiresInDays),
      },
    });

    const emailResult = await this.emailService.sendInviteEmail(invite.email, invite.token, workspace.name);

    if ("error" in emailResult) {
      await this.prisma.workspaceInvite.delete({
        where: { id: invite.id },
      });
      throw new ServiceUnavailableException(`Не удалось отправить приглашение: ${emailResult.error}`);
    }

    return { invite };
  }

  async getInvite(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      throw new BadRequestException("Приглашение не найдено");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException("Приглашение истекло");
    }

    return {
      invite: {
        email: invite.email,
        workspaceName: invite.workspace.name,
        workspaceId: invite.workspace.id,
        expiresAt: invite.expiresAt,
      },
    };
  }

  async acceptInvite(token: string, currentUser: AuthenticatedUser) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      throw new BadRequestException("Неверный токен приглашения");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException("Приглашение истекло");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true, emailVerified: true },
    });

    if (!user?.email) {
      throw new BadRequestException("Добавьте email в настройках аккаунта, чтобы принять приглашение по email");
    }

    if (!user.emailVerified) {
      throw new ForbiddenException("Подтвердите email, чтобы принять приглашение");
    }

    if (invite.email !== user.email) {
      throw new ForbiddenException("Email приглашения не совпадает с вашим аккаунтом");
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: currentUser.id,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException("Вы уже являетесь участником этого рабочего стола");
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: currentUser.id,
        role: "member",
      },
    });

    await this.prisma.workspaceInvite.delete({
      where: { id: invite.id },
    });

    return { success: true, workspaceId: invite.workspaceId };
  }
}
