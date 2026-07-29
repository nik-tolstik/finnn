import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runSerializableTransaction } from "../src/prisma/serializable-transaction";

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
});
