"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "@/shared/lib/validations/workspace";
import {
  createInviteSchema,
  type CreateInviteInput,
} from "@/shared/lib/validations/invite";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

export async function createWorkspace(input: CreateWorkspaceInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const validated = createWorkspaceSchema.parse(input);

    const existing = await prisma.workspace.findUnique({
      where: { slug: validated.slug },
    });

    if (existing) {
      return { error: "Workspace with this slug already exists" };
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
    return { error: error.message || "Failed to create workspace" };
  }
}

export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
      return { error: "Workspace not found or access denied" };
    }

    const validated = updateWorkspaceSchema.parse(input);

    const updated = await prisma.workspace.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/dashboard");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Failed to update workspace" };
  }
}

export async function deleteWorkspace(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        ownerId: session.user.id,
      },
    });

    if (!workspace) {
      return { error: "Workspace not found or access denied" };
    }

    await prisma.workspace.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete workspace" };
  }
}

export async function getWorkspaces() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
    return { error: error.message || "Failed to fetch workspaces" };
  }
}

export async function getWorkspace(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
      return { error: "Workspace not found" };
    }

    return { data: workspace };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch workspace" };
  }
}

export async function createInvite(workspaceId: string, input: CreateInviteInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
      return { error: "Workspace not found or access denied" };
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
    return { error: error.message || "Failed to create invite" };
  }
}

export async function acceptInvite(token: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      return { error: "Invalid invite token" };
    }

    if (invite.expiresAt < new Date()) {
      return { error: "Invite has expired" };
    }

    if (invite.email !== session.user.email) {
      return { error: "Invite email does not match your account" };
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
      return { error: "You are already a member of this workspace" };
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
    return { error: error.message || "Failed to accept invite" };
  }
}
