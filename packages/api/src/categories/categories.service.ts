import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Category, Prisma } from "@prisma/client";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";
import { ObjectStorageService } from "@/storage/object-storage.service";

import {
  type CategoryIconDto,
  type CreateCategoryDto,
  PERSISTED_ID_PATTERN,
  type UpdateCategoriesOrderDto,
  type UpdateCategoryDto,
} from "./categories.dto";

const CATEGORY_TYPES = ["income", "expense"] as const;
const CATEGORY_WITH_COUNT_INCLUDE = {
  _count: {
    select: {
      paymentTransactions: true,
    },
  },
} satisfies Prisma.CategoryInclude;
const CATEGORY_ICON_MAX_BYTES = 2 * 1024 * 1024;
const CATEGORY_ICON_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CATEGORY_ICON_PATH_PREFIX = "/category-icons/";

type CategoryIconFile = Pick<Express.Multer.File, "buffer" | "mimetype" | "size">;
type CategoryDatabaseClient = Pick<Prisma.TransactionClient, "category" | "categoryIconAsset">;

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
    iconAssetId: category.iconAssetId,
    order: category.order,
    createdAt: toIsoString(category.createdAt),
    updatedAt: toIsoString(category.updatedAt),
    transactionCount: category._count?.paymentTransactions ?? 0,
  };
}

function toCategoryIconDto(asset: { id: string; workspaceId: string; createdAt: Date }): CategoryIconDto {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    url: `${CATEGORY_ICON_PATH_PREFIX}${asset.id}`,
    createdAt: asset.createdAt.toISOString(),
  };
}

