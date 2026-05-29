import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { CategoriesModule } from "../src/categories/categories.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  authSession: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  workspace: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  workspaceMember: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  category: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    count: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
    category: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentTransaction: {
      count: vi.fn(),
    },
  };
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

function createCategoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "category-1",
    workspaceId: "workspace-1",
    name: "Groceries",
    type: "expense",
    icon: "shopping-cart",
    order: 0,
    createdAt: new Date("2026-05-25T12:00:00.000Z"),
    updatedAt: new Date("2026-05-25T12:30:00.000Z"),
    _count: {
      paymentTransactions: 4,
    },
    ...overrides,
  };
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockResolvedValue(currentUser);
}

describe("Categories API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [CategoriesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_COOKIE_SAME_SITE: "lax",
      API_COOKIE_SECURE: "false",
    } as NodeJS.ProcessEnv);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.authSession.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: currentUser.id });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.category.findFirst.mockResolvedValue(createCategoryRecord({ order: 3 }));
    prisma.category.create.mockResolvedValue(createCategoryRecord({ order: 4 }));
    prisma.category.findMany.mockResolvedValue([createCategoryRecord()]);
    prisma.category.findUnique.mockResolvedValue(createCategoryRecord());
    prisma.category.update.mockResolvedValue(createCategoryRecord({ name: "Food" }));
    prisma.category.updateMany.mockResolvedValue({ count: 1 });
    prisma.category.delete.mockResolvedValue({});
    prisma.paymentTransaction.count.mockResolvedValue(4);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated category reads", async () => {
    await request(app.getHttpServer()).get("/workspaces/workspace-1/categories").expect(401);
  });

  it("denies workspace access for non-members", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2" });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);
  });

  it("creates categories at the end of their type order", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Groceries", type: "expense", icon: "shopping-cart" })
      .expect(201);

    expect(response.body.category).toMatchObject({
      id: "category-1",
      name: "Groceries",
      order: 4,
      transactionCount: 4,
    });
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      orderBy: { order: "desc" },
      where: { type: "expense", workspaceId: "workspace-1" },
    });
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          icon: "shopping-cart",
          name: "Groceries",
          order: 4,
          type: "expense",
          workspaceId: "workspace-1",
        },
      })
    );
  });

  it("lists categories with an optional type filter", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/categories?type=expense")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.categories).toEqual([
      expect.objectContaining({
        id: "category-1",
        transactionCount: 4,
      }),
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "expense", workspaceId: "workspace-1" },
      })
    );
  });

  it("validates category type filters", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/categories?type=other")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);
  });

  it("updates a category after checking access through the category workspace", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .patch("/categories/category-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Food", order: 2 })
      .expect(200);

    expect(response.body.category).toMatchObject({
      id: "category-1",
      name: "Food",
    });
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Food", order: 2 },
        where: { id: "category-1" },
      })
    );
  });

  it("allows empty category reorder requests", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1/categories/order")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ categoryIds: [] })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it("rejects category reorder requests with missing categories", async () => {
    mockAuthenticatedSession(prisma);
    prisma.category.findMany.mockResolvedValue([createCategoryRecord({ id: "category-1" })]);

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1/categories/order")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ categoryIds: ["category-1", "category-2"] })
      .expect(400);

    expect(response.body.message).toBe("Некоторые категории не найдены");
  });

  it("rejects category reorder requests across category types", async () => {
    mockAuthenticatedSession(prisma);
    prisma.category.findMany.mockResolvedValue([
      createCategoryRecord({ id: "category-1", type: "expense" }),
      createCategoryRecord({ id: "category-2", type: "income" }),
    ]);

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1/categories/order")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ categoryIds: ["category-1", "category-2"] })
      .expect(400);

    expect(response.body.message).toBe("Нельзя сортировать категории разных типов вместе");
  });

  it("updates category order for one category type", async () => {
    mockAuthenticatedSession(prisma);
    prisma.category.findMany.mockResolvedValue([
      createCategoryRecord({ id: "category-2", type: "expense" }),
      createCategoryRecord({ id: "category-1", type: "expense" }),
    ]);

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1/categories/order")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ categoryIds: ["category-2", "category-1"] })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prisma.category.updateMany).toHaveBeenCalledWith({
      data: { order: 0 },
      where: { id: "category-2", workspaceId: "workspace-1" },
    });
    expect(prisma.category.updateMany).toHaveBeenCalledWith({
      data: { order: 1 },
      where: { id: "category-1", workspaceId: "workspace-1" },
    });
  });

  it("counts category transactions after enforcing category workspace access", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/categories/category-1/transaction-count")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body).toEqual({ count: 4 });
    expect(prisma.paymentTransaction.count).toHaveBeenCalledWith({
      where: { categoryId: "category-1" },
    });
  });

  it("deletes categories after access checks", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .delete("/categories/category-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "category-1" } });
  });
});
