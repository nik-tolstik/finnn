import { type INestApplication, ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { CategoriesModule } from "../src/categories/categories.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { ObjectStorageService } from "../src/storage/object-storage.service";

type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
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
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  categoryIconAsset: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
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
  const prisma: MockPrisma = {
    $transaction: vi.fn(),
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
      updateMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    categoryIconAsset: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentTransaction: {
      count: vi.fn(),
    },
  };

  prisma.$transaction.mockImplementation(async (callback: (transaction: MockPrisma) => unknown) => callback(prisma));

  return prisma;
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  emailVerified: new Date("2026-05-25T00:00:00.000Z"),
  name: "Ada",
  image: null,
};

const categoryIconAssetId = "665f5d865ef5a20c0d2f4444";
const categoryIconAssetCuid = "c123456789012345678901234";
const foreignCategoryIconAssetId = "665f5d865ef5a20c0d2f5555";
const missingCategoryIconAssetId = "665f5d865ef5a20c0d2f6666";

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
  const storage = {
    upload: vi.fn(),
    delete: vi.fn(),
    getReadUrl: vi.fn(),
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [CategoriesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ObjectStorageService)
      .useValue(storage)
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
    prisma.category.count.mockResolvedValue(0);
    prisma.paymentTransaction.count.mockResolvedValue(4);
    prisma.categoryIconAsset.findMany.mockResolvedValue([]);
    prisma.categoryIconAsset.findUnique.mockResolvedValue({
      id: categoryIconAssetId,
      isDeleting: false,
      workspaceId: "workspace-1",
      storageKey: `category-icons/workspace-1/${categoryIconAssetId}.png`,
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    prisma.categoryIconAsset.create.mockResolvedValue({
      id: categoryIconAssetId,
      isDeleting: false,
      workspaceId: "workspace-1",
      storageKey: `category-icons/workspace-1/${categoryIconAssetId}.png`,
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    prisma.categoryIconAsset.delete.mockResolvedValue({});
    prisma.categoryIconAsset.update.mockResolvedValue({
      id: categoryIconAssetId,
      isDeleting: false,
      storageKey: `category-icons/workspace-1/${categoryIconAssetId}.png`,
      workspaceId: "workspace-1",
    });
    prisma.categoryIconAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.upload.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    storage.getReadUrl.mockResolvedValue("https://storage.example/icon.png");
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
          iconAssetId: null,
          name: "Groceries",
          order: 4,
          type: "expense",
          workspaceId: "workspace-1",
        },
      })
    );
  });

  it("creates a category with an available uploaded icon", async () => {
    mockAuthenticatedSession(prisma);
    prisma.category.create.mockResolvedValue(
      createCategoryRecord({
        icon: null,
        iconAssetId: categoryIconAssetId,
      })
    );

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "With uploaded icon", type: "expense", iconAssetId: categoryIconAssetId })
      .expect(201);

    expect(response.body.category).toMatchObject({
      icon: null,
      iconAssetId: categoryIconAssetId,
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          icon: null,
          iconAssetId: categoryIconAssetId,
        }),
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

  it("lists uploaded workspace icons and protects the endpoint", async () => {
    mockAuthenticatedSession(prisma);
    prisma.categoryIconAsset.findMany.mockResolvedValue([
      {
        id: categoryIconAssetId,
        isDeleting: false,
        workspaceId: "workspace-1",
        storageKey: `category-icons/workspace-1/${categoryIconAssetId}.png`,
        createdAt: new Date("2026-05-25T12:00:00.000Z"),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/category-icons")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.icons[0]).toMatchObject({ id: categoryIconAssetId, workspaceId: "workspace-1" });
    expect(prisma.categoryIconAsset.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, id: true, workspaceId: true },
      where: { isDeleting: { not: true }, workspaceId: "workspace-1" },
    });
  });

  it("validates uploaded icon MIME and magic bytes", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/category-icons")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", Buffer.from("not-an-image"), { filename: "icon.png", contentType: "image/png" })
      .expect(400);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(prisma.categoryIconAsset.create).not.toHaveBeenCalled();
  });

  it("uploads a valid icon and redirects protected reads to a presigned URL without caching it", async () => {
    mockAuthenticatedSession(prisma);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const uploadResponse = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/category-icons")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .attach("file", pngHeader, { filename: "icon.png", contentType: "image/png" })
      .expect(200);

    expect(uploadResponse.body.icon).toMatchObject({
      id: categoryIconAssetId,
      workspaceId: "workspace-1",
    });
    expect(prisma.categoryIconAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          storageKey: expect.stringContaining("category-icons/"),
          uploadedById: currentUser.id,
          workspaceId: "workspace-1",
        },
      })
    );
    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        buffer: pngHeader,
        key: expect.stringContaining("category-icons/"),
      })
    );

    const iconResponse = await request(app.getHttpServer())
      .get(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(302)
      .expect("Cache-Control", "no-store, max-age=0")
      .expect("Location", "https://storage.example/icon.png");

    expect(iconResponse.text ?? "").toBe("");
  });

  it("returns not found when reading or deleting a missing icon", async () => {
    mockAuthenticatedSession(prisma);
    prisma.categoryIconAsset.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/category-icons/${missingCategoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/category-icons/${missingCategoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(404);
  });

  it("accepts PostgreSQL-era CUID icon identifiers", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .get(`/category-icons/${categoryIconAssetCuid}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(302);

    expect(prisma.categoryIconAsset.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: categoryIconAssetCuid } })
    );
  });

  it("does not serve an icon that is being deleted", async () => {
    mockAuthenticatedSession(prisma);
    prisma.categoryIconAsset.findUnique.mockResolvedValue({
      isDeleting: true,
      storageKey: `category-icons/workspace-1/${categoryIconAssetId}.png`,
      workspaceId: "workspace-1",
    });

    await request(app.getHttpServer())
      .get(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(404);

    expect(storage.getReadUrl).not.toHaveBeenCalled();
  });

  it("rejects malformed icon route parameters before querying the database", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .get("/category-icons/not-an-object-id")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    await request(app.getHttpServer())
      .delete("/category-icons/not-an-object-id")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(prisma.categoryIconAsset.findUnique).not.toHaveBeenCalled();
  });

  it("deletes an unused workspace icon from storage and the database", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .delete(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.category.count).toHaveBeenCalledWith({ where: { iconAssetId: categoryIconAssetId } });
    expect(storage.delete).toHaveBeenCalledWith(`category-icons/workspace-1/${categoryIconAssetId}.png`);
    expect(prisma.categoryIconAsset.delete).toHaveBeenCalledWith({ where: { id: categoryIconAssetId } });
  });

  it("rejects deleting an icon used by categories", async () => {
    mockAuthenticatedSession(prisma);
    prisma.category.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .delete(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(409);

    expect(response.body.message).toContain("2");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.categoryIconAsset.delete).not.toHaveBeenCalled();
  });

  it("keeps the database asset when storage deletion fails", async () => {
    mockAuthenticatedSession(prisma);
    storage.delete.mockRejectedValueOnce(new ServiceUnavailableException("Storage is unavailable"));

    await request(app.getHttpServer())
      .delete(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(503);

    expect(storage.delete).toHaveBeenCalledWith(`category-icons/workspace-1/${categoryIconAssetId}.png`);
    expect(prisma.categoryIconAsset.delete).not.toHaveBeenCalled();
  });

  it("protects icon deletion with authentication and workspace access", async () => {
    await request(app.getHttpServer()).delete(`/category-icons/${categoryIconAssetId}`).expect(401);

    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2" });

    await request(app.getHttpServer())
      .delete(`/category-icons/${categoryIconAssetId}`)
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);

    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.categoryIconAsset.delete).not.toHaveBeenCalled();
  });

  it("rejects category icon assets from another workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.categoryIconAsset.updateMany.mockResolvedValue({ count: 0 });
    prisma.categoryIconAsset.findUnique.mockResolvedValue({
      id: foreignCategoryIconAssetId,
      isDeleting: false,
      workspaceId: "workspace-2",
    });

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Foreign icon", type: "expense", iconAssetId: foreignCategoryIconAssetId })
      .expect(400);

    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("rejects selecting an icon that is being deleted", async () => {
    mockAuthenticatedSession(prisma);
    prisma.categoryIconAsset.updateMany.mockResolvedValue({ count: 0 });
    prisma.categoryIconAsset.findUnique.mockResolvedValue({
      isDeleting: true,
      workspaceId: "workspace-1",
    });

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Deleting icon", type: "expense", iconAssetId: categoryIconAssetId })
      .expect(409);

    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("rejects malformed category icon asset IDs before querying the database", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/categories")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Malformed icon", type: "expense", iconAssetId: "not-an-object-id" })
      .expect(400);

    expect(prisma.categoryIconAsset.findUnique).not.toHaveBeenCalled();
    expect(prisma.category.create).not.toHaveBeenCalled();
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