function hasExpectedMagicBytes(file: CategoryIconFile): boolean {
  const { buffer, mimetype } = file;

  if (mimetype === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function hasCategoryIconAssetId(iconAssetId: string | null | undefined): iconAssetId is string {
  return iconAssetId !== null && iconAssetId !== undefined;
}

function isTransactionConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService
  ) {}

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
    this.assertCategoryIconSelectionInput(input.icon, input.iconAssetId);
    const iconAssetId = input.iconAssetId;

    if (hasCategoryIconAssetId(iconAssetId)) {
      return this.runCategoryIconTransaction(async (transaction) => {
        await this.lockCategoryIconAssetForAssignment(transaction, workspaceId, iconAssetId);
        return this.createCategoryWithClient(transaction, workspaceId, input);
      });
    }

    return this.createCategoryWithClient(this.prisma, workspaceId, input);
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
    const existingCategory = await this.getAccessibleCategory(categoryId, currentUser);
    this.assertCategoryIconSelectionInput(input.icon, input.iconAssetId);
    const iconAssetId = input.iconAssetId;

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.order !== undefined) data.order = input.order;
    if (input.icon !== undefined) {
      data.icon = input.icon;
      if (input.icon !== null && input.iconAssetId === undefined) data.iconAssetId = null;
    }
    if (input.iconAssetId !== undefined) {
      data.iconAssetId = input.iconAssetId;
      if (input.iconAssetId !== null && input.icon === undefined) data.icon = null;
    }

    if (hasCategoryIconAssetId(iconAssetId)) {
      return this.runCategoryIconTransaction(async (transaction) => {
        await this.lockCategoryIconAssetForAssignment(transaction, existingCategory.workspaceId, iconAssetId);
        return this.updateCategoryWithClient(transaction, categoryId, data);
      });
    }

    return this.updateCategoryWithClient(this.prisma, categoryId, data);
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

  async listCategoryIcons(workspaceId: string, currentUser: AuthenticatedUser) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);

    const assets = await this.prisma.categoryIconAsset.findMany({
      where: { workspaceId, isDeleting: { not: true } },
      select: { id: true, workspaceId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return { icons: assets.map(toCategoryIconDto) };
  }

  async uploadCategoryIcon(workspaceId: string, currentUser: AuthenticatedUser, file: CategoryIconFile | undefined) {
    await this.assertWorkspaceAccess(workspaceId, currentUser);
    this.validateCategoryIconFile(file);

    const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const storageKey = `category-icons/${workspaceId}/${randomUUID()}.${extension}`;
    await this.storage.upload({ key: storageKey, buffer: file.buffer, contentType: file.mimetype });

    try {
      const asset = await this.prisma.categoryIconAsset.create({
        data: {
          workspaceId,
          uploadedById: currentUser.id,
          storageKey,
        },
        select: { id: true, workspaceId: true, createdAt: true },
      });

      return { icon: toCategoryIconDto(asset) };
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async getCategoryIconReadUrl(iconId: string, currentUser: AuthenticatedUser): Promise<string> {
    this.assertPersistedId(iconId, "Недопустимый идентификатор иконки");

    const asset = await this.prisma.categoryIconAsset.findUnique({
      where: { id: iconId },
      select: { workspaceId: true, storageKey: true, isDeleting: true },
    });

    if (!asset || asset.isDeleting) throw new NotFoundException("Иконка не найдена");
    await this.assertWorkspaceAccess(asset.workspaceId, currentUser);

    return this.storage.getReadUrl(asset.storageKey);
  }

  async deleteCategoryIcon(iconId: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertPersistedId(iconId, "Недопустимый идентификатор иконки");

    const asset = await this.prisma.categoryIconAsset.findUnique({
      where: { id: iconId },
      select: { workspaceId: true, storageKey: true, isDeleting: true },
    });

    if (!asset) throw new NotFoundException("Иконка не найдена");
    await this.assertWorkspaceAccess(asset.workspaceId, currentUser);

    if (asset.isDeleting) {
      await this.storage.delete(asset.storageKey);
      await this.prisma.categoryIconAsset.delete({ where: { id: iconId } });
      return;
    }

    const storageKey = await this.runCategoryIconTransaction(async (transaction) => {
      const usageCount = await transaction.category.count({
        where: { iconAssetId: iconId },
      });

      if (usageCount > 0) {
        throw new ConflictException(`Иконка используется в ${usageCount} категориях`);
      }

      const markDeleting = await transaction.categoryIconAsset.updateMany({
        where: {
          id: iconId,
          workspaceId: asset.workspaceId,
          isDeleting: { not: true },
        },
        data: { isDeleting: true },
      });

      if (markDeleting.count > 0) {
        return asset.storageKey;
      }

      const currentAsset = await transaction.categoryIconAsset.findUnique({
        where: { id: iconId },
        select: { workspaceId: true, isDeleting: true },
      });

      if (!currentAsset || currentAsset.workspaceId !== asset.workspaceId) {
        throw new NotFoundException("Иконка не найдена");
      }

      if (currentAsset.isDeleting) {
        throw new ConflictException("Иконка уже удаляется");
      }

      throw new ConflictException("Иконка изменилась одновременно, повторите попытку");
    });

    await this.storage.delete(storageKey);
    await this.prisma.categoryIconAsset.delete({ where: { id: iconId } });
  }

  private async createCategoryWithClient(
    client: CategoryDatabaseClient,
    workspaceId: string,
    input: CreateCategoryDto
  ) {
    const maxOrderCategory = await client.category.findFirst({
      where: {
        workspaceId,
        type: input.type,
      },
      orderBy: { order: "desc" },
    });

    const order = maxOrderCategory ? maxOrderCategory.order + 1 : 0;
    const category = await client.category.create({
      data: {
        name: input.name,
        type: input.type,
        icon: input.icon ?? null,
        iconAssetId: input.iconAssetId ?? null,
        workspaceId,
        order,
      },
      include: CATEGORY_WITH_COUNT_INCLUDE,
    });

    return { category: toCategoryDto(category) };
  }

  private async updateCategoryWithClient(
    client: CategoryDatabaseClient,
    categoryId: string,
    data: Prisma.CategoryUncheckedUpdateInput
  ) {
    const category = await client.category.update({
      where: { id: categoryId },
      data,
      include: CATEGORY_WITH_COUNT_INCLUDE,
    });

    return { category: toCategoryDto(category) };
  }

  private assertCategoryIconSelectionInput(icon?: string | null, iconAssetId?: string | null) {
    const hasIcon = icon !== null && icon !== undefined;
    const hasIconAsset = hasCategoryIconAssetId(iconAssetId);

    if (hasIcon && hasIconAsset) {
      throw new BadRequestException("Выберите эмодзи или загруженную иконку");
    }

    if (hasIconAsset) {
      this.assertPersistedId(iconAssetId, "Недопустимый идентификатор иконки");
    }
  }

  private async lockCategoryIconAssetForAssignment(
    client: CategoryDatabaseClient,
    workspaceId: string,
    iconAssetId: string
  ): Promise<void> {
    const lock = await client.categoryIconAsset.updateMany({
      where: {
        id: iconAssetId,
        workspaceId,
        isDeleting: { not: true },
      },
      data: { updatedAt: new Date() },
    });

    if (lock.count > 0) {
      return;
    }

    const asset = await client.categoryIconAsset.findUnique({
      where: { id: iconAssetId },
      select: { workspaceId: true, isDeleting: true },
    });

    if (!asset || asset.workspaceId !== workspaceId) {
      throw new BadRequestException("Иконка не принадлежит рабочему столу");
    }

    if (asset.isDeleting) {
      throw new ConflictException("Иконка удаляется");
    }

    throw new ConflictException("Иконка изменилась одновременно, повторите попытку");
  }

  private async runCategoryIconTransaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(callback);
    } catch (error) {
      if (isTransactionConflict(error)) {
        throw new ConflictException("Иконка изменилась одновременно, повторите попытку");
      }

      throw error;
    }
  }

  private assertPersistedId(value: unknown, message: string): asserts value is string {
    if (typeof value !== "string" || !PERSISTED_ID_PATTERN.test(value)) {
      throw new BadRequestException(message);
    }
  }

  private validateCategoryIconFile(file: CategoryIconFile | undefined): asserts file is CategoryIconFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Выберите изображение");
    }

    if (file.size > CATEGORY_ICON_MAX_BYTES) {
      throw new BadRequestException("Изображение слишком большое");
    }

    if (!CATEGORY_ICON_MIME_TYPES.has(file.mimetype) || !hasExpectedMagicBytes(file)) {
      throw new BadRequestException("Поддерживаются только PNG, JPEG и WebP изображения");
    }
  }
}
