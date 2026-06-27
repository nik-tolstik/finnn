import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountsModule } from "../src/accounts/accounts.module";
import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

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
  account: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    count: ReturnType<typeof vi.fn>;
  };
  transferTransaction: {
    count: ReturnType<typeof vi.fn>;
  };
  debt: {
    count: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    count: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  const mock = {
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
    account: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    paymentTransaction: {
      count: vi.fn(),
    },
    transferTransaction: {
      count: vi.fn(),
    },
    debt: {
      count: vi.fn(),
    },
    debtTransaction: {
      count: vi.fn(),
    },
  };
  mock.$transaction.mockResolvedValue([]);
  return mock;
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  emailVerified: new Date("2026-05-25T00:00:00.000Z"),
  name: "Ada",
  image: null,
};

const accountOwner = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

function createAccountRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    workspaceId: "workspace-1",
    ownerId: null,
    name: "Main card",
    balance: "125.50",
    initialBalance: "125.50",
    currency: "BYN",
    description: null,
    color: "#0f766e",
    icon: "wallet",
    archived: false,
    order: 0,
    createdAt: new Date("2026-05-25T12:00:00.000Z"),
    updatedAt: new Date("2026-05-25T12:30:00.000Z"),
    owner: null,
    ...overrides,
  };
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockResolvedValue(currentUser);
}

