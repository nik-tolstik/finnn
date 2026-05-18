"use server";

import { fail, ok, success } from "@/shared/lib/action-result";
import { prisma } from "@/shared/lib/prisma";
import { revalidateAccountingRoutes } from "@/shared/lib/revalidate-app-routes";
import { requireUserId, requireWorkspaceAccess } from "@/shared/lib/server-access";
import {
  type CreateCategoryInput,
  createCategorySchema,
  type UpdateCategoryInput,
  updateCategorySchema,
} from "@/shared/lib/validations/category";

export async function createCategory(workspaceId: string, input: CreateCategoryInput) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const validated = createCategorySchema.parse(input);

    const maxOrderCategory = await prisma.category.findFirst({
      where: {
        workspaceId,
        type: validated.type,
      },
      orderBy: { order: "desc" },
    });

    const order = maxOrderCategory ? maxOrderCategory.order + 1 : 0;

    const category = await prisma.category.create({
      data: {
        ...validated,
        workspaceId,
        order,
      },
    });

    revalidateAccountingRoutes();
    return ok(category);
  } catch (error: unknown) {
    return fail(error, "Не удалось создать категорию");
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  try {
    await requireUserId();

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return { error: "Категория не найдена" };
    }

    await requireWorkspaceAccess(category.workspaceId);

    const validated = updateCategorySchema.parse(input);

    const updated = await prisma.category.update({
      where: { id },
      data: validated,
    });

    revalidateAccountingRoutes();
    return ok(updated);
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить категорию");
  }
}

export async function deleteCategory(id: string) {
  try {
    await requireUserId();

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return { error: "Категория не найдена" };
    }

    await requireWorkspaceAccess(category.workspaceId);

    await prisma.category.delete({
      where: { id },
    });

    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить категорию");
  }
}

export async function getCategories(workspaceId: string, type?: string) {
  try {
    await requireWorkspaceAccess(workspaceId);

    const categories = await prisma.category.findMany({
      where: {
        workspaceId,
        ...(type && { type }),
      },
      include: {
        _count: {
          select: {
            paymentTransactions: true,
          },
        },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return ok(categories);
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить категории");
  }
}

export async function updateCategoriesOrder(workspaceId: string, categoryIds: string[]) {
  try {
    await requireWorkspaceAccess(workspaceId);

    if (categoryIds.length === 0) {
      return success();
    }

    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        workspaceId,
      },
      select: { id: true, type: true },
    });

    if (categories.length !== categoryIds.length) {
      return { error: "Некоторые категории не найдены" };
    }

    const types = new Set(categories.map((c) => c.type));
    if (types.size > 1) {
      return { error: "Нельзя сортировать категории разных типов вместе" };
    }

    const updates = categoryIds.map((id, index) =>
      prisma.category.updateMany({
        where: {
          id,
          workspaceId,
        },
        data: {
          order: index,
        },
      })
    );

    await Promise.all(updates);

    revalidateAccountingRoutes();
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить порядок категорий");
  }
}

export async function getCategoryTransactionCount(categoryId: string) {
  try {
    await requireUserId();

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return { error: "Категория не найдена" };
    }

    await requireWorkspaceAccess(category.workspaceId);

    const count = await prisma.paymentTransaction.count({
      where: {
        categoryId,
      },
    });

    return ok(count);
  } catch (error: unknown) {
    return fail(error, "Не удалось подсчитать транзакции");
  }
}
