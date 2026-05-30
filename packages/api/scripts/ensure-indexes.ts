import "../src/common/env/load-env";
import { MongoClient } from "mongodb";

import { getDatabaseUrl } from "../src/common/env/database-url";

const USERS_COLLECTION = "users";
const EMAIL_INDEX_NAME = "users_email_unique_partial";

type EnsureIndexesOptions = {
  databaseUrl?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  createClient?: (databaseUrl: string) => MongoClient;
};

export async function ensureIndexes(options: EnsureIndexesOptions = {}): Promise<void> {
  const databaseUrl = options.databaseUrl ?? getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be provided.");
  }

  const stdout = options.stdout ?? process.stdout;
  const client = options.createClient?.(databaseUrl) ?? new MongoClient(databaseUrl);

  try {
    await client.connect();
    const users = client.db().collection(USERS_COLLECTION);
    const indexes = await users.listIndexes().toArray();

    for (const index of indexes) {
      const isEmailOnlyIndex =
        index.name !== "_id_" &&
        Object.keys(index.key).length === 1 &&
        (index.key.email === 1 || index.key.email === "1");

      if (isEmailOnlyIndex && index.name !== EMAIL_INDEX_NAME) {
        await users.dropIndex(index.name);
        stdout.write(`Dropped users email index ${index.name}\n`);
      }
    }

    await users.createIndex(
      { email: 1 },
      {
        name: EMAIL_INDEX_NAME,
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
      }
    );
    stdout.write(`Ensured users email partial unique index ${EMAIL_INDEX_NAME}\n`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  ensureIndexes().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
