import "../src/common/env/load-env";
import { MongoClient } from "mongodb";

import { getDatabaseUrl } from "../src/common/env/database-url";

const DEBTS_COLLECTION = "debts";

type UnsetDebtAccountIdsOptions = {
  databaseUrl?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  createClient?: (databaseUrl: string) => MongoClient;
};

export async function unsetDebtAccountIds(options: UnsetDebtAccountIdsOptions = {}): Promise<void> {
  const databaseUrl = options.databaseUrl ?? getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be provided.");
  }

  const stdout = options.stdout ?? process.stdout;
  const client = options.createClient?.(databaseUrl) ?? new MongoClient(databaseUrl);

  try {
    await client.connect();
    const debts = client.db().collection(DEBTS_COLLECTION);
    const result = await debts.updateMany({ accountId: { $exists: true } }, { $unset: { accountId: "" } });
    stdout.write(`Unset accountId on ${result.modifiedCount} debt documents\n`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  unsetDebtAccountIds().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
