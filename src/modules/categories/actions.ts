"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/shared/lib/validations/category";
import { revalidatePath } from "next/cache";

export async function createCategory(
  workspaceId: string,
  input: CreateCategoryInput
) {
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
    return { error: error.message || "Failed to create category" };
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
      return { error: "Category not found or access denied" };
    }

    const validated = updateCategorySchema.parse(input);

    const updated = await prisma.category.update({
      where: { id },
      data: validated,
    });

    revalidatePath("/categories");
    return { data: updated };
  } catch (error: any) {
    return { error: error.message || "Failed to update category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
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
      return { error: "Category not found or access denied" };
    }

    await prisma.category.delete({
      where: { id },
    });

    revalidatePath("/categories");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete category" };
  }
}

export async function getCategories(workspaceId: string, type?: string) {
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

    const categories = await prisma.category.findMany({
      where: {
        workspaceId,
        ...(type && { type }),
      },
      orderBy: { name: "asc" },
    });

    return { data: categories };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch categories" };
  }
}

