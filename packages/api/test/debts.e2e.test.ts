import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { DebtsModule } from "../src/debts/debts.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  user: { findUnique: ReturnType<typeof vi.fn> };
  authSession: { findFirst: ReturnType<typeof vi.fn> };
  workspace: { findUnique: ReturnType<typeof vi.fn> };
  workspaceMember: { findUnique: ReturnType<typeof vi.fn> };
  account: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  category: { findFirst: ReturnType<typeof vi.fn> };
  paymentTransaction: { create: ReturnType<typeof vi.fn> };
  debt: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  const mock = {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    authSession: { findFirst: vi.fn() },
    workspace: { findUnique: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    category: { findFirst: vi.fn() },
    paymentTransaction: { create: vi.fn() },
    debt: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    debtTransaction: {
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  mock.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return input(mock);
    }

    return Promise.all(input as Array<Promise<unknown>>);
  });

  return mock;
}

const currentUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

const owner = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  image: null,
};

function createAccountRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    workspaceId: "workspace-1",
    ownerId: "user-1",
    name: "Main card",
    balance: "100",
    currency: "BYN",
    description: null,
    color: "#0f766e",
    icon: "wallet",
    archived: false,
    order: 0,
    createdAt: new Date("2026-05-25T00:00:00.000Z"),
    updatedAt: new Date("2026-05-25T12:30:00.000Z"),
    owner,
    ...overrides,
  };
}

function createDebtRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-1",
    workspaceId: "workspace-1",
    type: "lent",
    personName: "Grace",
    amount: "100",
    remainingAmount: "90",
    currency: "BYN",
    accountId: "account-1",
    date: new Date("2026-05-20T12:00:00.000Z"),
    status: "open",
    createdAt: new Date("2026-05-20T12:01:00.000Z"),
    updatedAt: new Date("2026-05-20T12:02:00.000Z"),
    account: createAccountRecord(),
    ...overrides,
  };
}

function createDebtTransactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "debt-transaction-1",
    workspaceId: "workspace-1",
    debtId: "debt-1",
    accountId: "account-1",
    type: "closed",
    amount: "10",
    toAmount: null,
    date: new Date("2026-05-26T14:00:00.000Z"),
    createdAt: new Date("2026-05-26T14:01:00.000Z"),
    debt: createDebtRecord(),
    account: createAccountRecord(),
    ...overrides,
  };
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockResolvedValue(currentUser);
}

