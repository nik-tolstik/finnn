import Big from "big.js";
import { type Document, ObjectId } from "mongodb";

export type MigrationFieldKind =
  | "boolean"
  | "date"
  | "id"
  | "json"
  | "number"
  | "number-array"
  | "string"
  | "string-array";

export type MigrationFieldSpec = {
  name: string;
  kind: MigrationFieldKind;
  sourceName?: string;
  required?: boolean;
  integer?: boolean;
  money?: boolean;
  defaultValue?: unknown;
  allowedValues?: readonly string[];
};

export type MigrationReferenceSpec = {
  field: string;
  targetModel: string;
};

export type MigrationUniqueSpec = {
  fields: readonly string[];
};

export type MigrationIgnoredSourceFieldSpec = {
  name: string;
  validation: "empty-array" | "id" | "string";
};

export type MigrationModelSpec = {
  model: string;
  delegate: string;
  collection: string;
  fields: readonly MigrationFieldSpec[];
  ignoredSourceFields?: readonly MigrationIgnoredSourceFieldSpec[];
  references?: readonly MigrationReferenceSpec[];
  unique?: readonly MigrationUniqueSpec[];
};

export type TransformIssue = {
  field?: string;
  message: string;
};

export type TransformResult = {
  data: Record<string, unknown>;
  issues: TransformIssue[];
  warnings: TransformIssue[];
};

export type FinancialInvariantInput = {
  accounts: readonly Record<string, unknown>[];
  debtTransactions: readonly Record<string, unknown>[];
  debts: readonly Record<string, unknown>[];
  legacyDebtAccountIds?: ReadonlyMap<string, string>;
  paymentTransactions: readonly Record<string, unknown>[];
  transfers: readonly Record<string, unknown>[];
};

export type FinancialInvariantResult = {
  issues: string[];
  warnings: string[];
};

const currencies = ["USD", "EUR", "RUB", "BYN"] as const;

const id = (name = "id", required = true): MigrationFieldSpec => ({
  kind: "id",
  name,
  required,
  sourceName: name === "id" ? "_id" : undefined,
});
const string = (
  name: string,
  required = true,
  options: Pick<MigrationFieldSpec, "allowedValues" | "defaultValue" | "money"> = {}
): MigrationFieldSpec => ({ kind: "string", name, required, ...options });
const date = (name: string, required = true): MigrationFieldSpec => ({ kind: "date", name, required });
const boolean = (name: string, required = true, defaultValue?: boolean): MigrationFieldSpec => ({
  defaultValue,
  kind: "boolean",
  name,
  required,
});
const number = (name: string, required = true, integer = false, defaultValue?: number): MigrationFieldSpec => ({
  defaultValue,
  integer,
  kind: "number",
  name,
  required,
});
const json = (name: string, required = true): MigrationFieldSpec => ({ kind: "json", name, required });
const stringArray = (name: string, defaultValue?: readonly string[]): MigrationFieldSpec => ({
  defaultValue,
  kind: "string-array",
  name,
  required: true,
});
const numberArray = (name: string, defaultValue?: readonly number[]): MigrationFieldSpec => ({
  defaultValue,
  kind: "number-array",
  name,
  required: true,
});

