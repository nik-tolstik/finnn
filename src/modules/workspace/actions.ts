"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createInviteSchema,
  type CreateInviteInput,
} from "@/shared/lib/validations/invite";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "@/shared/lib/validations/workspace";

export async function createWorkspace(input: CreateWorkspaceInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

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
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "owner",
          },
        },
      },
    });

    revalidatePath("/dashboard");
    return { data: workspace };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать рабочий стол" };
  }
}

export async function updateWorkspace(id: string, input: UpdateWorkspaceInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: session.user.id,
            role: { in: ["owner", "admin"] },
          },
        },
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден или доступ запрещён" };
    }

    const validated = updateWorkspaceSchema.parse(input);

    const updated = await prisma.workspace.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/dashboard");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить рабочий стол" };
  }
}

export async function deleteWorkspace(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        ownerId: session.user.id,
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден или доступ запрещён" };
    }

    await prisma.workspace.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить рабочий стол" };
  }
}

export async function getWorkspaces() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
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

export async function getWorkspace(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
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

export async function createInvite(
  workspaceId: string,
  input: CreateInviteInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          some: {
            userId: session.user.id,
            role: { in: ["owner", "admin"] },
          },
        },
      },
    });

    if (!workspace) {
      return { error: "Рабочий стол не найден или доступ запрещён" };
    }

    const validated = createInviteSchema.parse(input);
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

    revalidatePath("/dashboard");
    return { data: invite };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать приглашение" };
  }
}

export async function acceptInvite(token: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

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

    if (invite.email !== session.user.email) {
      return { error: "Email приглашения не совпадает с вашим аккаунтом" };
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (existingMember) {
      return { error: "Вы уже являетесь участником этого рабочего стола" };
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
        role: "member",
      },
    });

    await prisma.workspaceInvite.delete({
      where: { id: invite.id },
    });

    revalidatePath("/dashboard");
    return { success: true, workspaceId: invite.workspaceId };
  } catch (error: any) {
    return { error: error.message || "Не удалось принять приглашение" };
  }
}
