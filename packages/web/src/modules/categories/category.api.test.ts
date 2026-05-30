import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryType } from "./category.constants";

const createApiCategoryMock = vi.fn();
const deleteApiCategoryMock = vi.fn();
const getApiCategoryTransactionCountMock = vi.fn();
const listApiCategoriesMock = vi.fn();
const updateApiCategoriesOrderMock = vi.fn();
const updateApiCategoryMock = vi.fn();

vi.mock("@/shared/api/generated/categories/categories", () => ({
  createCategory: createApiCategoryMock,
  deleteCategory: deleteApiCategoryMock,
  getCategoryTransactionCount: getApiCategoryTransactionCountMock,
  listCategories: listApiCategoriesMock,
  updateCategoriesOrder: updateApiCategoriesOrderMock,
  updateCategory: updateApiCategoryMock,
}));

const requestOptions = {
  cache: "no-store" as const,
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

describe("category.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps category lists to UI-facing count and date shapes", async () => {
    listApiCategoriesMock.mockResolvedValue({
      categories: [createCategoryDto()],
    });

    const { getCategories } = await import("./category.api");
    const result = await getCategories("workspace-1", "expense", requestOptions);

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

  it("unwraps category mutation responses through API adapters", async () => {
    createApiCategoryMock.mockResolvedValue({
      category: createCategoryDto({ id: "category-2", name: "Salary", type: "income" }),
    });
    updateApiCategoryMock.mockResolvedValue({
      category: createCategoryDto({ name: "Food" }),
    });
    deleteApiCategoryMock.mockResolvedValue(undefined);

    const { createCategory, deleteCategory, updateCategory } = await import("./category.api");

    await expect(createCategory("workspace-1", { name: "Salary", type: CategoryType.INCOME })).resolves.toEqual({
      data: expect.objectContaining({ id: "category-2", type: "income" }),
    });
    await expect(updateCategory("category-1", { name: "Food", order: 2 })).resolves.toEqual({
      data: expect.objectContaining({ name: "Food" }),
    });
    await expect(deleteCategory("category-1")).resolves.toEqual({ success: true });

    expect(createApiCategoryMock).toHaveBeenCalledWith(
      "workspace-1",
      {
        name: "Salary",
        type: "income",
        icon: undefined,
      },
      undefined
    );
    expect(updateApiCategoryMock).toHaveBeenCalledWith(
      "category-1",
      {
        name: "Food",
        type: undefined,
        icon: undefined,
        order: 2,
      },
      undefined
    );
    expect(deleteApiCategoryMock).toHaveBeenCalledWith("category-1", undefined);
  });

  it("forwards order payloads and unwraps transaction counts", async () => {
    updateApiCategoriesOrderMock.mockResolvedValue({ success: true });
    getApiCategoryTransactionCountMock.mockResolvedValue({ count: 7 });

    const { getCategoryTransactionCount, updateCategoriesOrder } = await import("./category.api");

    await expect(updateCategoriesOrder("workspace-1", ["category-2", "category-1"], requestOptions)).resolves.toEqual({
      success: true,
    });
    await expect(getCategoryTransactionCount("category-1", requestOptions)).resolves.toEqual({ data: 7 });

    expect(updateApiCategoriesOrderMock).toHaveBeenCalledWith(
      "workspace-1",
      { categoryIds: ["category-2", "category-1"] },
      requestOptions
    );
    expect(getApiCategoryTransactionCountMock).toHaveBeenCalledWith("category-1", requestOptions);
  });

  it("normalizes API failures into action errors", async () => {
    listApiCategoriesMock.mockRejectedValue(new Error("No access"));

    const { getCategories } = await import("./category.api");

    await expect(getCategories("workspace-1")).resolves.toEqual({ error: "No access" });
  });
});
