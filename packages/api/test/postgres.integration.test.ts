import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountsService } from "../src/accounts/accounts.service";
import { AiFinanceCommitService } from "../src/ai-finance/ai-finance-commit.service";
import { AiFinanceDraftService } from "../src/ai-finance/ai-finance-draft.service";
import { AiFinancePreferenceService } from "../src/ai-finance/ai-finance-preference.service";
import { AuthService } from "../src/auth/auth.service";
import { CategoriesService } from "../src/categories/categories.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { runSerializableTransaction } from "../src/prisma/serializable-transaction";
import { ScheduledPaymentsService } from "../src/scheduled-payments/scheduled-payments.service";
import { ScheduledPaymentsScheduleService } from "../src/scheduled-payments/scheduled-payments-schedule.service";
import { TransactionsService } from "../src/transactions/transactions.service";
import { WorkspaceService } from "../src/workspace/workspace.service";

function getTestDatabaseUrl(): string | null {
  const value = process.env.POSTGRES_TEST_DATABASE_URL?.trim();
  if (!value) return null;

  const parsed = new URL(value);
  const databaseName = parsed.pathname.slice(1);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  if (!isLocalHost || !databaseName.endsWith("_test")) {
    throw new Error("POSTGRES_TEST_DATABASE_URL must target a local database whose name ends with _test");
  }

  return value;
}

const testDatabaseUrl = getTestDatabaseUrl();
const describeWithPostgres = testDatabaseUrl ? describe : describe.skip;

