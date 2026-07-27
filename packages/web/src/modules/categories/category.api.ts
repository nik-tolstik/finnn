import {
  createCategory as createApiCategory,
  deleteCategory as deleteApiCategory,
  deleteCategoryIcon as deleteApiCategoryIcon,
  getCategoryTransactionCount as getApiCategoryTransactionCount,
  listCategories as listApiCategories,
  listCategoryIcons as listApiCategoryIcons,
  updateCategoriesOrder as updateApiCategoriesOrder,
  updateCategory as updateApiCategory,
  uploadCategoryIcon as uploadApiCategoryIcon,
} from "@/shared/api/generated/categories/categories";
import type {
  CategoryDto,
  CategoryIconDto,
  CreateCategoryDto,
  ListCategoriesParams,
  UpdateCategoryDto,
} from "@/shared/api/generated/model";
import { fail, ok, success } from "@/shared/lib/action-result";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/shared/lib/validations/category";

import type { CategoryIconAsset } from "./category.types";

function toUiCategory(category: CategoryDto) {
  return {
    ...category,
    icon: category.icon ?? null,
    iconAssetId: category.iconAssetId ?? null,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt),
    _count: {
      paymentTransactions: category.transactionCount,
    },
  };
}

function toCreateCategoryDto(input: CreateCategoryInput): CreateCategoryDto {
  return {
    name: input.name,
    type: input.type as CreateCategoryDto["type"],
    icon: input.icon,
    iconAssetId: input.iconAssetId,
  };
}

function toUpdateCategoryDto(input: UpdateCategoryInput): UpdateCategoryDto {
  return {
    name: input.name,
    type: input.type as UpdateCategoryDto["type"],
    icon: input.icon,
    iconAssetId: input.iconAssetId,
    order: input.order,
  };
}

function toUiCategoryIcon(icon: CategoryIconDto): CategoryIconAsset {
  return {
    ...icon,
    createdAt: new Date(icon.createdAt),
  };
}

export async function getCategoryIcons(workspaceId: string, options?: RequestInit) {
  try {
    const response = await listApiCategoryIcons(workspaceId, options);
    return ok(response.icons.map(toUiCategoryIcon));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить иконки категорий");
  }
}

export async function uploadCategoryIcon(workspaceId: string, file: File, options?: RequestInit) {
  try {
    const response = await uploadApiCategoryIcon(workspaceId, { file }, options);
    return ok(toUiCategoryIcon(response.icon));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить иконку");
  }
}

export async function deleteCategoryIcon(iconId: string, options?: RequestInit) {
  try {
    await deleteApiCategoryIcon(iconId, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить иконку");
  }
}

export async function createCategory(workspaceId: string, input: CreateCategoryInput, options?: RequestInit) {
  try {
    const response = await createApiCategory(workspaceId, toCreateCategoryDto(input), options);
    return ok(toUiCategory(response.category));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать категорию");
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput, options?: RequestInit) {
  try {
    const response = await updateApiCategory(id, toUpdateCategoryDto(input), options);
    return ok(toUiCategory(response.category));
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить категорию");
  }
}

export async function deleteCategory(id: string, options?: RequestInit) {
  try {
    await deleteApiCategory(id, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось удалить категорию");
  }
}

export async function getCategories(workspaceId: string, type?: string, options?: RequestInit) {
  try {
    const params = type ? ({ type } as ListCategoriesParams) : undefined;
    const response = await listApiCategories(workspaceId, params, options);
    return ok(response.categories.map(toUiCategory));
  } catch (error: unknown) {
    return fail(error, "Не удалось загрузить категории");
  }
}

export async function updateCategoriesOrder(workspaceId: string, categoryIds: string[], options?: RequestInit) {
  try {
    await updateApiCategoriesOrder(workspaceId, { categoryIds }, options);
    return success();
  } catch (error: unknown) {
    return fail(error, "Не удалось обновить порядок категорий");
  }
}

export async function getCategoryTransactionCount(categoryId: string, options?: RequestInit) {
  try {
    const response = await getApiCategoryTransactionCount(categoryId, options);
    return ok(response.count);
  } catch (error: unknown) {
    return fail(error, "Не удалось подсчитать транзакции");
  }
}