export const MIGRATION_MODELS: readonly MigrationModelSpec[] = [
  {
    collection: "users",
    delegate: "user",
    model: "User",
    fields: [
      id(),
      string("email", false),
      string("name", false),
      string("image", false),
      string("avatarStorageKey", false),
      string("password", false),
      date("emailVerified", false),
      date("createdAt"),
      date("updatedAt"),
    ],
    unique: [{ fields: ["email"] }],
  },
  {
    collection: "pending_registrations",
    delegate: "pendingRegistration",
    model: "PendingRegistration",
    fields: [
      id(),
      string("name"),
      string("email"),
      string("password"),
      string("token"),
      date("expiresAt"),
      date("createdAt"),
    ],
    unique: [{ fields: ["email"] }, { fields: ["token"] }],
  },
  {
    collection: "exchange_rates",
    delegate: "exchangeRate",
    model: "ExchangeRate",
    fields: [
      id(),
      date("date"),
      string("fromCurrency", true, { allowedValues: currencies }),
      string("toCurrency", true, { allowedValues: currencies }),
      number("rate"),
      date("createdAt"),
      date("updatedAt"),
    ],
    unique: [{ fields: ["date", "fromCurrency", "toCurrency"] }],
  },
  {
    collection: "auth_identities",
    delegate: "authIdentity",
    model: "AuthIdentity",
    fields: [
      id(),
      id("userId"),
      string("provider"),
      string("providerUserId"),
      string("username", false),
      string("displayName", false),
      string("photoUrl", false),
      date("linkedAt"),
      date("updatedAt"),
    ],
    references: [{ field: "userId", targetModel: "User" }],
    unique: [{ fields: ["provider", "providerUserId"] }],
  },
  {
    collection: "pending_email_verifications",
    delegate: "pendingEmailVerification",
    model: "PendingEmailVerification",
    fields: [id(), id("userId"), string("email"), string("token"), date("expiresAt"), date("createdAt")],
    references: [{ field: "userId", targetModel: "User" }],
    unique: [{ fields: ["userId"] }, { fields: ["token"] }],
  },
  {
    collection: "password_reset_codes",
    delegate: "passwordResetCode",
    model: "PasswordResetCode",
    fields: [
      id(),
      id("userId"),
      string("email"),
      string("codeHash"),
      date("expiresAt"),
      number("attempts", true, true, 0),
      date("createdAt"),
    ],
    references: [{ field: "userId", targetModel: "User" }],
    unique: [{ fields: ["userId"] }],
  },
  {
    collection: "auth_sessions",
    delegate: "authSession",
    model: "AuthSession",
    fields: [id(), id("userId"), string("tokenHash"), date("expiresAt"), date("createdAt"), date("revokedAt", false)],
    references: [{ field: "userId", targetModel: "User" }],
    unique: [{ fields: ["tokenHash"] }],
  },
  {
    collection: "workspaces",
    delegate: "workspace",
    model: "Workspace",
    ignoredSourceFields: [{ name: "icon", validation: "string" }],
    fields: [
      id(),
      string("name"),
      string("slug"),
      string("baseCurrency", true, { defaultValue: "BYN" }),
      id("ownerId"),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [{ field: "ownerId", targetModel: "User" }],
    unique: [{ fields: ["slug"] }],
  },
  {
    collection: "workspace_members",
    delegate: "workspaceMember",
    model: "WorkspaceMember",
    fields: [
      id(),
      id("workspaceId"),
      id("userId"),
      string("role", true, { defaultValue: "member" }),
      date("createdAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "userId", targetModel: "User" },
    ],
    unique: [{ fields: ["workspaceId", "userId"] }],
  },
  {
    collection: "accounts",
    delegate: "account",
    model: "Account",
    fields: [
      id(),
      id("workspaceId"),
      id("ownerId", false),
      string("name"),
      string("balance", true, { defaultValue: "0", money: true }),
      string("initialBalance", true, { defaultValue: "0", money: true }),
      string("currency", true, { defaultValue: "USD" }),
      string("description", false),
      string("color", false),
      string("icon", false),
      boolean("archived", true, false),
      number("order", true, true, 0),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "ownerId", targetModel: "User" },
    ],
  },
  {
    collection: "category_icon_assets",
    delegate: "categoryIconAsset",
    model: "CategoryIconAsset",
    ignoredSourceFields: [{ name: "tags", validation: "empty-array" }],
    fields: [
      id(),
      id("workspaceId"),
      id("uploadedById"),
      string("storageKey"),
      boolean("isDeleting", false, false),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "uploadedById", targetModel: "User" },
    ],
  },
  {
    collection: "categories",
    delegate: "category",
    model: "Category",
    ignoredSourceFields: [{ name: "color", validation: "string" }],
    fields: [
      id(),
      id("workspaceId"),
      id("iconAssetId", false),
      string("name"),
      string("type"),
      string("icon", false),
      number("order", true, true, 0),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "iconAssetId", targetModel: "CategoryIconAsset" },
    ],
  },
  {
    collection: "hidden_accounts",
    delegate: "hiddenAccount",
    model: "HiddenAccount",
    fields: [id(), id("accountId"), id("userId"), date("createdAt")],
    references: [
      { field: "accountId", targetModel: "Account" },
      { field: "userId", targetModel: "User" },
    ],
    unique: [{ fields: ["accountId", "userId"] }],
  },
  {
    collection: "transactions",
    delegate: "paymentTransaction",
    model: "PaymentTransaction",
    fields: [
      id(),
      id("workspaceId"),
      id("accountId"),
      string("amount", true, { money: true }),
      string("type"),
      string("description", false),
      date("date"),
      id("categoryId", false),
      boolean("createdByAi", false, false),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "accountId", targetModel: "Account" },
      { field: "categoryId", targetModel: "Category" },
    ],
  },
  {
    collection: "transfers",
    delegate: "transferTransaction",
    model: "TransferTransaction",
    fields: [
      id(),
      id("workspaceId"),
      id("fromAccountId"),
      id("toAccountId"),
      id("createdById", false),
      string("amount", true, { money: true }),
      string("toAmount", true, { money: true }),
      string("description", false),
      date("date"),
      boolean("createdByAi", false, false),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "fromAccountId", targetModel: "Account" },
      { field: "toAccountId", targetModel: "Account" },
      { field: "createdById", targetModel: "User" },
    ],
  },
  {
    collection: "workspace_invites",
    delegate: "workspaceInvite",
    model: "WorkspaceInvite",
    fields: [id(), id("workspaceId"), string("email"), string("token"), date("expiresAt"), date("createdAt")],
    references: [{ field: "workspaceId", targetModel: "Workspace" }],
    unique: [{ fields: ["token"] }],
  },
  {
    collection: "debts",
    delegate: "debt",
    model: "Debt",
    ignoredSourceFields: [{ name: "accountId", validation: "id" }],
    fields: [
      id(),
      id("workspaceId"),
      string("type"),
      string("personName"),
      string("amount", true, { money: true }),
      string("remainingAmount", true, { money: true }),
      string("currency"),
      date("date"),
      string("status", true, { defaultValue: "open" }),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [{ field: "workspaceId", targetModel: "Workspace" }],
  },
  {
    collection: "telegram_bot_preferences",
    delegate: "telegramBotPreference",
    model: "TelegramBotPreference",
    fields: [
      id(),
      id("userId"),
      string("telegramChatId", false),
      id("activeWorkspaceId", false),
      json("defaultAccountByWorkspace", false),
      string("receiptMode", true, { defaultValue: "category" }),
      string("timezone", true, { defaultValue: "Europe/Minsk" }),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "userId", targetModel: "User" },
      { field: "activeWorkspaceId", targetModel: "Workspace" },
    ],
    unique: [{ fields: ["userId"] }],
  },
  {
    collection: "ai_finance_drafts",
    delegate: "aiFinanceDraft",
    model: "AiFinanceDraft",
    fields: [
      id(),
      id("userId"),
      string("telegramChatId", false),
      id("workspaceId", false),
      string("status", true, { defaultValue: "pending" }),
      string("sourceType"),
      string("sourceText", false),
      string("receiptMode", false),
      string("kind", false),
      json("payload"),
      stringArray("missingFields", []),
      number("confidence", false),
      string("currentQuestion", false),
      date("expiresAt"),
      date("committedAt", false),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "userId", targetModel: "User" },
      { field: "workspaceId", targetModel: "Workspace" },
    ],
  },
  {
    collection: "scheduled_payments",
    delegate: "scheduledPayment",
    model: "ScheduledPayment",
    fields: [
      id(),
      id("workspaceId"),
      string("name"),
      string("amountMode"),
      string("amount", false, { money: true }),
      string("amountMin", false, { money: true }),
      string("amountMax", false, { money: true }),
      string("currency", false),
      id("categoryId", false),
      id("accountId", false),
      id("assignedUserId", false),
      id("createdById"),
      string("scheduleKind"),
      number("scheduleInterval", true, true, 1),
      string("scheduleUnit", false),
      number("dueDay", false, true),
      number("dueMonth", false, true),
      date("nextDueAt"),
      string("timezone", true, { defaultValue: "Europe/Minsk" }),
      numberArray("reminderDaysBefore", []),
      boolean("notifyTelegram", true, false),
      boolean("notifyEmail", true, false),
      string("notes", false),
      date("lastPaidAt", false),
      date("snoozedUntil", false),
      date("createdAt"),
      date("updatedAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "categoryId", targetModel: "Category" },
      { field: "accountId", targetModel: "Account" },
      { field: "assignedUserId", targetModel: "User" },
      { field: "createdById", targetModel: "User" },
    ],
  },
  {
    collection: "scheduled_payment_records",
    delegate: "scheduledPaymentRecord",
    model: "ScheduledPaymentRecord",
    fields: [
      id(),
      id("scheduledPaymentId"),
      id("workspaceId"),
      id("transactionId", false),
      date("dueAt"),
      date("paidAt", false),
      date("skippedAt", false),
      string("amount", false, { money: true }),
      string("currency", false),
      id("accountId", false),
      id("categoryId", false),
      id("actionById"),
      string("status"),
      string("note", false),
      date("createdAt"),
    ],
    references: [
      { field: "scheduledPaymentId", targetModel: "ScheduledPayment" },
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "transactionId", targetModel: "PaymentTransaction" },
      { field: "accountId", targetModel: "Account" },
      { field: "categoryId", targetModel: "Category" },
      { field: "actionById", targetModel: "User" },
    ],
  },
  {
    collection: "debt_transactions",
    delegate: "debtTransaction",
    model: "DebtTransaction",
    fields: [
      id(),
      id("workspaceId"),
      id("debtId"),
      id("accountId", false),
      id("paymentTransactionId", false),
      string("type"),
      string("amount", true, { money: true }),
      string("toAmount", false, { money: true }),
      date("date"),
      date("createdAt"),
    ],
    references: [
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "debtId", targetModel: "Debt" },
      { field: "accountId", targetModel: "Account" },
      { field: "paymentTransactionId", targetModel: "PaymentTransaction" },
    ],
  },
  {
    collection: "scheduled_payment_reminder_deliveries",
    delegate: "scheduledPaymentReminderDelivery",
    model: "ScheduledPaymentReminderDelivery",
    fields: [
      id(),
      id("scheduledPaymentId"),
      id("workspaceId"),
      id("userId"),
      date("dueAt"),
      date("reminderDate"),
      number("daysBefore", true, true),
      string("channel"),
      string("status"),
      date("sentAt", false),
      string("error", false),
      date("createdAt"),
    ],
    references: [
      { field: "scheduledPaymentId", targetModel: "ScheduledPayment" },
      { field: "workspaceId", targetModel: "Workspace" },
      { field: "userId", targetModel: "User" },
    ],
    unique: [{ fields: ["scheduledPaymentId", "dueAt", "daysBefore", "channel"] }],
  },
] as const;

