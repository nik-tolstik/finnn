import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Category, Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";

import type { CreateCategoryDto, UpdateCategoriesOrderDto, UpdateCategoryDto } from "./categories.dto";

const CATEGORY_TYPES = ["income", "expense"] as const;
const CATEGORY_WITH_COUNT_INCLUDE = {
  _count: {
    select: {
      paymentTransactions: true,
    },
  },
} satisfies Prisma.CategoryInclude;

type CategoryWithCount = Category & {
  _count?: {
    paymentTransactions: number;
  };
};

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toCategoryDto(category: CategoryWithCount) {
  return {
    id: category.id,
    workspaceId: category.workspaceId,
    name: category.name,
    type: category.type,
    icon: category.icon,
    order: category.order,
    createdAt: toIsoString(category.createdAt),
    updatedAt: toIsoString(category.updatedAt),
    transactionCount: category._count?.paymentTransactions ?? 0,
  };
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async assertWorkspaceAccess(workspaceId: string, currentUser: AuthenticatedUser) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    if (workspace.ownerId === currentUser.id) {
      return;
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException("Доступ запрещён");
    }
  }

  private async getAccessibleCategory(categoryId: string, currentUser: AuthenticatedUser) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: CATEGORY_WITH_COUNT_INCLUDE,
    });

    if (!category) {
      throw new NotFoundException("Категория не найдена");
    }

    await this.assertWorkspaceAccess(category.workspaceId, currentUser);
    return category;
  }

  async createCategory(workspaceId: string, input: CreateCategoryDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const maxOrderCategory = await this.prisma.category.findFirst({
      where: {
        workspaceId,
        type: input.type,
      },
      orderBy: { order: "desc" },
    });

    const order = maxOrderCategory ? maxOrderCategory.order + 1 : 0;

    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        type: input.type,
        icon: input.icon,
        workspaceId,
        order,
      },
      include: CATEGORY_WITH_COUNT_INCLUDE,
    });

    return { category: toCategoryDto(category) };
  }

  async listCategories(workspaceId: string, type: string | undefined, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    if (type && !CATEGORY_TYPES.includes(type as (typeof CATEGORY_TYPES)[number])) {
      throw new BadRequestException("Недопустимый тип категории");
    }

    const categories = await this.prisma.category.findMany({
      where: {
        workspaceId,
        ...(type ? { type } : {}),
      },
      include: CATEGORY_WITH_COUNT_INCLUDE,
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return { categories: categories.map(toCategoryDto) };
  }

  async updateCategory(categoryId: string, input: UpdateCategoryDto, currentUser: AuthenticatedUser) {
    await this.getAccessibleCategory(categoryId, currentUser);

    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data: input,
      include: CATEGORY_WITH_COUNT_INCLUDE,
    });

    return { category: toCategoryDto(category) };
  }

  async deleteCategory(categoryId: string, currentUser: AuthenticatedUser) {
    await this.getAccessibleCategory(categoryId, currentUser);

    await this.prisma.category.delete({
      where: { id: categoryId },
    });
  }

  async updateCategoriesOrder(workspaceId: string, input: UpdateCategoriesOrderDto, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    if (input.categoryIds.length === 0) {
      return { success: true };
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: input.categoryIds },
        workspaceId,
      },
      select: { id: true, type: true },
    });

    if (categories.length !== input.categoryIds.length) {
      throw new BadRequestException("Некоторые категории не найдены");
    }

    const types = new Set(categories.map((category) => category.type));
    if (types.size > 1) {
      throw new BadRequestException("Нельзя сортировать категории разных типов вместе");
    }

    await Promise.all(
      input.categoryIds.map((id, index) =>
        this.prisma.category.updateMany({
          where: {
            id,
            workspaceId,
          },
          data: {
            order: index,
          },
        })
      )
    );

    return { success: true };
  }

  async getCategoryTransactionCount(categoryId: string, currentUser: AuthenticatedUser) {
    const category = await this.getAccessibleCategory(categoryId, currentUser);

    const count = await this.prisma.paymentTransaction.count({
      where: {
        categoryId: category.id,
      },
    });

    return { count };
  }
}