describe("Debts API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [DebtsModule],
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
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(prisma);
      }

      return Promise.all(input as Array<Promise<unknown>>);
    });
    prisma.authSession.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: currentUser.id });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord());
    prisma.account.findMany.mockResolvedValue([createAccountRecord()]);
    prisma.account.findUnique.mockResolvedValue(createAccountRecord());
    prisma.account.update.mockResolvedValue(createAccountRecord());
    prisma.category.findFirst.mockResolvedValue({ id: "category-1", workspaceId: "workspace-1", type: "income" });
    prisma.paymentTransaction.create.mockResolvedValue({});
    prisma.debt.findMany.mockResolvedValue([createDebtRecord()]);
    prisma.debt.count.mockResolvedValue(1);
    prisma.debt.findUnique.mockResolvedValue(createDebtRecord());
    prisma.debt.create.mockResolvedValue(createDebtRecord({ amount: "40", remainingAmount: "40" }));
    prisma.debt.update.mockResolvedValue(createDebtRecord({ amount: "120", remainingAmount: "110" }));
    prisma.debt.delete.mockResolvedValue({});
    prisma.debtTransaction.findFirst.mockResolvedValue(createDebtTransactionRecord({ type: "created", amount: "100" }));
    prisma.debtTransaction.findMany.mockResolvedValue([
      { accountId: "account-1", type: "created", amount: "100", toAmount: null },
      { accountId: "account-1", type: "closed", amount: "10", toAmount: null },
    ]);
    prisma.debtTransaction.findUnique.mockResolvedValue(createDebtTransactionRecord());
    prisma.debtTransaction.create.mockResolvedValue(createDebtTransactionRecord());
    prisma.debtTransaction.update.mockResolvedValue(createDebtTransactionRecord({ amount: "20" }));
    prisma.debtTransaction.delete.mockResolvedValue({});
    prisma.debtTransaction.deleteMany.mockResolvedValue({ count: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated debt reads", async () => {
    await request(app.getHttpServer()).get("/workspaces/workspace-1/debts").expect(401);
  });

  it("denies debt reads outside the workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2" });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/debts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);
  });

  it("lists debts with filters and stable response shape", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/debts")
      .query({ status: "open", type: "lent", personName: "Gra" })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: "debt-1",
      amount: "100",
      date: "2026-05-20T12:00:00.000Z",
    });
    expect(prisma.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: "asc" }, { date: "desc" }],
        where: {
          personName: { contains: "Gra", mode: "insensitive" },
          status: "open",
          type: "lent",
          workspaceId: "workspace-1",
        },
      })
    );
  });

  it("creates account-backed debts and records the initial debt transaction", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ balance: "100", currency: "USD" }));

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/debts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        type: "lent",
        personName: "Grace",
        amount: "40",
        toAmount: "12",
        currency: "BYN",
        date: "2026-05-26T12:00:00.000Z",
        useAccount: true,
        accountId: "account-1",
      })
      .expect(201);

    expect(response.body.debt.amount).toBe("40");
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "88" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: "40", toAmount: "12", type: "created" }),
      })
    );
  });

  it("rejects debt creation without the required debt currency", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/debts")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        type: "lent",
        personName: "Grace",
        amount: "40",
        date: "2026-05-26T12:00:00.000Z",
        useAccount: false,
      })
      .expect(400);

    expect(response.body.message).toContain("currency must be a string");
    expect(prisma.debt.create).not.toHaveBeenCalled();
  });

  it("closes a same-currency lent debt with overpayment category handling", async () => {
    mockAuthenticatedSession(prisma);
    prisma.debt.update.mockResolvedValue(createDebtRecord({ remainingAmount: "0", status: "closed" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/close")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        amount: "90",
        paymentAmount: "95",
        categoryId: "category-1",
        closeEarly: false,
        accountId: "account-1",
        useAccount: true,
      })
      .expect(200);

    expect(response.body.debt.status).toBe("closed");
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: "5",
        description: "Закрытие долга: Grace",
        type: "income",
      }),
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "195" },
      where: { id: "account-1" },
    });
  });

  it("rejects cross-currency debt closing without an outgoing amount", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ currency: "USD" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/close")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        amount: "30",
        accountId: "account-1",
        useAccount: true,
      })
      .expect(400);

    expect(response.body.message).toBe("Укажите сумму отправления");
    expect(prisma.debtTransaction.create).not.toHaveBeenCalled();
  });

  it("adds to open debts and applies selected account balance deltas", async () => {
    mockAuthenticatedSession(prisma);
    prisma.debt.update.mockResolvedValue(createDebtRecord({ amount: "120", remainingAmount: "110" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/add")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ amount: "20", useAccount: true, accountId: "account-1" })
      .expect(200);

    expect(response.body.debt.amount).toBe("120");
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "80" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: "20", type: "added" }),
      })
    );
  });

  it("adds to open debts without an account", async () => {
    mockAuthenticatedSession(prisma);
    prisma.debt.update.mockResolvedValue(createDebtRecord({ amount: "120", remainingAmount: "110" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/add")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ amount: "20", useAccount: false })
      .expect(200);

    expect(response.body.debt.amount).toBe("120");
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: null, amount: "20", type: "added" }),
      })
    );
  });

  it("adds to a debt with a cross-currency account-side amount", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ currency: "USD" }));
    prisma.debt.update.mockResolvedValue(createDebtRecord({ amount: "120", remainingAmount: "110" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/add")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ amount: "20", toAmount: "6", useAccount: true, accountId: "account-1" })
      .expect(200);

    expect(response.body.debt.amount).toBe("120");
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "94" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: "20", toAmount: "6", type: "added" }),
      })
    );
  });

  it("rejects adding to a debt with a cross-currency account without an account-side amount", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ currency: "USD" }));

    const response = await request(app.getHttpServer())
      .post("/debts/debt-1/add")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({ amount: "20", useAccount: true, accountId: "account-1" })
      .expect(400);

    expect(response.body.message).toBe("Укажите сумму в валюте счёта");
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.debtTransaction.create).not.toHaveBeenCalled();
  });

  it("returns edit data from the created transaction and falls back to debt fields", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/debts/debt-1/edit-data")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.debt).toMatchObject({
      initialAmount: "100",
      initialDate: "2026-05-26T14:00:00.000Z",
      personName: "Grace",
    });

    prisma.debtTransaction.findFirst.mockResolvedValueOnce(null);

    const fallbackResponse = await request(app.getHttpServer())
      .get("/debts/debt-1/edit-data")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(fallbackResponse.body.debt.initialDate).toBe("2026-05-20T12:00:00.000Z");
  });

  it("updates debt initial amounts and rejects values below the paid amount", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .patch("/debts/debt-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        personName: "Grace Hopper",
        amount: "120",
        date: "2026-05-27T12:00:00.000Z",
      })
      .expect(200);

    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "80" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: "120" }),
      })
    );

    prisma.debt.findUnique.mockResolvedValueOnce(createDebtRecord({ remainingAmount: "20" }));

    const response = await request(app.getHttpServer())
      .patch("/debts/debt-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        personName: "Grace Hopper",
        amount: "10",
        date: "2026-05-27T12:00:00.000Z",
      })
      .expect(400);

    expect(response.body.message).toContain("Новая изначальная сумма не может быть меньше");
  });

  it("updates closed debt transactions and reconciles old and new balance effects", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findMany.mockResolvedValue([createAccountRecord({ balance: "100" })]);

    const response = await request(app.getHttpServer())
      .patch("/debt-transactions/debt-transaction-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        amount: "20",
        accountId: "account-1",
        date: "2026-05-27T12:00:00.000Z",
      })
      .expect(200);

    expect(response.body.debtTransaction.amount).toBe("20");
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "110" },
      where: { id: "account-1" },
    });
    expect(prisma.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ remainingAmount: "80" }),
      })
    );
  });

  it("rejects direct edits and deletes of created debt transactions", async () => {
    mockAuthenticatedSession(prisma);
    prisma.debtTransaction.findUnique.mockResolvedValue(createDebtTransactionRecord({ type: "created" }));

    await request(app.getHttpServer())
      .patch("/debt-transactions/debt-transaction-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        amount: "20",
        date: "2026-05-27T12:00:00.000Z",
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete("/debt-transactions/debt-transaction-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(400);
  });

  it("deletes debt transactions and debts with account balance rollback", async () => {
    mockAuthenticatedSession(prisma);

    await request(app.getHttpServer())
      .delete("/debt-transactions/debt-transaction-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "90" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.delete).toHaveBeenCalledWith({ where: { id: "debt-transaction-1" } });

    vi.clearAllMocks();
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: currentUser.id });
    prisma.debt.findUnique.mockResolvedValue(createDebtRecord());
    prisma.debtTransaction.findMany.mockResolvedValue([
      { accountId: "account-1", type: "created", amount: "100", toAmount: null },
      { accountId: "account-1", type: "closed", amount: "10", toAmount: null },
    ]);
    prisma.account.findMany.mockResolvedValue([createAccountRecord({ balance: "90" })]);

    await request(app.getHttpServer())
      .delete("/debts/debt-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "180" },
      where: { id: "account-1" },
    });
    expect(prisma.debtTransaction.deleteMany).toHaveBeenCalledWith({ where: { debtId: "debt-1" } });
    expect(prisma.debt.delete).toHaveBeenCalledWith({ where: { id: "debt-1" } });
  });
});
