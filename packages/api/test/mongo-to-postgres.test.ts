import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  assertProductionMigrationAllowed,
  getMigrationUrls,
  getStableDigest,
  isDiscardableOrphanAuthSession,
  isProductionEnvironment,
  parseMongoToPostgresArgs,
} from "../scripts/mongo-to-postgres";
import {
  canonicalRecord,
  getUniqueKey,
  MIGRATION_MODELS,
  toLegacyId,
  transformMongoDocument,
  validateFinancialInvariants,
} from "../scripts/mongo-to-postgres-models";

describe("MongoDB to PostgreSQL migration CLI", () => {
  it("uses safe defaults and parses explicit migration controls", () => {
    expect(parseMongoToPostgresArgs(["node", "mongo-to-postgres.ts"])).toEqual({
      allowProduction: false,
      batchSize: 1000,
      dryRun: false,
      useSnapshot: true,
    });

    expect(
      parseMongoToPostgresArgs([
        "node",
        "mongo-to-postgres.ts",
        "--dry-run",
        "--batch-size=250",
        "--no-snapshot",
        "--allow-production",
      ])
    ).toEqual({
      allowProduction: true,
      batchSize: 250,
      dryRun: true,
      useSnapshot: false,
    });
  });

  it("rejects unknown arguments and unsafe batch sizes", () => {
    expect(() => parseMongoToPostgresArgs(["node", "script", "--batch-size=0"])).toThrow(
      "--batch-size must be an integer between 1 and 10000"
    );
    expect(() => parseMongoToPostgresArgs(["node", "script", "--resume"])).toThrow("Unknown argument: --resume");
  });

  it("requires source MongoDB and target PostgreSQL URLs without exposing them", () => {
    expect(
      getMigrationUrls({
        DATABASE_URL: "postgresql://target.example/finnn",
        MONGODB_SOURCE_URL: "mongodb+srv://source.example/finnn",
      })
    ).toEqual({
      sourceUrl: "mongodb+srv://source.example/finnn",
      targetUrl: "postgresql://target.example/finnn",
    });

    expect(() =>
      getMigrationUrls({ DATABASE_URL: "mongodb://wrong-target/finnn", MONGODB_SOURCE_URL: "mongodb://source/finnn" })
    ).toThrow("DATABASE_URL must use postgres:// or postgresql://");
    expect(() => getMigrationUrls({ DATABASE_URL: "postgresql://target/finnn" })).toThrow(
      "MONGODB_SOURCE_URL must be provided"
    );
  });

  it("blocks recognized production environments unless explicitly allowed", () => {
    expect(isProductionEnvironment({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: "development" })).toBe(false);
    expect(() => assertProductionMigrationAllowed({ allowProduction: false }, { NODE_ENV: "production" })).toThrow(
      "without --allow-production"
    );
    expect(() => assertProductionMigrationAllowed({ allowProduction: true }, { NODE_ENV: "production" })).not.toThrow();
  });

  it("skips only expired or revoked orphan authentication sessions", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");

    expect(isDiscardableOrphanAuthSession({ expiresAt: new Date("2026-07-29T11:59:59.000Z") }, now)).toBe(true);
    expect(
      isDiscardableOrphanAuthSession(
        { expiresAt: new Date("2026-07-30T12:00:00.000Z"), revokedAt: new Date("2026-07-29T10:00:00.000Z") },
        now
      )
    ).toBe(true);
    expect(isDiscardableOrphanAuthSession({ expiresAt: new Date("2026-07-30T12:00:00.000Z") }, now)).toBe(false);
  });
});

