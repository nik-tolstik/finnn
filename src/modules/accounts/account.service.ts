"use server";

import { prisma } from "@/shared/lib/prisma";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  createAccountSchema,
  updateAccountSchema,
  updateAccountsOrderSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
  type UpdateAccountsOrderInput,
} from "@/shared/lib/validations/account";

export async function createAccount(workspaceId: string, input: CreateAccountInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createAccountSchema.parse(input);

    const accountsCount = await prisma.account.count({
      where: { workspaceId, archived: false },
    });

    const account = await prisma.account.create({
      data: {
        name: validated.name,
        balance: validated.balance,
        currency: validated.currency,
        color: validated.color,
        icon: validated.icon,
        ownerId: validated.ownerId ?? null,
        workspaceId,
        order: accountsCount,
        createdAt: validated.createdAt || new Date(),
      },
    });

    revalidateAccountingRoutes();
    return { data: account };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать счёт" };
  }
}

export async function updateAccount(id: string, input: UpdateAccountInput) {
  try {
    await requireUserId();

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.archived) {
      return { error: "Счёт не найден" };
    }

    await requireWorkspaceAccess(account.workspaceId);

    const validated = updateAccountSchema.parse(input);

    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.balance !== undefined) updateData.balance = validated.balance;
    if (validated.currency !== undefined) updateData.currency = validated.currency;
    if (validated.ownerId !== undefined) updateData.ownerId = validated.ownerId ?? null;
    if (validated.color !== undefined) updateData.color = validated.color;
    if (validated.icon !== undefined) updateData.icon = validated.icon;
    if (validated.createdAt !== undefined) updateData.createdAt = validated.createdAt;
    if (validated.order !== undefined) updateData.order = validated.order;

    const updated = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    revalidateAccountingRoutes();
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить счёт" };
  }
}

export async function archiveAccount(id: string) {
  try {
    await requireUserId();

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return { error: "Счёт не найден" };
    }

    await requireWorkspaceAccess(account.workspaceId);

    if (account.archived) {
      revalidateAccountingRoutes();
      return { success: true };
    }

    await prisma.account.update({
      where: { id },
      data: { archived: true },
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось архивировать счёт" };
  }
}

export async function getAccounts(workspaceId: string) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        archived: false,
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
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return { data: accounts };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить счета" };
  }
}

export async function getAccount(id: string) {
  try {
    await requireUserId();

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return { error: "Счёт не найден" };
    }

    if (account.archived) {
      return { error: "Счёт не найден" };
    }

    await requireWorkspaceAccess(account.workspaceId);

    return { data: account };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить счёт" };
  }
}

export async function updateAccountsOrder(workspaceId: string, input: UpdateAccountsOrderInput) {
  try {
    const { userId } = await requireWorkspaceAccess(workspaceId);

    const validated = updateAccountsOrderSchema.parse(input);

    await prisma.$transaction(
      validated.accountOrders.map(({ id, order }) =>
        prisma.account.updateMany({
          where: {
            id,
            workspaceId,
            workspace: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
          data: { order },
        })
      )
    );

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить порядок счетов" };
  }
}

export async function getArchivedAccounts(workspaceId: string) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const accounts = await prisma.account.findMany({
      where: {
        workspaceId,
        archived: true,
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
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: accounts };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить архивированные счета" };
  }
}

export async function unarchiveAccount(id: string) {
  try {
    await requireUserId();

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return { error: "Счёт не найден" };
    }

    await requireWorkspaceAccess(account.workspaceId);

    if (!account.archived) {
      revalidateAccountingRoutes();
      return { success: true };
    }

    const accountsCount = await prisma.account.count({
      where: { workspaceId: account.workspaceId, archived: false },
    });

    await prisma.account.update({
      where: { id },
      data: { archived: false, order: accountsCount },
    });

    revalidateAccountingRoutes();
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить счёт из архива" };
  }
}
