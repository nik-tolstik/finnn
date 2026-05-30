import {
  createCategory as createApiCategory,
  deleteCategory as deleteApiCategory,
  getCategoryTransactionCount as getApiCategoryTransactionCount,
  listCategories as listApiCategories,
  updateCategoriesOrder as updateApiCategoriesOrder,
  updateCategory as updateApiCategory,
} from "@/shared/api/generated/categories/categories";
import type {
  CategoryDto,
  CreateCategoryDto,
  ListCategoriesParams,
  UpdateCategoryDto,
} from "@/shared/api/generated/model";
import { fail, ok, success } from "@/shared/lib/action-result";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/shared/lib/validations/category";

function toLegacyCategory(category: CategoryDto) {
  return {
    ...category,
    icon: category.icon ?? null,
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
  };
}

function toUpdateCategoryDto(input: UpdateCategoryInput): UpdateCategoryDto {
  return {
    name: input.name,
    type: input.type as UpdateCategoryDto["type"],
    icon: input.icon,
    order: input.order,
  };
}

export async function createCategory(workspaceId: string, input: CreateCategoryInput, options?: RequestInit) {
  try {
    const response = await createApiCategory(workspaceId, toCreateCategoryDto(input), options);
    return ok(toLegacyCategory(response.category));
  } catch (error: unknown) {
    return fail(error, "Не удалось создать категорию");
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput, options?: RequestInit) {
  try {
    const response = await updateApiCategory(id, toUpdateCategoryDto(input), options);
    return ok(toLegacyCategory(response.category));
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
    return ok(response.categories.map(toLegacyCategory));
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