describe("MongoDB to PostgreSQL transformations", () => {
  const account = MIGRATION_MODELS.find((spec) => spec.model === "Account");
  const draft = MIGRATION_MODELS.find((spec) => spec.model === "AiFinanceDraft");

  if (!account || !draft) throw new Error("Expected migration model definitions are missing.");

  it("preserves ObjectIds as strings and applies deterministic target defaults", () => {
    const accountId = new ObjectId("507f1f77bcf86cd799439011");
    const workspaceId = new ObjectId("507f1f77bcf86cd799439012");
    const createdAt = new Date("2026-07-29T10:15:30.000Z");
    const updatedAt = new Date("2026-07-29T11:15:30.000Z");

    const result = transformMongoDocument(account, {
      _id: accountId,
      createdAt,
      name: "Cash",
      updatedAt,
      workspaceId,
    });

    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({
      archived: false,
      balance: "0",
      color: null,
      createdAt,
      currency: "USD",
      description: null,
      icon: null,
      id: "507f1f77bcf86cd799439011",
      initialBalance: "0",
      name: "Cash",
      order: 0,
      ownerId: null,
      updatedAt,
      workspaceId: "507f1f77bcf86cd799439012",
    });
    expect(result.warnings.map((warning) => warning.field)).toEqual([
      "balance",
      "initialBalance",
      "currency",
      "archived",
      "order",
    ]);
    expect(toLegacyId(accountId)).toBe("507f1f77bcf86cd799439011");
  });

  it("preserves arrays, JSON, nulls, and dates without sharing mutable values", () => {
    const sourceMissingFields = ["account", "date"];
    const sourcePayload = {
      accountId: new ObjectId("507f1f77bcf86cd799439013"),
      entries: [{ amount: "12.30", tags: ["food"] }],
    };
    const now = new Date("2026-07-29T10:15:30.000Z");

    const result = transformMongoDocument(draft, {
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      committedAt: null,
      createdAt: now,
      expiresAt: new Date("2026-07-30T10:15:30.000Z"),
      missingFields: sourceMissingFields,
      payload: sourcePayload,
      sourceType: "text",
      updatedAt: now,
      userId: new ObjectId("507f1f77bcf86cd799439012"),
    });

    expect(result.issues).toEqual([]);
    expect(result.data.payload).toEqual({
      accountId: "507f1f77bcf86cd799439013",
      entries: [{ amount: "12.30", tags: ["food"] }],
    });
    expect(result.data.missingFields).toEqual(["account", "date"]);
    expect(result.data.missingFields).not.toBe(sourceMissingFields);
    expect(result.data.committedAt).toBeNull();
    expect(result.data.createdAt).toEqual(now);
    expect(result.data.createdAt).not.toBe(now);
  });

  it("reports invalid identifiers, money, dates, arrays, and unmapped fields before insertion", () => {
    const result = transformMongoDocument(account, {
      _id: "not-an-object-id",
      balance: "not-money",
      createdAt: "2026-07-29",
      initialBalance: "0",
      name: "Broken",
      unexpected: true,
      updatedAt: new Date("invalid"),
      workspaceId: "also-invalid",
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        { field: "unexpected", message: "is not represented in the target Prisma model" },
        { field: "_id", message: "must be a 24-character ObjectId" },
        { field: "workspaceId", message: "must be a 24-character ObjectId" },
        { field: "balance", message: "must be a valid decimal money string" },
        { field: "createdAt", message: "must be a valid BSON date" },
        { field: "updatedAt", message: "must be a valid BSON date" },
      ])
    );
  });

  it("warns about explicitly retired source fields without copying them", () => {
    const result = transformMongoDocument(
      { ...account, ignoredSourceFields: [{ name: "legacyField", validation: "string" }] },
      {
        _id: new ObjectId("507f1f77bcf86cd799439011"),
        createdAt: new Date("2026-07-29T10:15:30.000Z"),
        legacyField: "retired",
        name: "Cash",
        updatedAt: new Date("2026-07-29T11:15:30.000Z"),
        workspaceId: new ObjectId("507f1f77bcf86cd799439012"),
      }
    );

    expect(result.issues).toEqual([]);
    expect(result.data).not.toHaveProperty("legacyField");
    expect(result.warnings).toContainEqual({
      field: "legacyField",
      message: "is an obsolete source field and will not be copied",
    });
  });

  it("rejects retired source fields when their legacy shape changes", () => {
    const result = transformMongoDocument(
      { ...account, ignoredSourceFields: [{ name: "legacyTags", validation: "empty-array" }] },
      {
        _id: new ObjectId("507f1f77bcf86cd799439011"),
        createdAt: new Date("2026-07-29T10:15:30.000Z"),
        legacyTags: ["meaningful"],
        name: "Cash",
        updatedAt: new Date("2026-07-29T11:15:30.000Z"),
        workspaceId: new ObjectId("507f1f77bcf86cd799439012"),
      }
    );

    expect(result.issues).toContainEqual({
      field: "legacyTags",
      message: "is an obsolete source field with an unexpected value; expected empty-array",
    });
  });

  it("builds stable records, digests, and nullable unique keys", () => {
    const first = canonicalRecord(
      {
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        email: null,
        id: "507f1f77bcf86cd799439011",
        name: "A",
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      },
      MIGRATION_MODELS[0]
    );
    const second = canonicalRecord(
      {
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
        name: "A",
        id: "507f1f77bcf86cd799439011",
        email: null,
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
      },
      MIGRATION_MODELS[0]
    );

    expect(first).toBe(second);
    expect(
      getStableDigest(
        new Map([
          ["b", "second"],
          ["a", "first"],
        ])
      )
    ).toBe(
      getStableDigest(
        new Map([
          ["a", "first"],
          ["b", "second"],
        ])
      )
    );
    expect(getUniqueKey({ email: null }, { fields: ["email"] })).toBeNull();
    expect(getUniqueKey({ email: "user@example.com" }, { fields: ["email"] })).toBe('["user@example.com"]');
  });

  it("keeps every foreign-key target earlier in the migration order", () => {
    const modelOrder = new Map(MIGRATION_MODELS.map((spec, index) => [spec.model, index]));

    for (const [index, spec] of MIGRATION_MODELS.entries()) {
      const fieldNames = new Set(spec.fields.map((field) => field.name));
      for (const reference of spec.references ?? []) {
        expect(fieldNames.has(reference.field), `${spec.model}.${reference.field}`).toBe(true);
        expect(modelOrder.get(reference.targetModel), `${spec.model}.${reference.field}`).toBeLessThan(index);
      }
    }
  });

  it("recomputes account balances and debt totals from ledger records", () => {
    const result = validateFinancialInvariants({
      accounts: [
        { balance: "45", id: "account-a", initialBalance: "100" },
        { balance: "60", id: "account-b", initialBalance: "20" },
      ],
      debts: [{ amount: "50", id: "debt-a", remainingAmount: "20", status: "open", type: "lent" }],
      legacyDebtAccountIds: new Map([["debt-a", "account-a"]]),
      debtTransactions: [
        {
          accountId: "account-a",
          amount: "50",
          debtId: "debt-a",
          toAmount: null,
          type: "created",
        },
        {
          accountId: "account-a",
          amount: "20",
          debtId: "debt-a",
          paymentTransactionId: null,
          toAmount: null,
          type: "closed",
        },
        {
          accountId: "account-a",
          amount: "10",
          debtId: "debt-a",
          paymentTransactionId: "payment-write-off",
          toAmount: null,
          type: "closed",
        },
      ],
      paymentTransactions: [
        { accountId: "account-a", amount: "10", type: "expense" },
        { accountId: "account-a", amount: "5", type: "income" },
      ],
      transfers: [{ amount: "20", fromAccountId: "account-a", toAccountId: "account-b", toAmount: "40" }],
    });

    expect(result).toEqual({ issues: [], warnings: [] });
  });

  it("requires retired debt account links to match the created ledger entry", () => {
    const result = validateFinancialInvariants({
      accounts: [],
      debts: [{ amount: "10", id: "debt-a", remainingAmount: "10", status: "open", type: "lent" }],
      debtTransactions: [
        {
          accountId: "account-a",
          amount: "10",
          debtId: "debt-a",
          paymentTransactionId: null,
          toAmount: null,
          type: "created",
        },
      ],
      legacyDebtAccountIds: new Map([["debt-a", "account-b"]]),
      paymentTransactions: [],
      transfers: [],
    });

    expect(result.issues).toContain(
      "Debt debt-a legacy accountId account-b differs from its created ledger transaction accountId account-a."
    );
  });

  it("reports materialized financial mismatches and debts without a complete ledger", () => {
    const result = validateFinancialInvariants({
      accounts: [{ balance: "99", id: "account-a", initialBalance: "100" }],
      debts: [
        { amount: "50", id: "debt-a", remainingAmount: "41", status: "closed", type: "borrowed" },
        { amount: "10", id: "debt-without-ledger", remainingAmount: "10", status: "open", type: "lent" },
      ],
      debtTransactions: [
        {
          accountId: null,
          amount: "50",
          debtId: "debt-a",
          paymentTransactionId: null,
          toAmount: null,
          type: "created",
        },
        {
          accountId: null,
          amount: "10",
          debtId: "debt-a",
          paymentTransactionId: null,
          toAmount: null,
          type: "closed",
        },
      ],
      paymentTransactions: [],
      transfers: [],
    });

    expect(result.issues).toEqual([
      "Debt debt-a remainingAmount mismatch: stored=41, ledger=40.",
      "Debt debt-a status mismatch: stored=closed, ledger=open.",
    ]);
    expect(result.warnings).toEqual([
      "Account account-a balance mismatch: stored=99, ledger=100; preserving the stored materialized balance.",
      "Debt debt-without-ledger has no ledger transactions; amount and remainingAmount could not be recomputed.",
    ]);
  });
});
