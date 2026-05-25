import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_NAME } from "../src/auth/session-cookie";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { TransactionsModule } from "../src/transactions/transactions.module";

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
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  category: {
    create: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  transferTransaction: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
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
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    category: {
      create: vi.fn(),
    },
    paymentTransaction: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transferTransaction: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    debtTransaction: {
      count: vi.fn(),
      findMany: vi.fn(),
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

function createPaymentTransactionRecord(overrides: Record<string, unknown> = {}) {
  const account = createAccountRecord();

  return {
    id: "payment-1",
    workspaceId: "workspace-1",
    accountId: account.id,
    amount: "25",
    type: "expense",
    description: "Groceries",
    date: new Date("2026-05-26T12:00:00.000Z"),
    categoryId: "category-1",
    createdAt: new Date("2026-05-26T12:01:00.000Z"),
    updatedAt: new Date("2026-05-26T12:02:00.000Z"),
    account,
    category: {
      id: "category-1",
      name: "Groceries",
    },
    ...overrides,
  };
}

function createTransferTransactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    workspaceId: "workspace-1",
    fromAccountId: "account-1",
    toAccountId: "account-2",
    createdById: currentUser.id,
    amount: "30",
    toAmount: "29",
    description: "Move money",
    date: new Date("2026-05-26T13:00:00.000Z"),
    createdAt: new Date("2026-05-26T13:01:00.000Z"),
    updatedAt: new Date("2026-05-26T13:02:00.000Z"),
    fromAccount: createAccountRecord({ id: "account-1", balance: "100" }),
    toAccount: createAccountRecord({ id: "account-2", balance: "10" }),
    createdBy: currentUser,
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
    debt: {
      id: "debt-1",
      workspaceId: "workspace-1",
      type: "lent",
      personName: "Grace",
      amount: "100",
      remainingAmount: "90",
      currency: "BYN",
      accountId: "account-1",
      date: new Date("2026-05-20T12:00:00.000Z"),
      status: "active",
      createdAt: new Date("2026-05-20T12:01:00.000Z"),
      updatedAt: new Date("2026-05-20T12:02:00.000Z"),
    },
    account: createAccountRecord(),
    ...overrides,
  };
}

function mockAuthenticatedSession(prisma: MockPrisma) {
  prisma.authSession.findFirst.mockResolvedValue({ userId: currentUser.id });
  prisma.user.findUnique.mockResolvedValue(currentUser);
}

