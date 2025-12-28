"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/shared/lib/validations/category";

export async function createCategory(
  workspaceId: string,
  input: CreateCategoryInput
) {
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

    const validated = createCategorySchema.parse(input);

    const category = await prisma.category.create({
      data: {
        ...validated,
        workspaceId,
      },
    });

    revalidatePath("/categories");
    return { data: category };
  } catch (error: any) {
    return { error: error.message || "Не удалось создать категорию" };
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const category = await prisma.category.findFirst({
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

    if (!category) {
      return { error: "Категория не найдена или доступ запрещён" };
    }

    const validated = updateCategorySchema.parse(input);

    const updated = await prisma.category.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/categories");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Не удалось обновить категорию" };
  }
}

export async function deleteCategory(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const category = await prisma.category.findFirst({
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

    if (!category) {
      return { error: "Категория не найдена или доступ запрещён" };
    }

    await prisma.category.delete({
      where: { id },
    });

    revalidatePath("/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Не удалось удалить категорию" };
  }
}

export async function getCategories(workspaceId: string, type?: string) {
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

    const categories = await prisma.category.findMany({
      where: {
        workspaceId,
        ...(type && { type }),
      },
      orderBy: { name: "asc" },
    });

    return { data: categories };
  } catch (error: any) {
    return { error: error.message || "Не удалось загрузить категории" };
  }
}

export async function getCategoryTransactionCount(categoryId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Не авторизован" };
    }

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!category) {
      return { error: "Категория не найдена или доступ запрещён" };
    }

    const count = await prisma.transaction.count({
      where: {
        categoryId,
      },
    });

    return { data: count };
  } catch (error: any) {
    return { error: error.message || "Не удалось подсчитать транзакции" };
  }
}
