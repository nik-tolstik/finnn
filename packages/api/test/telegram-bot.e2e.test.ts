import { BadRequestException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterClient } from "../src/ai-finance/openrouter.client";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { TelegramBotClient } from "../src/telegram-bot/telegram-bot.client";
import { TelegramBotModule } from "../src/telegram-bot/telegram-bot.module";

type MockPrisma = {
  $transaction: ReturnType<typeof vi.fn>;
  authIdentity: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  authSession: { findFirst: ReturnType<typeof vi.fn> };
  workspace: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  workspaceMember: { findUnique: ReturnType<typeof vi.fn> };
  telegramBotPreference: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  aiFinanceDraft: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  account: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  category: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  transferTransaction: {
    create: ReturnType<typeof vi.fn>;
  };
  debt: {
    findMany: ReturnType<typeof vi.fn>;
  };
  exchangeRate: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  const mock = {
    $transaction: vi.fn(),
    authIdentity: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    authSession: { findFirst: vi.fn() },
    workspace: { findMany: vi.fn(), findUnique: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
    telegramBotPreference: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    aiFinanceDraft: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    category: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    transferTransaction: {
      create: vi.fn(),
    },
    debt: {
      findMany: vi.fn(),
    },
    exchangeRate: {
      findMany: vi.fn(),
      upsert: vi.fn(),
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

function createTelegramClientMock() {
  let nextMessageId = 100;

  return {
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    deleteMessage: vi.fn().mockResolvedValue(true),
    downloadFile: vi.fn(),
    downloadFileAsDataUrl: vi.fn(),
    editMessageText: vi.fn().mockResolvedValue({}),
    getFile: vi.fn(),
    sendMessage: vi.fn().mockImplementation(async ({ chatId, text }: { chatId: string; text: string }) => ({
      message_id: nextMessageId++,
      chat: { id: Number(chatId), type: "private" },
      text,
    })),
  };
}

function createOpenRouterMock() {
  return {
    createStructuredCompletion: vi.fn(),
    extractReceiptFromImage: vi.fn(),
    transcribeAudio: vi.fn(),
  };
}

const user = {
  id: "user-1",
  email: "ada@example.com",
  emailVerified: new Date("2026-05-25T00:00:00.000Z"),
  name: "Ada",
  image: null,
};

const workspace = {
  id: "workspace-1",
  name: "Home",
  slug: "home",
  baseCurrency: "BYN",
  ownerId: "user-1",
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  updatedAt: new Date("2026-05-20T00:00:00.000Z"),
};

const account = {
  id: "account-1",
  workspaceId: "workspace-1",
  ownerId: "user-1",
  name: "Main card",
  balance: "100",
  currency: "BYN",
  description: null,
  color: null,
  icon: null,
  archived: false,
  order: 0,
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  updatedAt: new Date("2026-05-20T00:00:00.000Z"),
};

const savingsAccount = {
  ...account,
  id: "account-2",
  name: "Savings",
  balance: "10",
};

const cashAccount = {
  ...account,
  id: "account-3",
  name: "Cash",
  balance: "200",
};

const usdCardAccount = {
  ...account,
  id: "account-4",
  name: "BSB Card Usd",
  balance: "500",
  currency: "USD",
};

const bynCardAccount = {
  ...account,
  id: "account-5",
  name: "BSB Bank",
  balance: "100",
  currency: "BYN",
};

const category = {
  id: "category-1",
  workspaceId: "workspace-1",
  name: "Питание",
  type: "expense",
  icon: null,
  order: 0,
  createdAt: new Date("2026-05-20T00:00:00.000Z"),
  updatedAt: new Date("2026-05-20T00:00:00.000Z"),
};

const fuelCategory = {
  ...category,
  id: "category-2",
  name: "Машина",
};

const giftCategory = {
  ...category,
  id: "category-3",
  name: "Подарки",
};

describe("Telegram Bot API", () => {
  let app: INestApplication;
  let prisma: MockPrisma;
  let telegram: ReturnType<typeof createTelegramClientMock>;
  let openRouter: ReturnType<typeof createOpenRouterMock>;

  beforeAll(async () => {
    prisma = createPrismaMock();
    telegram = createTelegramClientMock();
    openRouter = createOpenRouterMock();

    const moduleRef = await Test.createTestingModule({
      imports: [TelegramBotModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TelegramBotClient)
      .useValue(telegram)
      .overrideProvider(OpenRouterClient)
      .useValue(openRouter)
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_COOKIE_SAME_SITE: "lax",
      API_COOKIE_SECURE: "false",
      TELEGRAM_BOT_WEBHOOK_SECRET: "secret",
    } as NodeJS.ProcessEnv);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_WEBHOOK_SECRET = "secret";
    delete process.env.WEB_APP_URL;

    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return input(prisma);
      }

      return Promise.all(input as Array<Promise<unknown>>);
    });
    prisma.authIdentity.findUnique.mockResolvedValue({ id: "identity-1", userId: user.id, user });
    prisma.workspace.findMany.mockResolvedValue([workspace]);
    prisma.workspace.findUnique.mockResolvedValue(workspace);
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    prisma.telegramBotPreference.findUnique.mockResolvedValue(null);
    prisma.telegramBotPreference.create.mockResolvedValue({
      id: "preference-1",
      userId: user.id,
      telegramChatId: "1001",
      activeWorkspaceId: null,
      defaultAccountByWorkspace: null,
      receiptMode: "category",
      timezone: "Europe/Minsk",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.account.findMany.mockResolvedValue([account]);
    prisma.account.findFirst.mockResolvedValue(account);
    prisma.account.findUnique.mockResolvedValue(account);
    prisma.account.update.mockResolvedValue({ ...account, balance: "88" });
    prisma.category.findMany.mockResolvedValue([category, fuelCategory, giftCategory]);
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.paymentTransaction.findMany.mockResolvedValue([]);
    prisma.debt.findMany.mockResolvedValue([]);
    prisma.exchangeRate.findMany.mockResolvedValue([]);
    prisma.exchangeRate.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create);
    prisma.aiFinanceDraft.updateMany.mockResolvedValue({ count: 1 });
    prisma.paymentTransaction.create.mockResolvedValue({
      id: "payment-1",
      workspaceId: workspace.id,
      accountId: account.id,
      amount: "12",
      type: "expense",
      description: "Coffee",
      date: new Date("2026-06-18T12:00:00.000Z"),
      categoryId: category.id,
      createdByAi: true,
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z"),
      account,
      category,
    });
    prisma.transferTransaction.create.mockResolvedValue({
      id: "transfer-1",
      workspaceId: workspace.id,
      fromAccountId: account.id,
      toAccountId: savingsAccount.id,
      createdById: user.id,
      amount: "20",
      toAmount: "20",
      description: "Move money",
      date: new Date("2026-06-18T12:00:00.000Z"),
      createdByAi: true,
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z"),
      fromAccount: account,
      toAccount: savingsAccount,
      createdBy: user,
    });
    openRouter.createStructuredCompletion.mockResolvedValue(
      JSON.stringify({
        kind: "payment",
        paymentType: "expense",
        amount: "12",
        toAmount: null,
        totalAmount: null,
        currency: "BYN",
        description: "Coffee",
        merchant: null,
        dateText: "today",
        accountHint: "Main",
        fromAccountHint: null,
        toAccountHint: null,
        categoryHint: "Питание",
        reason: null,
        payments: [],
        items: [],
        confidence: 0.92,
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects webhook requests with an invalid secret", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "wrong")
      .send({ update_id: 1 })
      .expect(401);
  });

  it("sends linking guidance for unknown Telegram users", async () => {
    prisma.authIdentity.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 1,
        message: {
          message_id: 10,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "/start",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Telegram ещё не подключен"),
      })
    );
  });

  it("does not send a Telegram web app button for local HTTP web URLs", async () => {
    process.env.WEB_APP_URL = "http://localhost:3000";
    prisma.authIdentity.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 8,
        message: {
          message_id: 15,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "/start",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        replyMarkup: undefined,
        text: expect.stringContaining("Telegram ещё не подключен"),
      })
    );
  });

  it("handles /start for linked Telegram users", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 2,
        message: {
          message_id: 11,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "/start",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Finnn готов"),
      })
    );
  });

  it("ignores messages from non-private Telegram chats", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 22,
        message: {
          message_id: 29,
          from: { id: 42, first_name: "Ada" },
          chat: { id: -1001, type: "group" },
          text: "Coffee 12 BYN from Main card",
        },
      })
      .expect(200);

    expect(prisma.authIdentity.findUnique).not.toHaveBeenCalled();
    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("acknowledges callbacks from non-private Telegram chats without exposing draft data", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 23,
        callback_query: {
          id: "callback-group-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 30, chat: { id: -1001, type: "group" } },
          data: "ai:confirm:draft-1",
        },
      })
      .expect(200);

    expect(telegram.answerCallbackQuery).toHaveBeenCalledWith("callback-group-1", undefined);
    expect(prisma.authIdentity.findUnique).not.toHaveBeenCalled();
    expect(telegram.editMessageText).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });

  it("answers category catalog questions without creating a draft", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 19,
        message: {
          message_id: 26,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "какие категории доступны",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ text: "Думаю..." }));
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Категории расходов:"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Питание"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Машина"),
      })
    );
  });

  it("answers account balance questions without creating a draft", async () => {
    prisma.account.findMany.mockResolvedValue([account, usdCardAccount]);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 30,
        message: {
          message_id: 36,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Какой баланс по счетам",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ text: "Думаю..." }));
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Счета:"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Main card: 100.00 Br"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- BSB Card Usd: 500.00$"),
      })
    );
  });

  it("answers open debt questions without creating a draft", async () => {
    prisma.debt.findMany.mockResolvedValue([
      {
        id: "debt-1",
        workspaceId: workspace.id,
        type: "borrowed",
        personName: "Маша",
        amount: "120",
        remainingAmount: "80",
        currency: "BYN",
        date: new Date("2026-06-01T10:00:00.000Z"),
        status: "open",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      },
      {
        id: "debt-2",
        workspaceId: workspace.id,
        type: "lent",
        personName: "Игорь",
        amount: "50",
        remainingAmount: "50",
        currency: "USD",
        date: new Date("2026-06-02T10:00:00.000Z"),
        status: "open",
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        updatedAt: new Date("2026-06-02T10:00:00.000Z"),
      },
    ]);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 31,
        message: {
          message_id: 37,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Какие долги открыты?",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ text: "Думаю..." }));
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Открытые долги:"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Маша: 80.00 Br (я должен)"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Игорь: 50.00$ (мне должны)"),
      })
    );
  });

  it("answers today's spending questions without creating a draft", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-18T16:30:00.000Z"));
    prisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "payment-today-1",
        workspaceId: workspace.id,
        accountId: account.id,
        amount: "12.50",
        type: "expense",
        description: "Lunch",
        date: new Date("2026-06-18T10:00:00.000Z"),
        categoryId: category.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { currency: "BYN" },
      },
      {
        id: "payment-today-2",
        workspaceId: workspace.id,
        accountId: account.id,
        amount: "3.25",
        type: "expense",
        description: "Coffee",
        date: new Date("2026-06-18T11:00:00.000Z"),
        categoryId: category.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: { currency: "BYN" },
      },
    ]);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 27,
        message: {
          message_id: 34,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Сколько за сегодня я потратил денег",
        },
      })
      .expect(200);

    expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: workspace.id,
          type: "expense",
          date: {
            gte: new Date("2026-06-17T21:00:00.000Z"),
            lt: new Date("2026-06-18T21:00:00.000Z"),
          },
        }),
      })
    );
    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Сегодня в Home потрачено: 15.75 Br.",
      })
    );
  });

  it("does not create a draft when AI returns an unknown text intent", async () => {
    openRouter.createStructuredCompletion.mockResolvedValue(
      JSON.stringify({
        kind: "unknown",
        paymentType: null,
        amount: null,
        toAmount: null,
        totalAmount: null,
        currency: null,
        description: null,
        merchant: null,
        dateText: null,
        accountHint: null,
        fromAccountHint: null,
        toAccountHint: null,
        categoryHint: null,
        reason: "Question, not a transaction",
        payments: [],
        items: [],
        confidence: 0.4,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 32,
        message: {
          message_id: 38,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Что там с финансами?",
        },
      })
      .expect(200);

    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Я не понял, какую операцию создать"),
      })
    );
    expect(telegram.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Я собрал черновик"),
      })
    );
  });

  it("does not create a draft or expose technical errors when AI extraction is invalid", async () => {
    openRouter.createStructuredCompletion.mockResolvedValue(JSON.stringify({ kind: "payment" }));

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 33,
        message: {
          message_id: 39,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "непонятно что",
        },
      })
      .expect(200);

    expect(prisma.aiFinanceDraft.create).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Я не понял, какую операцию создать"),
      })
    );
    expect(telegram.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("AI finance extraction is invalid"),
      })
    );
  });

  it("normalizes Telegram photo octet-stream downloads to image data URLs", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { file_id: "photo-1", file_path: "photos/file_1.jpg" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(new TelegramBotClient().downloadFileAsDataUrl("photo-1")).resolves.toBe(
        "data:image/jpeg;base64,AQID"
      );
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });

  it("passes photo captions to receipt image extraction", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-receipt-caption-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    telegram.downloadFileAsDataUrl.mockResolvedValue("data:image/jpeg;base64,receipt");
    openRouter.extractReceiptFromImage.mockResolvedValue(
      JSON.stringify({
        kind: "receipt",
        merchant: "Мама Дома",
        totalAmount: "15.23",
        currency: "BYN",
        dateText: "today",
        accountHint: "Main card",
        items: [{ name: "Блины", amount: "15.23", categoryHint: "Питание", confidence: 0.9 }],
        confidence: 0.91,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 20,
        message: {
          message_id: 27,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          caption: "по карте",
          photo: [
            { file_id: "small-photo", width: 320, height: 320 },
            { file_id: "large-photo", width: 1280, height: 1280 },
          ],
        },
      })
      .expect(200);

    expect(telegram.downloadFileAsDataUrl).toHaveBeenCalledWith("large-photo");
    expect(openRouter.extractReceiptFromImage).toHaveBeenCalledWith(
      "data:image/jpeg;base64,receipt",
      expect.stringContaining("User note/caption: по карте"),
      expect.any(Object)
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Я собрал черновик"),
      })
    );
  });

  it("returns a chat message instead of failing webhook when receipt image extraction fails", async () => {
    telegram.downloadFileAsDataUrl.mockResolvedValue("data:image/jpeg;base64,receipt");
    openRouter.extractReceiptFromImage.mockRejectedValue(new BadRequestException("OpenRouter extraction failed"));

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 21,
        message: {
          message_id: 28,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          caption: "по карте",
          photo: [{ file_id: "receipt-photo", width: 1280, height: 1280 }],
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Думаю...",
      })
    );
    expect(telegram.deleteMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: "1001" }));
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Не получилось разобрать сообщение: OpenRouter extraction failed",
      })
    );
  });

  it("creates and confirms a text expense draft", async () => {
    let storedDraft: (Record<string, unknown> & { payload?: { entries?: Array<{ date: string | null }> } }) | null =
      null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.findUnique.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    const createResponse = await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 3,
        message: {
          message_id: 12,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Coffee 12 BYN from Main card",
        },
      });
    expect(createResponse.status).toBe(200);

    expect(openRouter.createStructuredCompletion).toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Думаю...",
      })
    );
    expect(telegram.deleteMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: "1001" }));
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        replyMarkup: undefined,
        text: expect.stringContaining("Я собрал черновик"),
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 4,
        callback_query: {
          id: "callback-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 12, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-1",
        },
      })
      .expect(200);

    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          amount: "12",
          categoryId: "category-1",
          createdByAi: true,
          type: "expense",
        }),
      })
    );
    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "committed" }),
        where: { id: "draft-1" },
      })
    );
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Готово. Создано записей: 1.",
      })
    );
  });

  it("uses the current time for text draft dates when no explicit time is provided", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-18T14:37:45.000Z"));

    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-current-time-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 26,
        message: {
          message_id: 33,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Coffee 12 BYN from Main card",
        },
      })
      .expect(200);

    const createdDraft = storedDraft as { payload?: { entries?: Array<{ date: string | null }> } } | null;
    expect(createdDraft?.payload?.entries?.[0]?.date).toBe("2026-06-18T14:37:45.000Z");
  });

  it("calculates account-currency expense amounts from before-after balance text", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.account.findMany.mockResolvedValue([bynCardAccount]);
    prisma.account.findFirst.mockResolvedValue(bynCardAccount);
    prisma.aiFinanceDraft.findFirst.mockResolvedValue(null);
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-balance-difference-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 34,
        message: {
          message_id: 40,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Мне списало с белоруской карты 2 USD, это 60.44-55.34 рублей",
        },
      })
      .expect(200);

    const createdDraft = storedDraft as {
      payload?: {
        entries?: Array<{ accountId: string | null; amount: string; currency: string; description: string }>;
      };
    } | null;
    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(createdDraft?.payload?.entries?.[0]).toEqual(
      expect.objectContaining({
        accountId: bynCardAccount.id,
        amount: "5.10",
        currency: "BYN",
        description: "Списание по разнице остатков (2 USD)",
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("[BSB Bank] Expense: 5.10 BYN"),
      })
    );
  });

  it("accepts account clarification phrases with a selecting prefix", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-account-prefix-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Мне списало 5.10 рублей",
      receiptMode: "category",
      kind: "payment",
      status: "pending",
      currentQuestion: "account",
      missingFields: ["account"],
      confidence: 0.86,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "5.10",
          currency: "BYN",
          description: "Списание",
          merchant: null,
          dateText: null,
          accountHint: null,
          categoryHint: null,
          confidence: 0.86,
        },
        workspaceName: "Home",
        accountName: null,
        accountCurrency: null,
        entries: [
          {
            accountId: null,
            accountName: null,
            categoryId: null,
            categoryName: null,
            amount: "5.10",
            currency: "BYN",
            type: "expense",
            description: "Списание",
            date: null,
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.account.findMany.mockResolvedValue([account, bynCardAccount]);
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 35,
        message: {
          message_id: 41,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Выбираю BSB Bank",
        },
      })
      .expect(200);

    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentQuestion: null,
          payload: expect.objectContaining({
            accountName: "BSB Bank",
            entries: expect.arrayContaining([
              expect.objectContaining({
                accountId: bynCardAccount.id,
                accountName: "BSB Bank",
                amount: "5.10",
              }),
            ]),
          }),
        }),
        where: { id: "draft-account-prefix-1" },
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("[BSB Bank] Expense: 5.10 BYN"),
      })
    );
  });

  it("converts a foreign-currency text expense to the account currency before commit", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-usd-to-byn-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.findUnique.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.exchangeRate.findMany.mockResolvedValue([
      {
        date: new Date("2026-06-18T00:00:00.000Z"),
        fromCurrency: "USD",
        toCurrency: "BYN",
        rate: 3.25,
      },
    ]);
    openRouter.createStructuredCompletion.mockResolvedValueOnce(
      JSON.stringify({
        kind: "unknown",
        paymentType: null,
        amount: null,
        toAmount: null,
        totalAmount: null,
        currency: null,
        description: null,
        merchant: null,
        dateText: null,
        accountHint: null,
        fromAccountHint: null,
        toAccountHint: null,
        categoryHint: null,
        reason: "Could not parse",
        payments: [],
        items: [],
        confidence: 0.2,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 24,
        message: {
          message_id: 31,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Потратить 2 доллара с белорусской карты",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("1. [Main card] Expense: 6.50 BYN из 2 USD"),
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 25,
        callback_query: {
          id: "callback-usd-to-byn-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 31, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-usd-to-byn-1",
        },
      })
      .expect(200);

    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          amount: "6.50",
          createdByAi: true,
          type: "expense",
        }),
      })
    );
  });

  it("creates a preview with multiple payment entries from one text message", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-multi-payments-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.account.findMany.mockResolvedValue([account, cashAccount]);
    openRouter.createStructuredCompletion.mockResolvedValue(
      JSON.stringify({
        kind: "payments",
        paymentType: null,
        amount: null,
        toAmount: null,
        totalAmount: null,
        currency: null,
        description: null,
        merchant: null,
        dateText: null,
        accountHint: null,
        fromAccountHint: null,
        toAccountHint: null,
        categoryHint: null,
        reason: null,
        items: [],
        payments: [
          {
            paymentType: "expense",
            amount: "15.23",
            currency: "BYN",
            description: "Блины в Мама Дома",
            merchant: "Мама Дома",
            dateText: "today",
            accountHint: "card",
            categoryHint: "Питание",
            confidence: 0.92,
          },
          {
            paymentType: "expense",
            amount: "100",
            currency: "BYN",
            description: "Заправил машину",
            merchant: null,
            dateText: "today",
            accountHint: "cash",
            categoryHint: "Машина",
            confidence: 0.9,
          },
        ],
        confidence: 0.91,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 11,
        message: {
          message_id: 18,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Блины в Мама Дома за 15.23 рублей по карте\nЗаправил машину на 100 рублей наличными",
        },
      })
      .expect(200);

    const extractionMessages = openRouter.createStructuredCompletion.mock.calls.at(-1)?.[0] as Array<{
      content: string;
    }>;
    expect(extractionMessages.some((message) => message.content.includes("- Питание (expense)"))).toBe(true);
    expect(extractionMessages.some((message) => message.content.includes("- Машина (expense)"))).toBe(true);
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("1. [Main card] Expense: Питание: 15.23 BYN (Блины в Мама Дома)"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("2. [Cash] Expense: Машина: 100 BYN (Заправил машину)"),
      })
    );
  });

  it("falls back to simple multiline Russian payments when AI returns unknown", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-russian-fallback-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    openRouter.createStructuredCompletion.mockResolvedValueOnce(
      JSON.stringify({
        kind: "unknown",
        paymentType: null,
        amount: null,
        toAmount: null,
        totalAmount: null,
        currency: null,
        description: null,
        merchant: null,
        dateText: null,
        accountHint: null,
        fromAccountHint: null,
        toAccountHint: null,
        categoryHint: null,
        reason: "Could not parse",
        payments: [],
        items: [],
        confidence: 0.2,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 18,
        message: {
          message_id: 25,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Блины в Мама Дома за 15.23 рублей\nЗаправил машину на 100 рублей\nКупил ноутбук за 3000 рублей",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        replyMarkup: undefined,
        text: expect.stringContaining("1. [Main card] Expense: Питание: 15.23 BYN (Блины в Мама Дома)"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("2. [Main card] Expense: Машина: 100 BYN (машину)"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("3. [Main card] Expense: Подарки: 3000 BYN (ноутбук)"),
      })
    );
  });

  it("updates a category in the active ready draft from a plain text instruction", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-edit-category-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Блины, заправка и ноутбук",
      receiptMode: "category",
      kind: "payments",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payments",
          dateText: null,
          payments: [],
          confidence: 0.92,
        },
        workspaceName: "test",
        accountName: "BSB Bank",
        accountCurrency: "BYN",
        entries: [
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: category.id,
            categoryName: category.name,
            amount: "15.23",
            currency: "BYN",
            type: "expense",
            description: "Блины",
            date: "2026-06-18T12:00:00.000Z",
          },
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: fuelCategory.id,
            categoryName: fuelCategory.name,
            amount: "100",
            currency: "BYN",
            type: "expense",
            description: "Заправил машину",
            date: "2026-06-18T12:00:00.000Z",
          },
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: null,
            categoryName: null,
            amount: "3000",
            currency: "BYN",
            type: "expense",
            description: "Купил ноутбук",
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    openRouter.createStructuredCompletion.mockResolvedValueOnce(
      JSON.stringify({
        action: "update_entry",
        targetText: "Купил ноутбук",
        entryIndex: null,
        categoryName: "Подарки",
        accountName: null,
        dateText: null,
        amount: null,
        description: null,
        receiptMode: null,
        question: null,
        createText: null,
        confidence: 0.94,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 13,
        message: {
          message_id: 20,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Ноутбук в подарки",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({
                categoryId: giftCategory.id,
                categoryName: giftCategory.name,
                description: "Купил ноутбук",
              }),
            ]),
          }),
        }),
        where: { id: "draft-edit-category-1" },
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("3. [BSB Bank] Expense: Подарки: 3000 BYN (Купил ноутбук)"),
      })
    );
  });

  it("removes a single matching entry from an active ready draft by amount", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-delete-entry-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "voice",
      sourceText: "Списали 2 доллара и пришло 2 рубля",
      receiptMode: "category",
      kind: "payments",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payments",
          dateText: null,
          payments: [],
          confidence: 0.92,
        },
        workspaceName: "test",
        accountName: "BSB Bank",
        accountCurrency: "BYN",
        entries: [
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: category.id,
            categoryName: category.name,
            amount: "5.52",
            currency: "BYN",
            originalAmount: "2",
            originalCurrency: "USD",
            exchangeRate: "2.76",
            type: "expense",
            description: null,
            date: "2026-06-18T12:00:00.000Z",
          },
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: null,
            categoryName: null,
            amount: "2",
            currency: "BYN",
            type: "income",
            description: null,
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 25,
        message: {
          message_id: 32,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "убери 2 рубля транзакцию",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            entries: [
              expect.objectContaining({
                amount: "5.52",
                originalAmount: "2",
                originalCurrency: "USD",
                type: "expense",
              }),
            ],
          }),
        }),
        where: { id: "draft-delete-entry-1" },
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Total: 5.52 BYN"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.not.stringContaining("Income: 2 BYN"),
      })
    );
  });

  it("commits an active ready draft from a text confirmation", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-text-confirm-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Coffee 12 BYN",
      receiptMode: "category",
      kind: "payment",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "12",
          currency: "BYN",
          description: "Coffee",
          merchant: null,
          dateText: "today",
          accountHint: "Main",
          categoryHint: "Питание",
          confidence: 0.92,
        },
        entries: [
          {
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            amount: "12",
            currency: "BYN",
            type: "expense",
            description: "Coffee",
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 14,
        message: {
          message_id: 21,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "отлично",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.create).toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Готово. Создано записей: 1.",
      })
    );
  });

  it("cancels an active draft from text", async () => {
    const storedDraft = {
      id: "draft-text-cancel-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      status: "ready",
      currentQuestion: null,
      expiresAt: new Date(Date.now() + 60000),
      payload: {
        extraction: {
          kind: "unknown",
          reason: "test",
          confidence: 0.5,
        },
      },
    };
    prisma.aiFinanceDraft.findFirst.mockResolvedValue(storedDraft);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 15,
        message: {
          message_id: 22,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "отмена",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "cancelled" }),
        where: { id: "draft-text-cancel-1" },
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Черновик отменён.",
      })
    );
  });

  it("updates an entry account from a conversation action", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-edit-account-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Заправил машину",
      receiptMode: "category",
      kind: "payment",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "100",
          currency: "BYN",
          description: "Заправил машину",
          merchant: null,
          dateText: "today",
          accountHint: "Main",
          categoryHint: "Машина",
          confidence: 0.92,
        },
        workspaceName: "test",
        accountName: "BSB Bank",
        accountCurrency: "BYN",
        entries: [
          {
            accountId: account.id,
            accountName: "BSB Bank",
            categoryId: fuelCategory.id,
            categoryName: fuelCategory.name,
            amount: "100",
            currency: "BYN",
            type: "expense",
            description: "Заправил машину",
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.account.findMany.mockResolvedValue([account, cashAccount]);
    openRouter.createStructuredCompletion.mockResolvedValueOnce(
      JSON.stringify({
        action: "update_entry",
        targetText: "Заправил машину",
        entryIndex: null,
        categoryName: null,
        accountName: "Cash",
        dateText: null,
        amount: null,
        description: null,
        receiptMode: null,
        question: null,
        createText: null,
        confidence: 0.93,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 16,
        message: {
          message_id: 23,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Заправку наличными",
        },
      })
      .expect(200);

    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({
                accountId: cashAccount.id,
                accountName: cashAccount.name,
                description: "Заправил машину",
              }),
            ]),
          }),
        }),
        where: { id: "draft-edit-account-1" },
      })
    );
  });

  it("updates all entry dates from a conversation action without a specific target", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-edit-date-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Блины и заправка",
      receiptMode: "category",
      kind: "payments",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payments",
          dateText: null,
          payments: [],
          confidence: 0.92,
        },
        entries: [
          {
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            amount: "15.23",
            currency: "BYN",
            type: "expense",
            description: "Блины",
            date: "2026-06-18T12:00:00.000Z",
          },
          {
            accountId: account.id,
            accountName: account.name,
            categoryId: fuelCategory.id,
            categoryName: fuelCategory.name,
            amount: "100",
            currency: "BYN",
            type: "expense",
            description: "Заправил машину",
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    openRouter.createStructuredCompletion.mockResolvedValueOnce(
      JSON.stringify({
        action: "update_entry",
        targetText: null,
        entryIndex: null,
        categoryName: null,
        accountName: null,
        dateText: "вчера",
        amount: null,
        description: null,
        receiptMode: null,
        question: null,
        createText: null,
        confidence: 0.93,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 17,
        message: {
          message_id: 24,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Это было вчера",
        },
      })
      .expect(200);

    const updateCall = prisma.aiFinanceDraft.update.mock.calls.at(-1)?.[0] as {
      data?: { payload?: { entries?: Array<{ date: string }> } };
    };
    expect(updateCall.data?.payload?.entries?.every((entry) => entry.date.includes("2026-06-17"))).toBe(true);
  });

  it("does not repeat the date prompt when the user says the date is on the screenshot", async () => {
    const storedDraft = {
      id: "draft-receipt-missing-date-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "receipt",
      sourceText: "по карте",
      receiptMode: "category",
      kind: "payments",
      status: "pending",
      currentQuestion: "date",
      missingFields: ["date"],
      confidence: 0.82,
      payload: {
        extraction: {
          kind: "payments",
          dateText: null,
          payments: [
            {
              paymentType: "expense",
              amount: "15.23",
              currency: "BYN",
              description: "Блины",
              merchant: null,
              dateText: null,
              accountHint: "Main",
              categoryHint: "Питание",
              confidence: 0.82,
            },
          ],
          confidence: 0.82,
        },
        workspaceName: workspace.name,
        accountName: account.name,
        accountCurrency: account.currency,
        entries: [
          {
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            amount: "15.23",
            currency: "BYN",
            type: "expense",
            description: "Блины",
            date: null,
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockResolvedValue(storedDraft);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 22,
        message: {
          message_id: 29,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "на скриншоте есть даты и время транзакций",
        },
      })
      .expect(200);

    expect(prisma.aiFinanceDraft.update).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Я не смог прочитать дату со скриншота. Напишите дату текстом, например `сегодня`, `вчера` или `2026-06-18`.",
      })
    );
  });

  it("edits the callback message even when Telegram callback acknowledgement is expired", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-expired-callback-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Coffee 8 BYN",
      receiptMode: "category",
      kind: "payment",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "8",
          currency: "BYN",
          description: "Coffee",
          merchant: null,
          dateText: "today",
          accountHint: "Main",
          categoryHint: "Питание",
          confidence: 0.92,
        },
        entries: [
          {
            accountId: account.id,
            amount: "8",
            type: "expense",
            description: "Coffee",
            date: "2026-06-18T12:00:00.000Z",
            categoryId: category.id,
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    telegram.answerCallbackQuery.mockRejectedValueOnce(
      new BadRequestException("Telegram Bot API request failed: Bad Request: query is too old")
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 10,
        callback_query: {
          id: "callback-expired-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 17, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-expired-callback-1",
        },
      })
      .expect(200);

    expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          amount: "8",
          createdByAi: true,
          type: "expense",
        }),
      })
    );
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        messageId: 17,
        text: "Готово. Создано записей: 1.",
      })
    );
  });

  it("handles malformed callback data without failing the webhook", async () => {
    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 24,
        callback_query: {
          id: "callback-malformed-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 31, chat: { id: 1001, type: "private" } },
          data: "not-ai-data",
        },
      })
      .expect(200);

    expect(telegram.answerCallbackQuery).toHaveBeenCalledWith("callback-malformed-1", undefined);
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        messageId: 31,
        text: "Не получилось создать операцию: Unknown Telegram callback",
      })
    );
  });

  it("does not create duplicate transactions for an already committed callback draft", async () => {
    prisma.aiFinanceDraft.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.aiFinanceDraft.findFirst.mockResolvedValue({
      id: "draft-already-committed-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Coffee 8 BYN",
      receiptMode: "category",
      kind: "payment",
      status: "committed",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "8",
          currency: "BYN",
          description: "Coffee",
          merchant: null,
          dateText: "today",
          accountHint: "Main",
          categoryHint: "Питание",
          confidence: 0.92,
        },
        createdPaymentTransactionIds: ["payment-existing-1"],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 25,
        callback_query: {
          id: "callback-already-committed-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 32, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-already-committed-1",
        },
      })
      .expect(200);

    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        messageId: 32,
        text: "Готово. Создано записей: 1.",
      })
    );
  });

  it("asks users without workspaces to create one in Finnn", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.workspace.findMany.mockResolvedValue([]);
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-no-workspace-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 7,
        message: {
          message_id: 14,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Coffee 12 BYN",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        replyMarkup: expect.objectContaining({
          inline_keyboard: [[expect.objectContaining({ text: "Open Finnn" })]],
        }),
        text: "Сначала создайте рабочий стол в Finnn, затем вернитесь в бот и отправьте операцию ещё раз.",
      })
    );
    expect(storedDraft).toMatchObject({
      currentQuestion: "workspace",
      missingFields: expect.arrayContaining(["workspace"]),
      status: "pending",
    });
  });

  it("shows commit errors when Create fails", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-failed-commit-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Coffee 8 BYN yesterday",
      receiptMode: "category",
      kind: "payment",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "8",
          currency: "BYN",
          description: "Coffee",
          merchant: null,
          dateText: "yesterday",
          accountHint: "Main",
          categoryHint: "Питание",
          confidence: 0.92,
        },
        entries: [
          {
            accountId: account.id,
            amount: "8",
            type: "expense",
            description: "Coffee",
            date: "2026-06-17T12:00:00.000Z",
            categoryId: category.id,
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.paymentTransaction.create.mockRejectedValue(
      new BadRequestException("Сумма не может превышать баланс счёта (5)")
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 9,
        callback_query: {
          id: "callback-failed-commit-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 16, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-failed-commit-1",
        },
      })
      .expect(200);

    expect(telegram.answerCallbackQuery).toHaveBeenCalledWith("callback-failed-commit-1", undefined);
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        messageId: 16,
        text: "Не получилось создать операцию: Сумма не может превышать баланс счёта (5)",
      })
    );
    expect(prisma.aiFinanceDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
        where: { id: "draft-failed-commit-1" },
      })
    );
  });

  it("ignores Telegram message-not-modified errors when a mode callback keeps the same preview", async () => {
    let storedDraft: Record<string, unknown> | null = {
      id: "draft-not-modified-1",
      userId: user.id,
      telegramChatId: "1001",
      workspaceId: workspace.id,
      sourceType: "text",
      sourceText: "Coffee 8 BYN",
      receiptMode: "category",
      kind: "payment",
      status: "ready",
      currentQuestion: null,
      missingFields: [],
      confidence: 0.92,
      payload: {
        extraction: {
          kind: "payment",
          paymentType: "expense",
          amount: "8",
          currency: "BYN",
          description: "Coffee",
          merchant: null,
          dateText: "today",
          accountHint: "Main",
          categoryHint: "Питание",
          confidence: 0.92,
        },
        entries: [
          {
            accountId: account.id,
            accountName: account.name,
            categoryId: category.id,
            categoryName: category.name,
            amount: "8",
            currency: "BYN",
            type: "expense",
            description: "Coffee",
            date: "2026-06-18T12:00:00.000Z",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      committedAt: null,
    };
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    telegram.editMessageText.mockRejectedValueOnce(
      new BadRequestException(
        "Telegram Bot API request failed: Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message"
      )
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 12,
        callback_query: {
          id: "callback-not-modified-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 19, chat: { id: 1001, type: "private" } },
          data: "ai:mode-category:draft-not-modified-1",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Не получилось создать операцию"),
      })
    );
  });

  it("creates and confirms a text transfer draft", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-transfer-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.findUnique.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.account.findMany.mockResolvedValue([account, savingsAccount]);
    prisma.account.findFirst.mockResolvedValueOnce(account).mockResolvedValueOnce(savingsAccount);
    openRouter.createStructuredCompletion.mockResolvedValue(
      JSON.stringify({
        kind: "transfer",
        amount: "20",
        toAmount: "20",
        fromAccountHint: "Main",
        toAccountHint: "Savings",
        dateText: "today",
        description: "Move money",
        confidence: 0.9,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 5,
        message: {
          message_id: 13,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Move 20 BYN from Main to Savings",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Перевод:"),
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 6,
        callback_query: {
          id: "callback-transfer-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 13, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-transfer-1",
        },
      })
      .expect(200);

    expect(prisma.transferTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: "20",
          createdByAi: true,
          fromAccountId: "account-1",
          toAccountId: "account-2",
        }),
      })
    );
    expect(telegram.editMessageText).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: "Готово. Перевод создан.",
      })
    );
  });

  it("uses currency hints when transfer accounts have the same name", async () => {
    const bynBsbCardAccount = {
      ...bynCardAccount,
      id: "account-6",
      name: "BSB Card",
      balance: "53.36",
      currency: "BYN",
    };
    const usdBsbCardAccount = {
      ...usdCardAccount,
      id: "account-7",
      name: "BSB Card",
      balance: "100",
      currency: "USD",
    };
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-same-name-currency-transfer-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.findUnique.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.account.findMany.mockResolvedValue([bynBsbCardAccount, usdBsbCardAccount]);
    prisma.account.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === bynBsbCardAccount.id) return bynBsbCardAccount;
      if (where.id === usdBsbCardAccount.id) return usdBsbCardAccount;
      return null;
    });
    openRouter.createStructuredCompletion.mockResolvedValue(
      JSON.stringify({
        kind: "transfer",
        paymentType: null,
        amount: "70.77",
        toAmount: "200",
        totalAmount: null,
        currency: null,
        description: "Перевод с bsb card usd на bsb card byn",
        merchant: null,
        dateText: "today",
        accountHint: null,
        fromAccountHint: "bsb card usd",
        toAccountHint: "bsb card byn",
        categoryHint: null,
        reason: null,
        payments: [],
        items: [],
        confidence: 0.92,
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 30,
        message: {
          message_id: 36,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Перевод с bsb card usd на bsb card byn. 70.77$ => 200 byn",
        },
      })
      .expect(200);

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- From: BSB Card (USD)"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- To: BSB Card (BYN)"),
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 31,
        message: {
          message_id: 37,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "отлично",
        },
      })
      .expect(200);

    expect(prisma.transferTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: "70.77",
          createdByAi: true,
          fromAccountId: "account-7",
          toAccountId: "account-6",
          toAmount: "200",
        }),
      })
    );
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("treats currency exchange between own cards as a transfer", async () => {
    let storedDraft: Record<string, unknown> | null = null;
    prisma.aiFinanceDraft.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = {
        id: "draft-currency-exchange-transfer-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        committedAt: null,
        ...data,
      };
      return storedDraft;
    });
    prisma.aiFinanceDraft.findFirst.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.findUnique.mockImplementation(async () => storedDraft);
    prisma.aiFinanceDraft.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedDraft = { ...storedDraft, ...data, updatedAt: new Date() };
      return storedDraft;
    });
    prisma.account.findMany.mockResolvedValue([usdCardAccount, bynCardAccount]);
    prisma.account.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === usdCardAccount.id) return usdCardAccount;
      if (where.id === bynCardAccount.id) return bynCardAccount;
      return null;
    });

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 28,
        message: {
          message_id: 35,
          from: { id: 42, first_name: "Ada" },
          chat: { id: 1001, type: "private" },
          text: "Я поменял с долларовой карты 300 долларов и получил 1000 рублей на белорусскую карту.",
        },
      })
      .expect(200);

    expect(openRouter.createStructuredCompletion).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("Перевод:"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- From: BSB Card Usd"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- To: BSB Bank"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Amount: 300"),
      })
    );
    expect(telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "1001",
        text: expect.stringContaining("- Destination amount: 1000"),
      })
    );

    await request(app.getHttpServer())
      .post("/telegram/webhook")
      .set("x-telegram-bot-api-secret-token", "secret")
      .send({
        update_id: 29,
        callback_query: {
          id: "callback-currency-exchange-transfer-1",
          from: { id: 42, first_name: "Ada" },
          message: { message_id: 35, chat: { id: 1001, type: "private" } },
          data: "ai:confirm:draft-currency-exchange-transfer-1",
        },
      })
      .expect(200);

    expect(prisma.transferTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: "300",
          createdByAi: true,
          fromAccountId: "account-4",
          toAccountId: "account-5",
          toAmount: "1000",
        }),
      })
    );
    expect(prisma.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