describeWithPostgres("PostgreSQL persistence", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error("POSTGRES_TEST_DATABASE_URL is required");
    prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "scheduled_payment_reminder_deliveries",
        "scheduled_payment_records",
        "scheduled_payments",
        "ai_finance_drafts",
        "telegram_bot_preferences",
        "debt_transactions",
        "debts",
        "exchange_rates",
        "pending_registrations",
        "workspace_invites",
        "transfers",
        "transactions",
        "categories",
        "category_icon_assets",
        "hidden_accounts",
        "accounts",
        "workspace_members",
        "workspaces",
        "auth_sessions",
        "password_reset_codes",
        "pending_email_verifications",
        "auth_identities",
        "users"
      CASCADE
    `);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("allows multiple users without email and rejects duplicate real emails", async () => {
    await prisma.user.createMany({
      data: [
        { id: "user-null-1", email: null },
        { id: "user-null-2", email: null },
        { id: "user-email-1", email: "ada@example.com" },
      ],
    });

    await expect(prisma.user.create({ data: { id: "user-email-2", email: "ada@example.com" } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("cascades workspace-owned data without deleting the owner", async () => {
    await prisma.user.create({ data: { id: "owner-1" } });
    await prisma.workspace.create({
      data: { id: "workspace-1", name: "Personal", ownerId: "owner-1", slug: "personal" },
    });
    await prisma.workspaceMember.create({
      data: { id: "member-1", userId: "owner-1", workspaceId: "workspace-1" },
    });
    await prisma.account.create({
      data: { id: "account-1", name: "Cash", workspaceId: "workspace-1" },
    });
    await prisma.category.create({
      data: { id: "category-1", name: "Food", type: "expense", workspaceId: "workspace-1" },
    });
    await prisma.paymentTransaction.create({
      data: {
        id: "transaction-1",
        accountId: "account-1",
        amount: "10",
        categoryId: "category-1",
        type: "expense",
        workspaceId: "workspace-1",
      },
    });

    await prisma.workspace.delete({ where: { id: "workspace-1" } });

    await expect(prisma.user.count({ where: { id: "owner-1" } })).resolves.toBe(1);
    await expect(prisma.account.count({ where: { workspaceId: "workspace-1" } })).resolves.toBe(0);
    await expect(prisma.paymentTransaction.count({ where: { workspaceId: "workspace-1" } })).resolves.toBe(0);
  });

  it("round-trips JSON, scalar arrays, and timezone-aware timestamps", async () => {
    const expiresAt = new Date("2026-07-29T12:34:56.789Z");
    await prisma.user.create({ data: { id: "user-1" } });
    await prisma.workspace.create({
      data: { id: "workspace-1", name: "Personal", ownerId: "user-1", slug: "personal" },
    });

    await prisma.aiFinanceDraft.create({
      data: {
        id: "draft-1",
        expiresAt,
        missingFields: ["amount", "accountId"],
        payload: { amount: "12.50", nested: { source: "telegram" } },
        sourceType: "text",
        userId: "user-1",
        workspaceId: "workspace-1",
      },
    });

    const draft = await prisma.aiFinanceDraft.findUniqueOrThrow({ where: { id: "draft-1" } });
    expect(draft.expiresAt.toISOString()).toBe(expiresAt.toISOString());
    expect(draft.missingFields).toEqual(["amount", "accountId"]);
    expect(draft.payload).toEqual({ amount: "12.50", nested: { source: "telegram" } });
  });

  it("retries concurrent balance changes instead of losing an update", async () => {
    await prisma.user.create({ data: { id: "owner-1" } });
    await prisma.workspace.create({
      data: { id: "workspace-1", name: "Personal", ownerId: "owner-1", slug: "personal" },
    });
    await prisma.account.create({
      data: { id: "account-1", balance: "100", initialBalance: "100", name: "Cash", workspaceId: "workspace-1" },
    });

    let initialReads = 0;
    let releaseInitialReads: (() => void) | undefined;
    const initialReadsCompleted = new Promise<void>((resolve) => {
      releaseInitialReads = resolve;
    });

    const subtractTen = () =>
      runSerializableTransaction(
        prisma,
        async (transaction) => {
          const account = await transaction.account.findUniqueOrThrow({ where: { id: "account-1" } });

          if (initialReads < 2) {
            initialReads += 1;
            if (initialReads === 2) releaseInitialReads?.();
            await initialReadsCompleted;
          }

          await transaction.account.update({
            where: { id: account.id },
            data: { balance: String(Number(account.balance) - 10) },
          });
        },
        { retryDelayMs: 0 }
      );

    await Promise.all([subtractTen(), subtractTen()]);

    const account = await prisma.account.findUniqueOrThrow({ where: { id: "account-1" } });
    expect(account.balance).toBe("80");
  });

  it("creates one financial transaction for one scheduled-payment occurrence under concurrency", async () => {
    const user = {
      id: "owner-scheduled",
      email: "scheduled@example.com",
      emailVerified: new Date("2026-07-01T00:00:00.000Z"),
      name: "Scheduled Owner",
      image: null,
    };
    const dueAt = new Date("2026-08-31T09:00:00.000Z");
    await prisma.user.create({ data: user });
    await prisma.workspace.create({
      data: { id: "workspace-scheduled", name: "Scheduled", ownerId: user.id, slug: "scheduled" },
    });
    await prisma.account.create({
      data: {
        id: "account-scheduled",
        balance: "100",
        initialBalance: "100",
        name: "Cash",
        workspaceId: "workspace-scheduled",
      },
    });
    await prisma.category.create({
      data: {
        id: "category-scheduled",
        name: "Bills",
        type: "expense",
        workspaceId: "workspace-scheduled",
      },
    });
    await prisma.scheduledPayment.create({
      data: {
        id: "scheduled-payment-1",
        workspaceId: "workspace-scheduled",
        name: "Internet",
        amountMode: "fixed",
        amount: "45",
        currency: "BYN",
        categoryId: "category-scheduled",
        accountId: "account-scheduled",
        createdById: user.id,
        scheduleKind: "monthly",
        dueDay: 31,
        nextDueAt: dueAt,
        reminderDaysBefore: [],
      },
    });

    const prismaService = prisma as unknown as PrismaService;
    const transactions = new TransactionsService(prismaService);
    const scheduledPayments = new ScheduledPaymentsService(
      prismaService,
      transactions,
      new ScheduledPaymentsScheduleService()
    );
    const currentUser = { ...user, emailVerified: user.emailVerified.toISOString() };
    const pay = () =>
      scheduledPayments.markPaid(
        "workspace-scheduled",
        "scheduled-payment-1",
        {
          amount: "45",
          createTransaction: true,
          dueAt,
          paidAt: new Date("2026-08-31T10:00:00.000Z"),
        },
        currentUser
      );

    const results = await Promise.allSettled([pay(), pay()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.paymentTransaction.count({ where: { workspaceId: "workspace-scheduled" } })).resolves.toBe(1);
    await expect(
      prisma.scheduledPaymentRecord.count({ where: { scheduledPaymentId: "scheduled-payment-1" } })
    ).resolves.toBe(1);
    await expect(prisma.account.findUniqueOrThrow({ where: { id: "account-scheduled" } })).resolves.toMatchObject({
      balance: "55",
    });
  });

  it("rolls back a scheduled financial transaction when the occurrence record cannot be created", async () => {
    const user = {
      id: "owner-scheduled-rollback",
      email: "scheduled-rollback@example.com",
      emailVerified: new Date("2026-07-01T00:00:00.000Z"),
      name: "Scheduled Rollback Owner",
      image: null,
    };
    const dueAt = new Date("2026-08-31T09:00:00.000Z");
    await prisma.user.create({ data: user });
    await prisma.workspace.create({
      data: { id: "workspace-scheduled-rollback", name: "Scheduled", ownerId: user.id, slug: "scheduled-rollback" },
    });
    await prisma.account.create({
      data: {
        id: "account-scheduled-rollback",
        balance: "100",
        initialBalance: "100",
        name: "Cash",
        workspaceId: "workspace-scheduled-rollback",
      },
    });
    await prisma.scheduledPayment.create({
      data: {
        id: "scheduled-payment-rollback",
        workspaceId: "workspace-scheduled-rollback",
        name: "Internet",
        amountMode: "fixed",
        amount: "45",
        currency: "BYN",
        accountId: "account-scheduled-rollback",
        createdById: user.id,
        scheduleKind: "monthly",
        dueDay: 31,
        nextDueAt: dueAt,
        reminderDaysBefore: [],
      },
    });
    await prisma.scheduledPaymentRecord.create({
      data: {
        id: "scheduled-record-existing",
        scheduledPaymentId: "scheduled-payment-rollback",
        workspaceId: "workspace-scheduled-rollback",
        dueAt,
        actionById: user.id,
        status: "skipped",
      },
    });

    const prismaService = prisma as unknown as PrismaService;
    const scheduledPayments = new ScheduledPaymentsService(
      prismaService,
      new TransactionsService(prismaService),
      new ScheduledPaymentsScheduleService()
    );

    await expect(
      scheduledPayments.markPaid(
        "workspace-scheduled-rollback",
        "scheduled-payment-rollback",
        {
          amount: "45",
          createTransaction: true,
          dueAt,
          paidAt: new Date("2026-08-31T10:00:00.000Z"),
        },
        { ...user, emailVerified: user.emailVerified.toISOString() }
      )
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.paymentTransaction.count({ where: { workspaceId: "workspace-scheduled-rollback" } })
    ).resolves.toBe(0);
    await expect(
      prisma.account.findUniqueOrThrow({ where: { id: "account-scheduled-rollback" } })
    ).resolves.toMatchObject({ balance: "100" });
  });

  it("rolls back AI-created finance rows when the draft cannot be marked committed", async () => {
    const user = {
      id: "owner-ai-rollback",
      email: "ai-rollback@example.com",
      emailVerified: new Date("2026-07-01T00:00:00.000Z"),
      name: "AI Rollback Owner",
      image: null,
    };
    await prisma.user.create({ data: user });
    await prisma.workspace.create({
      data: { id: "workspace-ai-rollback", name: "AI", ownerId: user.id, slug: "ai-rollback" },
    });
    await prisma.account.create({
      data: {
        id: "account-ai-rollback",
        balance: "100",
        initialBalance: "100",
        name: "Cash",
        workspaceId: "workspace-ai-rollback",
      },
    });
    await prisma.aiFinanceDraft.create({
      data: {
        id: "draft-ai-rollback",
        userId: user.id,
        workspaceId: "workspace-ai-rollback",
        status: "ready",
        sourceType: "text",
        payload: {
          entries: [
            {
              accountId: "account-ai-rollback",
              amount: "12",
              type: "expense",
              date: "2026-08-01T12:00:00.000Z",
            },
          ],
        },
        missingFields: [],
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      },
    });

    const prismaService = prisma as unknown as PrismaService;
    const drafts = new AiFinanceDraftService(prismaService);
    vi.spyOn(drafts, "markCommitted").mockRejectedValueOnce(new Error("Draft status write failed"));
    const commit = new AiFinanceCommitService(drafts, new TransactionsService(prismaService), prismaService);

    await expect(
      commit.commitDraft("draft-ai-rollback", { ...user, emailVerified: user.emailVerified.toISOString() })
    ).rejects.toThrow("Draft status write failed");

    await expect(prisma.paymentTransaction.count({ where: { workspaceId: "workspace-ai-rollback" } })).resolves.toBe(0);
    await expect(prisma.account.findUniqueOrThrow({ where: { id: "account-ai-rollback" } })).resolves.toMatchObject({
      balance: "100",
    });
    await expect(
      prisma.aiFinanceDraft.findUniqueOrThrow({ where: { id: "draft-ai-rollback" } })
    ).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("consumes a registration token exactly once under concurrency", async () => {
    await prisma.pendingRegistration.create({
      data: {
        id: "pending-registration-concurrent",
        name: "Concurrent User",
        email: "registration-concurrent@example.com",
        password: "password-hash",
        token: "registration-token-concurrent",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      },
    });

    const auth = new AuthService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const verify = () => auth.verifyEmail("registration-token-concurrent");
    const results = await Promise.allSettled([verify(), verify()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.user.count({ where: { email: "registration-concurrent@example.com" } })).resolves.toBe(1);
    await expect(prisma.pendingRegistration.count({ where: { token: "registration-token-concurrent" } })).resolves.toBe(
      0
    );
  });

  it("keeps one login method when Google and Telegram unlink requests race", async () => {
    await prisma.user.create({ data: { id: "user-unlink-concurrent", name: "Concurrent User" } });
    await prisma.authIdentity.createMany({
      data: [
        {
          id: "identity-google-concurrent",
          userId: "user-unlink-concurrent",
          provider: "google",
          providerUserId: "google-concurrent",
        },
        {
          id: "identity-telegram-concurrent",
          userId: "user-unlink-concurrent",
          provider: "telegram",
          providerUserId: "telegram-concurrent",
        },
      ],
    });

    const auth = new AuthService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const results = await Promise.allSettled([
      auth.unlinkGoogle("user-unlink-concurrent"),
      auth.unlinkTelegram("user-unlink-concurrent"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(prisma.authIdentity.count({ where: { userId: "user-unlink-concurrent" } })).resolves.toBe(1);
  });

  it("accepts a workspace invitation exactly once under concurrency", async () => {
    await prisma.user.createMany({
      data: [
        { id: "workspace-owner-concurrent", email: "workspace-owner@example.com", emailVerified: new Date() },
        { id: "workspace-member-concurrent", email: "workspace-member@example.com", emailVerified: new Date() },
      ],
    });
    await prisma.workspace.create({
      data: {
        id: "workspace-invite-concurrent",
        name: "Invite Concurrent",
        ownerId: "workspace-owner-concurrent",
        slug: "invite-concurrent",
      },
    });
    await prisma.workspaceInvite.create({
      data: {
        id: "workspace-invite-token-concurrent",
        workspaceId: "workspace-invite-concurrent",
        email: "workspace-member@example.com",
        token: "workspace-token-concurrent",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      },
    });

    const workspace = new WorkspaceService(prisma as unknown as PrismaService, {} as never);
    const currentUser = {
      id: "workspace-member-concurrent",
      email: "workspace-member@example.com",
      emailVerified: new Date().toISOString(),
      name: "Member",
      image: null,
    };
    const accept = () => workspace.acceptInvite("workspace-token-concurrent", currentUser);
    const results = await Promise.allSettled([accept(), accept()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(
      prisma.workspaceMember.count({
        where: { workspaceId: "workspace-invite-concurrent", userId: "workspace-member-concurrent" },
      })
    ).resolves.toBe(1);
    await expect(prisma.workspaceInvite.count({ where: { token: "workspace-token-concurrent" } })).resolves.toBe(0);
  });

  it("assigns deterministic account and category order values under concurrent creates", async () => {
    const user = {
      id: "owner-order-concurrent",
      email: "order-concurrent@example.com",
      emailVerified: new Date("2026-07-01T00:00:00.000Z"),
      name: "Order Owner",
      image: null,
    };
    await prisma.user.create({ data: user });
    await prisma.workspace.create({
      data: { id: "workspace-order-concurrent", name: "Order", ownerId: user.id, slug: "order-concurrent" },
    });

    const prismaService = prisma as unknown as PrismaService;
    const currentUser = { ...user, emailVerified: user.emailVerified.toISOString() };
    const accounts = new AccountsService(prismaService);
    const categories = new CategoriesService(prismaService, {} as never);

    await Promise.all([
      accounts.createAccount(
        "workspace-order-concurrent",
        { name: "First", initialBalance: "0", currency: "BYN", createdAt: new Date("2026-07-01T00:00:00.000Z") },
        currentUser
      ),
      accounts.createAccount(
        "workspace-order-concurrent",
        { name: "Second", initialBalance: "0", currency: "BYN", createdAt: new Date("2026-07-01T00:00:00.000Z") },
        currentUser
      ),
      categories.createCategory(
        "workspace-order-concurrent",
        { name: "Food", type: "expense", icon: "🍽️" },
        currentUser
      ),
      categories.createCategory(
        "workspace-order-concurrent",
        { name: "Home", type: "expense", icon: "🏠" },
        currentUser
      ),
    ]);

    const createdAccounts = await prisma.account.findMany({
      where: { workspaceId: "workspace-order-concurrent" },
      orderBy: { order: "asc" },
    });
    const createdCategories = await prisma.category.findMany({
      where: { workspaceId: "workspace-order-concurrent", type: "expense" },
      orderBy: { order: "asc" },
    });
    expect(createdAccounts.map((account) => account.order)).toEqual([0, 1]);
    expect(createdCategories.map((category) => category.order)).toEqual([0, 1]);
  });

  it("preserves JSONB default accounts when two workspace preferences update concurrently", async () => {
    await prisma.user.create({ data: { id: "user-preference-concurrent" } });
    await prisma.workspace.createMany({
      data: [
        {
          id: "workspace-preference-a",
          name: "Preference A",
          ownerId: "user-preference-concurrent",
          slug: "preference-a",
        },
        {
          id: "workspace-preference-b",
          name: "Preference B",
          ownerId: "user-preference-concurrent",
          slug: "preference-b",
        },
      ],
    });
    await prisma.telegramBotPreference.create({
      data: { userId: "user-preference-concurrent", defaultAccountByWorkspace: {} },
    });

    const preferences = new AiFinancePreferenceService(prisma as unknown as PrismaService);
    await Promise.all([
      preferences.setDefaultAccount("user-preference-concurrent", "workspace-preference-a", "account-preference-a"),
      preferences.setDefaultAccount("user-preference-concurrent", "workspace-preference-b", "account-preference-b"),
    ]);

    const preference = await prisma.telegramBotPreference.findUniqueOrThrow({
      where: { userId: "user-preference-concurrent" },
    });
    expect(preference.defaultAccountByWorkspace).toEqual({
      "workspace-preference-a": "account-preference-a",
      "workspace-preference-b": "account-preference-b",
    });
  });
});