describe("Transactions API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [TransactionsModule],
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
    prisma.account.findUnique.mockResolvedValue(createAccountRecord());
    prisma.account.update.mockResolvedValue(createAccountRecord());
    prisma.category.create.mockResolvedValue({ id: "category-new" });
    prisma.paymentTransaction.create.mockResolvedValue(createPaymentTransactionRecord());
    prisma.paymentTransaction.findUnique.mockResolvedValue(createPaymentTransactionRecord());
    prisma.paymentTransaction.findMany.mockResolvedValue([createPaymentTransactionRecord()]);
    prisma.paymentTransaction.count.mockResolvedValue(1);
    prisma.paymentTransaction.update.mockResolvedValue(createPaymentTransactionRecord({ amount: "40" }));
    prisma.paymentTransaction.delete.mockResolvedValue({});
    prisma.transferTransaction.create.mockResolvedValue(createTransferTransactionRecord());
    prisma.transferTransaction.findUnique.mockResolvedValue(createTransferTransactionRecord());
    prisma.transferTransaction.findMany.mockResolvedValue([createTransferTransactionRecord()]);
    prisma.transferTransaction.count.mockResolvedValue(1);
    prisma.transferTransaction.update.mockResolvedValue(
      createTransferTransactionRecord({ amount: "40", toAmount: "38" })
    );
    prisma.transferTransaction.delete.mockResolvedValue({});
    prisma.debtTransaction.findMany.mockResolvedValue([createDebtTransactionRecord()]);
    prisma.debtTransaction.count.mockResolvedValue(1);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated combined transaction reads", async () => {
    await request(app.getHttpServer()).get("/workspaces/workspace-1/transactions").expect(401);
  });

  it("denies combined transaction reads outside the workspace", async () => {
    mockAuthenticatedSession(prisma);
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "owner-2" });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get("/workspaces/workspace-1/transactions")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(403);
  });

  it("lists combined transactions with filter pushdown and debt transactions by default", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/transactions")
      .query({
        accountIds: "account-1,account-2",
        transactionTypes: ["expense", "transfer", "debt"],
        take: 10,
      })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.data.map((transaction: { kind: string }) => transaction.kind)).toEqual([
      "debtTransaction",
      "transferTransaction",
      "paymentTransaction",
    ]);
    expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: { in: ["account-1", "account-2"] },
          type: { in: ["expense"] },
          workspaceId: "workspace-1",
        }),
      })
    );
  });

  it("post-filters amount ranges before paginating combined transactions", async () => {
    mockAuthenticatedSession(prisma);
    prisma.paymentTransaction.findMany.mockResolvedValue([
      createPaymentTransactionRecord({ amount: "5" }),
      createPaymentTransactionRecord({ id: "payment-2", amount: "50" }),
    ]);
    prisma.transferTransaction.findMany.mockResolvedValue([
      createTransferTransactionRecord({ amount: "7", toAmount: "8" }),
    ]);
    prisma.debtTransaction.findMany.mockResolvedValue([createDebtTransactionRecord({ amount: "60" })]);

    const response = await request(app.getHttpServer())
      .get("/workspaces/workspace-1/transactions")
      .query({ amountFrom: "40", skip: 0, take: 1 })
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(200);

    expect(response.body.total).toBe(2);
    expect(response.body.data).toHaveLength(1);
    expect(prisma.paymentTransaction.count).not.toHaveBeenCalled();
    expect(prisma.transferTransaction.count).not.toHaveBeenCalled();
    expect(prisma.debtTransaction.count).not.toHaveBeenCalled();
  });

  it("creates payment transactions and applies string-money balance deltas", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/payment-transactions")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        accountId: "account-1",
        amount: "25",
        type: "expense",
        description: "Groceries",
        date: "2026-05-26T12:00:00.000Z",
        newCategory: { name: "Groceries", type: "expense" },
      })
      .expect(201);

    expect(response.body.transaction.amount).toBe("25");
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: "Groceries", type: "expense", workspaceId: "workspace-1" },
    });
    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: "category-new", type: "expense" }),
      })
    );
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "75" },
      where: { id: "account-1" },
    });
  });

  it("rejects payment expenses above account balance", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/payment-transactions")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        accountId: "account-1",
        amount: "125",
        type: "expense",
        date: "2026-05-26T12:00:00.000Z",
      })
      .expect(400);

    expect(response.body.message).toBe("Сумма не может превышать баланс счёта (100)");
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("updates payment transactions for workspace owners without relying on membership rows", async () => {
    mockAuthenticatedSession(prisma);

    const response = await request(app.getHttpServer())
      .patch("/payment-transactions/payment-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        accountId: "account-1",
        amount: "40",
        categoryId: null,
      })
      .expect(200);

    expect(response.body.transaction.amount).toBe("40");
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "85" },
      where: { id: "account-1" },
    });
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: "40",
          category: { disconnect: true },
        }),
      })
    );
  });

  it("creates transfer transactions and applies source and destination deltas", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst
      .mockResolvedValueOnce(createAccountRecord({ id: "account-1", balance: "100" }))
      .mockResolvedValueOnce(createAccountRecord({ id: "account-2", balance: "10" }));

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/transfers")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        fromAccountId: "account-1",
        toAccountId: "account-2",
        amount: "30",
        toAmount: "29",
        description: "Move money",
        date: "2026-05-26T13:00:00.000Z",
      })
      .expect(201);

    expect(response.body.transfer.amount).toBe("30");
    expect(prisma.transferTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: currentUser.id,
          fromAccountId: "account-1",
          toAccountId: "account-2",
        }),
      })
    );
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "70" },
      where: { id: "account-1" },
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "39" },
      where: { id: "account-2" },
    });
  });

  it("rejects transfer transactions to the same account", async () => {
    mockAuthenticatedSession(prisma);
    prisma.account.findFirst.mockResolvedValue(createAccountRecord({ id: "account-1" }));

    const response = await request(app.getHttpServer())
      .post("/workspaces/workspace-1/transfers")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .send({
        fromAccountId: "account-1",
        toAccountId: "account-1",
        amount: "30",
        toAmount: "30",
        date: "2026-05-26T13:00:00.000Z",
      })
      .expect(400);

    expect(response.body.message).toBe("Нельзя перевести на тот же счёт");
    expect(prisma.transferTransaction.create).not.toHaveBeenCalled();
  });

  it("deletes transfers by reversing prior deltas", async () => {
    mockAuthenticatedSession(prisma);
    prisma.transferTransaction.findUnique.mockResolvedValue(
      createTransferTransactionRecord({
        amount: "30",
        toAmount: "29",
        fromAccount: createAccountRecord({ id: "account-1", balance: "70" }),
        toAccount: createAccountRecord({ id: "account-2", balance: "39" }),
      })
    );

    await request(app.getHttpServer())
      .delete("/transfers/transfer-1")
      .set("Cookie", `${AUTH_COOKIE_NAME}=session-token`)
      .expect(204);

    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "100" },
      where: { id: "account-1" },
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { balance: "10" },
      where: { id: "account-2" },
    });
    expect(prisma.transferTransaction.delete).toHaveBeenCalledWith({ where: { id: "transfer-1" } });
  });
});
