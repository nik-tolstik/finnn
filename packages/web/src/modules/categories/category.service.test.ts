import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryType } from "./category.constants";

const createApiCategoryMock = vi.fn();
const deleteApiCategoryMock = vi.fn();
const getApiCategoryTransactionCountMock = vi.fn();
const listApiCategoriesMock = vi.fn();
const updateApiCategoriesOrderMock = vi.fn();
const updateApiCategoryMock = vi.fn();
const getServerApiRequestOptionsMock = vi.fn();
const revalidateAccountingRoutesMock = vi.fn();

vi.mock("@/shared/api/generated/categories/categories", () => ({
  createCategory: createApiCategoryMock,
  deleteCategory: deleteApiCategoryMock,
  getCategoryTransactionCount: getApiCategoryTransactionCountMock,
  listCategories: listApiCategoriesMock,
  updateCategoriesOrder: updateApiCategoriesOrderMock,
  updateCategory: updateApiCategoryMock,
}));

vi.mock("@/shared/lib/api-session", () => ({
  getServerApiRequestOptions: getServerApiRequestOptionsMock,
}));

vi.mock("@/shared/lib/revalidate-app-routes", () => ({
  revalidateAccountingRoutes: revalidateAccountingRoutesMock,
}));

const requestOptions = {
  cache: "no-store",
  headers: { cookie: "finnn_session=token" },
};

function createCategoryDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "category-1",
    workspaceId: "workspace-1",
    name: "Groceries",
    type: "expense",
    icon: null,
    order: 0,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    transactionCount: 4,
    ...overrides,
  };
}

describe("category.service API adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerApiRequestOptionsMock.mockResolvedValue(requestOptions);
  });

  it("maps category lists to legacy count and date shapes", async () => {
    listApiCategoriesMock.mockResolvedValue({
      categories: [createCategoryDto()],
    });

    const { getCategories } = await import("./category.service");
    const result = await getCategories("workspace-1", "expense");

    expect(listApiCategoriesMock).toHaveBeenCalledWith("workspace-1", { type: "expense" }, requestOptions);
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "category-1",
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          updatedAt: new Date("2026-05-02T00:00:00.000Z"),
          transactionCount: 4,
          _count: {
            paymentTransactions: 4,
          },
        }),
      ],
    });
  });

  it("unwraps category mutation responses and revalidates accounting routes", async () => {
    createApiCategoryMock.mockResolvedValue({
      category: createCategoryDto({ id: "category-2", name: "Salary", type: "income" }),
    });
    updateApiCategoryMock.mockResolvedValue({
      category: createCategoryDto({ name: "Food" }),
    });
    deleteApiCategoryMock.mockResolvedValue(undefined);

    const { createCategory, deleteCategory, updateCategory } = await import("./category.service");

    await expect(createCategory("workspace-1", { name: "Salary", type: CategoryType.INCOME })).resolves.toEqual({
      data: expect.objectContaining({ id: "category-2", type: "income" }),
    });
    await expect(updateCategory("category-1", { name: "Food", order: 2 })).resolves.toEqual({
      data: expect.objectContaining({ name: "Food" }),
    });
    await expect(deleteCategory("category-1")).resolves.toEqual({ success: true });

    expect(createApiCategoryMock).toHaveBeenCalledWith(
      "workspace-1",
      { name: "Salary", type: "income", icon: undefined },
      requestOptions
    );
    expect(updateApiCategoryMock).toHaveBeenCalledWith(
      "category-1",
      { name: "Food", type: undefined, icon: undefined, order: 2 },
      requestOptions
    );
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(3);
  });

  it("forwards order payloads and unwraps transaction counts", async () => {
    updateApiCategoriesOrderMock.mockResolvedValue({ success: true });
    getApiCategoryTransactionCountMock.mockResolvedValue({ count: 7 });

    const { getCategoryTransactionCount, updateCategoriesOrder } = await import("./category.service");

    await expect(updateCategoriesOrder("workspace-1", ["category-2", "category-1"])).resolves.toEqual({
      success: true,
    });
    await expect(getCategoryTransactionCount("category-1")).resolves.toEqual({ data: 7 });

    expect(updateApiCategoriesOrderMock).toHaveBeenCalledWith(
      "workspace-1",
      { categoryIds: ["category-2", "category-1"] },
      requestOptions
    );
    expect(getApiCategoryTransactionCountMock).toHaveBeenCalledWith("category-1", requestOptions);
    expect(revalidateAccountingRoutesMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes API failures into action errors", async () => {
    listApiCategoriesMock.mockRejectedValue(new Error("No access"));

    const { getCategories } = await import("./category.service");

    await expect(getCategories("workspace-1")).resolves.toEqual({ error: "No access" });
  });
});