function cloneDefault(value: unknown): unknown {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}

export function toLegacyId(value: unknown): string | null {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) return value.toLowerCase();
  return null;
}

function transformJsonValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return value;
  }

  if (value instanceof ObjectId) return value.toHexString();

  if (Array.isArray(value)) {
    return value.map((item, index) => transformJsonValue(item, `${path}[${index}]`));
  }

  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, transformJsonValue(item, `${path}.${key}`)])
    );
  }

  throw new Error(`${path} contains an unsupported BSON value`);
}

function transformField(field: MigrationFieldSpec, value: unknown): unknown {
  switch (field.kind) {
    case "id": {
      const converted = toLegacyId(value);
      if (!converted) throw new Error("must be a 24-character ObjectId");
      return converted;
    }
    case "string":
      if (typeof value !== "string") throw new Error("must be a string");
      if (field.money) {
        try {
          new Big(value);
        } catch {
          throw new Error("must be a valid decimal money string");
        }
      }
      if (field.allowedValues && !field.allowedValues.includes(value)) {
        throw new Error(`must be one of: ${field.allowedValues.join(", ")}`);
      }
      return value;
    case "boolean":
      if (typeof value !== "boolean") throw new Error("must be a boolean");
      return value;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("must be a finite number");
      if (field.integer && !Number.isInteger(value)) throw new Error("must be an integer");
      return value;
    case "date":
      if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("must be a valid BSON date");
      return new Date(value.getTime());
    case "string-array":
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error("must be an array of strings");
      }
      return [...value];
    case "number-array":
      if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isInteger(item))) {
        throw new Error("must be an array of integers");
      }
      return [...value];
    case "json":
      return transformJsonValue(value, field.name);
  }
}

