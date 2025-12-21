"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createDebtSchema,
  updateDebtSchema,
  type CreateDebtInput,
  type UpdateDebtInput,
} from "@/shared/lib/validations/debt";
import { revalidatePath } from "next/cache";

export async function createDebt(workspaceId: string, input: CreateDebtInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Access denied" };
    }

    const validated = createDebtSchema.parse(input);

    const debt = await prisma.debt.create({
      data: {
        ...validated,
        workspaceId,
      },
    });

    revalidatePath("/debts");
    return { data: debt };
  } catch (error: any) {
    return { error: error.message || "Failed to create debt" };
  }
}

export async function updateDebt(id: string, input: UpdateDebtInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!debt) {
      return { error: "Debt not found or access denied" };
    }

    const validated = updateDebtSchema.parse(input);

    const updated = await prisma.debt.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/debts");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Failed to update debt" };
  }
}

export async function deleteDebt(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const debt = await prisma.debt.findFirst({
      where: {
        id,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!debt) {
      return { error: "Debt not found or access denied" };
    }

    await prisma.debt.delete({
      where: { id },
    });

    revalidatePath("/debts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete debt" };
  }
}

export async function getDebts(workspaceId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Access denied" };
    }

    const debts = await prisma.debt.findMany({
      where: { workspaceId },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: debts };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch debts" };
  }
}

