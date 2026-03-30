import "../src/shared/lib/load-env";
import { type Document, MongoClient, ObjectId, type WithId } from "mongodb";

type LegacyTransferDocument = WithId<
  Document & {
    fromTransactionId?: ObjectId | string;
    toTransactionId?: ObjectId | string;
    amount?: string;
    toAmount?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    date?: Date | string;
    description?: string | null;
  }
>;

type LegacyTransferTransactionDocument = WithId<
  Document & {
    workspaceId?: ObjectId | string;
    accountId?: ObjectId | string;
    amount?: string;
    type?: string;
    description?: string | null;
    date?: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }
>;

function getDatabaseUrl(): string {
  const explicitUrl = process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const mongoUri = process.env.MONGODB_URI?.trim() || "";
  if (!mongoUri) return "";

  try {
    const parsed = new URL(mongoUri);
    if (parsed.pathname && parsed.pathname !== "/") {
      return mongoUri;
    }

    parsed.pathname = "/finnn";
    return parsed.toString();
  } catch {
    return mongoUri;
  }
}

function ensureObjectId(value: unknown, fieldName: string): ObjectId {
  if (value instanceof ObjectId) {
    return value;
  }

  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }

  throw new Error(`Field "${fieldName}" is missing or is not a valid ObjectId.`);
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Field "${fieldName}" is missing or is not a non-empty string.`);
}

function ensureDate(value: unknown, fieldName: string, fallback?: Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (fallback) {
    return fallback;
  }

  throw new Error(`Field "${fieldName}" is missing or is not a valid date.`);
}

function formatIdList(ids: string[]) {
  return ids.join(", ");
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or MONGODB_URI must be provided.");
  }

  const client = new MongoClient(databaseUrl);

  try {
    await client.connect();

    const db = client.db();
    const transfersCollection = db.collection<LegacyTransferDocument>("transfers");
    const transactionsCollection = db.collection<LegacyTransferTransactionDocument>("transactions");

    const legacyTransfers = await transfersCollection
      .find({
        $or: [{ fromTransactionId: { $exists: true } }, { toTransactionId: { $exists: true } }],
      })
      .toArray();
    const legacyTransferTransactions = await transactionsCollection.find({ type: "transfer" }).toArray();

    if (legacyTransfers.length === 0 && legacyTransferTransactions.length === 0) {
      process.stdout.write("Transfer transaction migration skipped: nothing to migrate.\n");
      return;
    }

    const transferTransactionsById = new Map(
      legacyTransferTransactions.map((transaction) => [transaction._id.toHexString(), transaction])
    );
    const referencedTransactionIds = new Set<string>();

    for (const transfer of legacyTransfers) {
      const fromTransactionId = ensureObjectId(transfer.fromTransactionId, "fromTransactionId");
      const toTransactionId = ensureObjectId(transfer.toTransactionId, "toTransactionId");

      if (fromTransactionId.equals(toTransactionId)) {
        throw new Error(`Transfer ${transfer._id.toHexString()} references the same transaction on both sides.`);
      }

      const fromTransactionKey = fromTransactionId.toHexString();
      const toTransactionKey = toTransactionId.toHexString();

      if (referencedTransactionIds.has(fromTransactionKey) || referencedTransactionIds.has(toTransactionKey)) {
        throw new Error(`Transfer pair reuse detected for transfer ${transfer._id.toHexString()}.`);
      }

      referencedTransactionIds.add(fromTransactionKey);
      referencedTransactionIds.add(toTransactionKey);

      const fromTransaction = transferTransactionsById.get(fromTransactionKey);
      const toTransaction = transferTransactionsById.get(toTransactionKey);

      if (!fromTransaction || !toTransaction) {
        throw new Error(`Transfer ${transfer._id.toHexString()} has missing linked transfer transactions.`);
      }

      if (fromTransaction.type !== "transfer" || toTransaction.type !== "transfer") {
        throw new Error(`Transfer ${transfer._id.toHexString()} is linked to non-transfer transactions.`);
      }

      const fromWorkspaceId = ensureObjectId(fromTransaction.workspaceId, "fromTransaction.workspaceId");
      const toWorkspaceId = ensureObjectId(toTransaction.workspaceId, "toTransaction.workspaceId");

      if (!fromWorkspaceId.equals(toWorkspaceId)) {
        throw new Error(`Transfer ${transfer._id.toHexString()} spans multiple workspaces.`);
      }

      ensureObjectId(fromTransaction.accountId, "fromTransaction.accountId");
      ensureObjectId(toTransaction.accountId, "toTransaction.accountId");
      ensureString(transfer.amount, "transfer.amount");
      ensureString(transfer.toAmount, "transfer.toAmount");
      ensureDate(fromTransaction.date, "fromTransaction.date");
      ensureDate(fromTransaction.createdAt, "fromTransaction.createdAt");
    }

    const orphanTransactions = legacyTransferTransactions.filter(
      (transaction) => !referencedTransactionIds.has(transaction._id.toHexString())
    );

    if (orphanTransactions.length > 0) {
      throw new Error(
        `Orphan transfer transactions found: ${formatIdList(orphanTransactions.map((transaction) => transaction._id.toHexString()))}`
      );
    }

    if (legacyTransfers.length === 0) {
      process.stdout.write("Transfer transaction migration skipped: transfers are already in the new format.\n");
      return;
    }

    for (const transfer of legacyTransfers) {
      const fromTransactionId = ensureObjectId(transfer.fromTransactionId, "fromTransactionId");
      const toTransactionId = ensureObjectId(transfer.toTransactionId, "toTransactionId");
      const fromTransaction = transferTransactionsById.get(fromTransactionId.toHexString());
      const toTransaction = transferTransactionsById.get(toTransactionId.toHexString());

      if (!fromTransaction || !toTransaction) {
        throw new Error(
          `Transfer ${transfer._id.toHexString()} cannot be migrated because linked transactions are missing.`
        );
      }

      const fromWorkspaceId = ensureObjectId(fromTransaction.workspaceId, "fromTransaction.workspaceId");
      const fromAccountId = ensureObjectId(fromTransaction.accountId, "fromTransaction.accountId");
      const toAccountId = ensureObjectId(toTransaction.accountId, "toTransaction.accountId");
      const amount = ensureString(transfer.amount, "transfer.amount");
      const toAmount = ensureString(transfer.toAmount, "transfer.toAmount");
      const createdAt = ensureDate(
        transfer.createdAt,
        "transfer.createdAt",
        ensureDate(fromTransaction.createdAt, "fromTransaction.createdAt")
      );
      const updatedAt = ensureDate(
        fromTransaction.updatedAt,
        "fromTransaction.updatedAt",
        toTransaction.updatedAt ? ensureDate(toTransaction.updatedAt, "toTransaction.updatedAt", createdAt) : createdAt
      );
      const date = ensureDate(fromTransaction.date, "fromTransaction.date", createdAt);
      const description =
        (typeof fromTransaction.description === "string" && fromTransaction.description.length > 0
          ? fromTransaction.description
          : null) ??
        (typeof toTransaction.description === "string" && toTransaction.description.length > 0
          ? toTransaction.description
          : null);

      await transfersCollection.updateOne(
        { _id: transfer._id },
        {
          $set: {
            workspaceId: fromWorkspaceId,
            fromAccountId,
            toAccountId,
            amount,
            toAmount,
            description,
            date,
            createdAt,
            updatedAt,
          },
          $unset: {
            fromTransactionId: "",
            toTransactionId: "",
          },
        }
      );
    }

    const deleteResult = await transactionsCollection.deleteMany({
      _id: {
        $in: [...referencedTransactionIds].map((id) => new ObjectId(id)),
      },
    });

    process.stdout.write(`Transfer transaction migration completed.\n`);
    process.stdout.write(`Migrated transfers: ${legacyTransfers.length}\n`);
    process.stdout.write(`Deleted legacy transfer transactions: ${deleteResult.deletedCount ?? 0}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write("Transfer transaction migration failed.\n");
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