export function transformMongoDocument(spec: MigrationModelSpec, document: Document): TransformResult {
  const data: Record<string, unknown> = {};
  const issues: TransformIssue[] = [];
  const warnings: TransformIssue[] = [];
  const sourceNames = new Set(spec.fields.map((field) => field.sourceName ?? field.name));
  const ignoredSourceFields = new Map((spec.ignoredSourceFields ?? []).map((field) => [field.name, field]));

  for (const key of Object.keys(document)) {
    const ignoredField = ignoredSourceFields.get(key);
    if (ignoredField) {
      const value = document[key];
      const isValid =
        (ignoredField.validation === "empty-array" && Array.isArray(value) && value.length === 0) ||
        (ignoredField.validation === "id" && toLegacyId(value) !== null) ||
        (ignoredField.validation === "string" && typeof value === "string");

      if (isValid) {
        warnings.push({ field: key, message: "is an obsolete source field and will not be copied" });
      } else {
        issues.push({
          field: key,
          message: `is an obsolete source field with an unexpected value; expected ${ignoredField.validation}`,
        });
      }
    } else if (!sourceNames.has(key)) {
      issues.push({ field: key, message: "is not represented in the target Prisma model" });
    }
  }

  for (const field of spec.fields) {
    const sourceName = field.sourceName ?? field.name;
    let value = document[sourceName];

    if (value === undefined && field.defaultValue !== undefined) {
      value = cloneDefault(field.defaultValue);
      warnings.push({ field: sourceName, message: `is missing; using target default ${JSON.stringify(value)}` });
    }

    if (value === undefined || value === null) {
      if (field.required) {
        issues.push({ field: sourceName, message: "is required" });
      } else {
        data[field.name] = null;
      }
      continue;
    }

    try {
      data[field.name] = transformField(field, value);
    } catch (error) {
      issues.push({ field: sourceName, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { data, issues, warnings };
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function canonicalRecord(record: Record<string, unknown>, spec: MigrationModelSpec): string {
  const normalized = Object.fromEntries(
    spec.fields
      .map((field) => [field.name, record[field.name] ?? null] as const)
      .sort(([left], [right]) => left.localeCompare(right))
  );
  return JSON.stringify(canonicalize(normalized));
}

export function getUniqueKey(record: Record<string, unknown>, unique: MigrationUniqueSpec): string | null {
  const values = unique.fields.map((field) => record[field]);
  if (values.some((value) => value === null || value === undefined)) return null;
  return JSON.stringify(canonicalize(values));
}

function addDelta(deltas: Map<string, Big>, accountId: unknown, amount: Big): void {
  if (typeof accountId !== "string") return;
  deltas.set(accountId, (deltas.get(accountId) ?? new Big(0)).plus(amount));
}

function getMoney(record: Record<string, unknown>, field: string): Big {
  return new Big(record[field] as string);
}

export function validateFinancialInvariants(input: FinancialInvariantInput): FinancialInvariantResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const balanceDeltas = new Map<string, Big>();
  const debtTypes = new Map(input.debts.map((debt) => [debt.id as string, debt.type as string]));

  for (const transaction of input.paymentTransactions) {
    const amount = getMoney(transaction, "amount");
    if (transaction.type === "income") addDelta(balanceDeltas, transaction.accountId, amount);
    if (transaction.type === "expense") addDelta(balanceDeltas, transaction.accountId, amount.times(-1));
  }

  for (const transfer of input.transfers) {
    addDelta(balanceDeltas, transfer.fromAccountId, getMoney(transfer, "amount").times(-1));
    addDelta(balanceDeltas, transfer.toAccountId, getMoney(transfer, "toAmount"));
  }

  for (const transaction of input.debtTransactions) {
    if (typeof transaction.paymentTransactionId === "string" || typeof transaction.accountId !== "string") continue;
    const debtType = debtTypes.get(transaction.debtId as string);
    if (!debtType) continue;

    const accountAmount = new Big((transaction.toAmount ?? transaction.amount) as string);
    const direction = transaction.type === "closed" ? 1 : -1;
    const lentDirection = debtType === "lent" ? direction : direction * -1;
    addDelta(balanceDeltas, transaction.accountId, accountAmount.times(lentDirection));
  }

  for (const account of input.accounts) {
    const accountId = account.id as string;
    const expected = getMoney(account, "initialBalance").plus(balanceDeltas.get(accountId) ?? 0);
    const actual = getMoney(account, "balance");
    if (!actual.eq(expected)) {
      warnings.push(
        `Account ${accountId} balance mismatch: stored=${actual.toString()}, ledger=${expected.toString()}; preserving the stored materialized balance.`
      );
    }
  }

  const transactionsByDebt = new Map<string, Record<string, unknown>[]>();
  for (const transaction of input.debtTransactions) {
    const debtId = transaction.debtId as string;
    const transactions = transactionsByDebt.get(debtId) ?? [];
    transactions.push(transaction);
    transactionsByDebt.set(debtId, transactions);
  }

  for (const [debtId, legacyAccountId] of input.legacyDebtAccountIds ?? []) {
    const createdTransactions = (transactionsByDebt.get(debtId) ?? []).filter(
      (transaction) => transaction.type === "created"
    );
    if (createdTransactions.length !== 1) {
      issues.push(
        `Debt ${debtId} legacy accountId requires exactly one created ledger transaction; found ${createdTransactions.length}.`
      );
      continue;
    }

    if (createdTransactions[0]?.accountId !== legacyAccountId) {
      issues.push(
        `Debt ${debtId} legacy accountId ${legacyAccountId} differs from its created ledger transaction accountId ${String(createdTransactions[0]?.accountId)}.`
      );
    }
  }

  for (const debt of input.debts) {
    const debtId = debt.id as string;
    const transactions = transactionsByDebt.get(debtId) ?? [];
    if (transactions.length === 0) {
      warnings.push(`Debt ${debtId} has no ledger transactions; amount and remainingAmount could not be recomputed.`);
      continue;
    }

    const createdTransactions = transactions.filter((transaction) => transaction.type === "created");
    if (createdTransactions.length !== 1) {
      issues.push(
        `Debt ${debtId} must have exactly one created ledger transaction; found ${createdTransactions.length}.`
      );
      continue;
    }

    let expectedAmount = new Big(0);
    let expectedRemaining = new Big(0);
    for (const transaction of transactions) {
      const amount = getMoney(transaction, "amount");
      if (transaction.type === "closed") {
        expectedRemaining = expectedRemaining.minus(amount);
      } else {
        expectedAmount = expectedAmount.plus(amount);
        expectedRemaining = expectedRemaining.plus(amount);
      }
    }

    const actualAmount = getMoney(debt, "amount");
    const actualRemaining = getMoney(debt, "remainingAmount");
    if (!actualAmount.eq(expectedAmount)) {
      issues.push(
        `Debt ${debtId} amount mismatch: stored=${actualAmount.toString()}, ledger=${expectedAmount.toString()}.`
      );
    }
    if (!actualRemaining.eq(expectedRemaining)) {
      issues.push(
        `Debt ${debtId} remainingAmount mismatch: stored=${actualRemaining.toString()}, ledger=${expectedRemaining.toString()}.`
      );
    }

    const expectedStatus = expectedRemaining.lte(0) ? "closed" : "open";
    if (debt.status !== expectedStatus) {
      issues.push(`Debt ${debtId} status mismatch: stored=${String(debt.status)}, ledger=${expectedStatus}.`);
    }
  }

  return { issues, warnings };
}
