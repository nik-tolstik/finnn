"use server";

import { randomBytes } from "node:crypto";
import { Currency } from "@prisma/client";

import { CategoryType } from "@/modules/categories/category.constants";
import { prisma } from "@/shared/lib/prisma";
import { revalidateWorkspaceRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import { type CreateInviteInput, createInviteSchema } from "@/shared/lib/validations/invite";
import {
  type CreateWorkspaceInput,
  createWorkspaceSchema,
  type UpdateWorkspaceInput,
  updateWorkspaceSchema,
} from "@/shared/lib/validations/workspace";

import { WORKSPACE_ROLES } from "./workspace.constants";
import type { WorkspaceSummary } from "./workspace.types";

const STANDARD_CATEGORIES = [
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

const INCOME_CATEGORIES = ["Зарплата"];

const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#78716c",
  "#6b7280",
  "#ffffff",
];

export async function createWorkspace(input: CreateWorkspaceInput) {
  try {
    const userId = await requireUserId();

    const validated = createWorkspaceSchema.parse(input);

    const existing = await prisma.workspace.findUnique({
      where: { slug: validated.slug },
    });

    if (existing) {
      return { error: "Рабочий стол с таким идентификатором уже существует" };
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        baseCurrency: Currency.BYN,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });

    let colorIndex = 0;

    for (const categoryName of STANDARD_CATEGORIES) {
      const color = categoryName === "Перевод" ? "#eab308" : CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length];
      await prisma.category.create({
        data: {
          workspaceId: workspace.id,
          name: categoryName,
          type: CategoryType.EXPENSE,
          color,
        },
      });
      colorIndex++;
    }

    for (const categoryName of INCOME_CATEGORIES) {
      await prisma.category.create({
        data: {
          workspaceId: workspace.id,
          name: categoryName,
          type: CategoryType.INCOME,
          color: CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length],
        },
      });
      colorIndex++;
    }

    revalidateWorkspaceRoutes();
    return { data: workspace };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать рабочий стол" };
  }
}

export async function updateWorkspace(id: string, input: UpdateWorkspaceInput) {
  try {
    await requireWorkspaceAccess(id, { roles: [WORKSPACE_ROLES.ADMIN] });

    const validated = updateWorkspaceSchema.parse(input);

    const updated = await prisma.workspace.update({
      where: { id },
      data: validated,
    });

    revalidateWorkspaceRoutes();
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить рабочий стол" };
  }
}

export async function deleteWorkspace(id: string) {
  try {
    await requireWorkspaceAccess(id, { roles: [WORKSPACE_ROLES.OWNER] });

    await prisma.workspace.delete({
      where: { id },
    });

    revalidateWorkspaceRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить рабочий стол" };
  }
}

export async function getWorkspaces() {
  try {
    const userId = await requireUserId();

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          {
            ownerId: userId,
          },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data: workspaces };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить рабочие столы" };
  }
}

export async function getWorkspaceSummary(id: string) {
  try {
    await requireWorkspaceAccess(id);

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        icon: true,
        baseCurrency: true,
        ownerId: true,
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    return { data: workspace satisfies WorkspaceSummary };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить рабочий стол" };
  }
}

export async function getWorkspace(id: string) {
  try {
    await requireWorkspaceAccess(id);

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
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
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    return { data: workspace };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить рабочий стол" };
  }
}

export async function getWorkspaceMembers(workspaceId: string) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
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
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    const allMembers = [
      {
        id: workspace.owner.id,
        name: workspace.owner.name,
        email: workspace.owner.email,
        image: workspace.owner.image,
      },
      ...workspace.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      })),
    ];

    const uniqueMembers = allMembers.filter(
      (member, index, self) => index === self.findIndex((m) => m.id === member.id)
    );

    return { data: uniqueMembers };
  } catch (error: any) {
    return {
      error: error.message || "Не удалось загрузить участников рабочего стола",
    };
  }
}

export async function createInvite(workspaceId: string, input: CreateInviteInput) {
  try {
    await requireWorkspaceAccess(workspaceId, { roles: [WORKSPACE_ROLES.ADMIN] });

    const validated = createInviteSchema.parse(input);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      return { error: "Пользователь с таким email не зарегистрирован" };
    }

    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (existingMember) {
      return { error: "Пользователь уже является участником этого рабочего стола" };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email: validated.email,
        token,
        expiresAt,
      },
    });

    revalidateWorkspaceRoutes();
    return { data: invite };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать приглашение" };
  }
}

export async function acceptInvite(token: string) {
  try {
    const userId = await requireUserId();

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      return { error: "Неверный токен приглашения" };
    }

    if (invite.expiresAt < new Date()) {
      return { error: "Приглашение истекло" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return { error: "Не авторизован" };
    }

    if (invite.email !== user.email) {
      return { error: "Email приглашения не совпадает с вашим аккаунтом" };
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId,
        },
      },
    });

    if (existingMember) {
      return { error: "Вы уже являетесь участником этого рабочего стола" };
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId,
        role: "member",
      },
    });

    await prisma.workspaceInvite.delete({
      where: { id: invite.id },
    });

    revalidateWorkspaceRoutes();
    return { success: true, workspaceId: invite.workspaceId };
  } catch (error: any) {
    return { error: error.message || "Не удалось принять приглашение" };
  }
}

export async function leaveWorkspace(workspaceId: string) {
  try {
    const userId = await requireUserId();

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден" };
    }

    if (workspace.ownerId === userId) {
      return { error: "Создатель рабочего стола не может покинуть его" };
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      return { error: "Вы не являетесь участником этого рабочего стола" };
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    revalidateWorkspaceRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось покинуть рабочий стол" };
  }
}

export async function getWorkspaceInvite(token: string) {
  try {
    const invite = await prisma.workspaceInvite.findUnique({
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
      return { error: "Приглашение не найдено" };
    }

    if (invite.expiresAt < new Date()) {
      return { error: "Приглашение истекло" };
    }

    return {
      data: {
        email: invite.email,
        workspaceName: invite.workspace.name,
        workspaceId: invite.workspace.id,
        expiresAt: invite.expiresAt,
      },
    };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить приглашение" };
  }
}
