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
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
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
    return { error: error.message || "Не удалось создать счёт" };
  }
}

export async function updateAccount(id: string, input: UpdateAccountInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
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
      return { error: "Счёт не найден или доступ запрещён" };
    }

    const validated = updateAccountSchema.parse(input);

    const updated = await prisma.account.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/accounts");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить счёт" };
  }
}

export async function archiveAccount(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
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
      return { error: "Счёт не найден или доступ запрещён" };
    }

    if (account.archived) {
      revalidatePath("/accounts");
      return { success: true };
    }

    await prisma.account.update({
      where: { id },
      data: { archived: true },
    });

    revalidatePath("/accounts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось архивировать счёт" };
  }
}

export async function getAccounts(workspaceId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!member) {
      return { error: "Доступ запрещён" };
    }

    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        archived: false,
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: accounts };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить счета" };
  }
}

export async function getAccount(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
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
      return { error: "Счёт не найден" };
    }

    return { data: account };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить счёт" };
  }
}