describe("Accounts API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AccountsModule],
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
    prisma.$transaction.mockResolvedValue([]);
    prisma.authSession.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: currentUser.id });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.account.count.mockResolvedValue(2);
    prisma.account.create.mockResolvedValue(
      createAccountRecord({ order: 2, owner: accountOwner, ownerId: accountOwner.id })
    );
    prisma.account.findFirst.mockResolvedValue(null);
    prisma.account.findMany.mockResolvedValue([createAccountRecord({ owner: accountOwner, ownerId: accountOwner.id })]);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord());
    prisma.account.update.mockResolvedValue(createAccountRecord({ name: "Updated card" }));
    prisma.account.updateMany.mockResolvedValue({ count: 1 });
    prisma.account.delete.mockResolvedValue({});
    prisma.paymentTransaction.count.mockResolvedValue(0);
    prisma.transferTransaction.count.mockResolvedValue(0);
    prisma.debt.count.mockResolvedValue(0);
    prisma.debtTransaction.count.mockResolvedValue(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated account reads", async () => {
    await request(app.getHttpServer()).get("/workspaces/workspace-1/accounts").expect(401);
  });

  it("denies workspace access for non-members", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2" });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);
  });

  it("creates an account with string initial balance and appends active account order", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        name: "Main card",
        initialBalance: "125.50",
        currency: "BYN",
        ownerId: null,
        color: "#0f766e",
        icon: "wallet",
        createdAt: "2026-05-25T12:00:00.000Z",
      })
      .expect(201);

    expect(response.body.account).toMatchObject({
      id: "account-1",
      balance: "125.50",
      initialBalance: "125.50",
      currency: "BYN",
      order: 2,
    });
    expect(prisma.account.count).toHaveBeenCalledWith({ where: { workspaceId: "workspace-1", archived: false } });
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: "125.50",
          initialBalance: "125.50",
          createdAt: new Date("2026-05-25T12:00:00.000Z"),
          order: 2,
          ownerId: null,
          workspaceId: "workspace-1",
        }),
      })
    );
  });

  it("rejects invalid account initial balance strings", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        name: "Main card",
        initialBalance: "12abc",
        currency: "BYN",
        ownerId: null,
        createdAt: "2026-05-25T12:00:00.000Z",
      })
      .expect(400);

    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("allows duplicate account name and currency on create", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ id: "account-2" }));

    await request(app.getHttpServer())
      .post("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        name: "Main card",
        initialBalance: "125.50",
        currency: "BYN",
        ownerId: null,
        createdAt: "2026-05-25T12:00:00.000Z",
      })
      .expect(201);

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.create).toHaveBeenCalled();
  });

  it("rejects account owners outside the workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        name: "Main card",
        initialBalance: "125.50",
        currency: "BYN",
        ownerId: "user-outside-workspace",
        createdAt: "2026-05-25T12:00:00.000Z",
      })
      .expect(400);

    expect(response.body.message).toBe("Владелец счёта должен быть участником рабочего стола");
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-outside-workspace",
        },
      },
      select: { id: true },
    });
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("lists active accounts with owner details", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/accounts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.accounts).toEqual([
      expect.objectContaining({
        id: "account-1",
        owner: accountOwner,
      }),
    ]);
    expect(prisma.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { archived: false, workspaceId: "workspace-1" },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      })
    );
  });

  it("returns archived accounts with collapsed dependency counts", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findMany.mockResolvedValue([
      createAccountRecord({
        archived: true,
        _count: {
          paymentTransactions: 1,
          outgoingTransfers: 2,
          incomingTransfers: 3,
          debtTransactions: 5,
        },
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/accounts/archived")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.accounts[0]._count).toEqual({
      transactions: 6,
      debtTransactions: 5,
    });
  });

  it("does not update archived accounts", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord({ archived: true }));

    await request(app.getHttpServer())
      .patch("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ name: "Updated card" })
      .expect(404);

    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("rejects invalid account balance updates", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .patch("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ balance: "not-money" })
      .expect(400);

    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("updates initial balance and shifts current balance by the same delta", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(
      createAccountRecord({
        balance: "125.50",
        initialBalance: "100.00",
      })
    );
    prisma.account.update.mockResolvedValue(
      createAccountRecord({
        balance: "175.50",
        initialBalance: "150.00",
      })
    );

    const response = await request(app.getHttpServer())
      .patch("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ initialBalance: "150.00" })
      .expect(200);

    expect(response.body.account).toMatchObject({
      balance: "175.50",
      initialBalance: "150.00",
    });
    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: "175.5",
          initialBalance: "150.00",
        }),
        where: { id: "account-1" },
      })
    );
  });

  it("allows duplicate account name and currency on update", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ id: "account-2" }));

    await request(app.getHttpServer())
      .patch("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ currency: "BYN", name: "Main card" })
      .expect(200);

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: "BYN",
          name: "Main card",
        }),
      })
    );
  });

  it("rejects account owner updates outside the workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .patch("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ ownerId: "user-outside-workspace" })
      .expect(400);

    expect(response.body.message).toBe("Владелец счёта должен быть участником рабочего стола");
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "user-outside-workspace",
        },
      },
      select: { id: true },
    });
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("archives an account idempotently", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord({ archived: true }));

    const response = await request(app.getHttpServer())
      .post("/accounts/account-1/archive")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prisma.account.update).not.toHaveBeenCalled();
  });

  it("unarchives an account at the end of active ordering", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord({ archived: true }));
    prisma.account.count.mockResolvedValue(3);

    const response = await request(app.getHttpServer())
      .post("/accounts/account-1/unarchive")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { archived: false, order: 3 },
      where: { id: "account-1" },
    });
  });

  it("rejects deleting active accounts", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .delete("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(response.body.message).toBe("Можно удалить только архивный счёт");
    expect(prisma.account.delete).not.toHaveBeenCalled();
  });

  it("rejects deleting archived accounts with financial dependencies", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord({ archived: true }));
    prisma.paymentTransaction.count.mockResolvedValue(1);
    prisma.transferTransaction.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    prisma.debtTransaction.count.mockResolvedValue(5);

    const response = await request(app.getHttpServer())
      .delete("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);

    expect(response.body.message).toContain("транзакции (6)");
    expect(response.body.message).toContain("долговые операции (5)");
    expect(prisma.account.delete).not.toHaveBeenCalled();
  });

  it("deletes archived accounts without dependencies", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord({ archived: true }));

    await request(app.getHttpServer())
      .delete("/accounts/account-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: "account-1" } });
  });

  it("updates account order inside the workspace", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .patch("/workspaces/workspace-1/accounts/order")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        accountOrders: [
          { id: "account-2", order: 0 },
          { id: "account-1", order: 1 },
        ],
      })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prisma.account.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      data: { order: 0 },
      where: { archived: false, id: "account-2", workspaceId: "workspace-1" },
    });
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      data: { order: 1 },
      where: { archived: false, id: "account-1", workspaceId: "workspace-1" },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
  });
});
