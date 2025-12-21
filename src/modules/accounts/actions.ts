"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/shared/lib/validations/account";
import { revalidatePath } from "next/cache";

export async function createAccount(workspaceId: string, input: CreateAccountInput) {
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

    const validated = createAccountSchema.parse(input);

    const account = await prisma.account.create({
      data: {
        ...validated,
        workspaceId,
      },
    });

    revalidatePath("/accounts");
    return { data: account };
  } catch (error: any) {
    return { error: error.message || "Failed to create account" };
  }
}

export async function updateAccount(id: string, input: UpdateAccountInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const account = await prisma.account.findFirst({
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

    if (!account) {
      return { error: "Account not found or access denied" };
    }

    const validated = updateAccountSchema.parse(input);

    const updated = await prisma.account.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/accounts");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Failed to update account" };
  }
}

export async function deleteAccount(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const account = await prisma.account.findFirst({
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

    if (!account) {
      return { error: "Account not found or access denied" };
    }

    await prisma.account.delete({
      where: { id },
    });

    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete account" };
  }
}

export async function getAccounts(workspaceId: string) {
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

    const accounts = await prisma.account.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return { data: accounts };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch accounts" };
  }
}

export async function getAccount(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const account = await prisma.account.findFirst({
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

    if (!account) {
      return { error: "Account not found" };
    }

    return { data: account };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch account" };
  }
}

