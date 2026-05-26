import "../src/common/env/load-env";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, type Document, MongoClient } from "mongodb";

import { getDatabaseUrl } from "../src/common/env/database-url";

const { EJSON } = BSON;

export type ExportedCollection = {
  name: string;
  documentsFile: string;
  indexesFile: string;
  count: number;
};

export type BackupManifest = {
  database: string;
  exportedAt: string;
  collections: ExportedCollection[];
};

type MongoExportOptions = {
  argv?: string[];
  cwd?: string;
  databaseUrl?: string;
  now?: Date;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  createClient?: (databaseUrl: string) => MongoClient;
};

export function getOutputDir(options: Pick<MongoExportOptions, "argv" | "cwd" | "now"> = {}): string {
  const argv = options.argv ?? process.argv;
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const cliArg = argv
    .slice(2)
    .find((arg) => arg !== "--" && !arg.startsWith("--"))
    ?.trim();
  if (cliArg) return path.resolve(cliArg);

  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return path.resolve(cwd, "backups", `mongo-${stamp}`);
}

export async function writeJsonLine(stream: ReturnType<typeof createWriteStream>, document: Document): Promise<void> {
  const payload = `${EJSON.stringify(document, { relaxed: false })}\n`;

  if (!stream.write(payload)) {
    await once(stream, "drain");
  }
}

export async function exportCollection(
  client: MongoClient,
  databaseName: string,
  outputDir: string,
  collectionName: string
): Promise<ExportedCollection> {
  const db = client.db(databaseName);
  const collection = db.collection<Document>(collectionName);

  const documentsFile = `${collectionName}.jsonl`;
  const indexesFile = `${collectionName}.indexes.json`;
  const documentsPath = path.join(outputDir, documentsFile);
  const indexesPath = path.join(outputDir, indexesFile);

  const stream = createWriteStream(documentsPath, { encoding: "utf8" });
  let count = 0;

  try {
    const cursor = collection.find({});
    for await (const document of cursor) {
      await writeJsonLine(stream, document);
      count += 1;
    }
  } finally {
    const finished = once(stream, "finish");
    stream.end();
    await finished;
  }

  const indexes = await collection.listIndexes().toArray();
  await writeFile(indexesPath, EJSON.stringify(indexes, { relaxed: false }, 2), "utf8");

  return {
    name: collectionName,
    documentsFile,
    indexesFile,
    count,
  };
}

export async function runMongoExport(options: MongoExportOptions = {}): Promise<BackupManifest> {
  const databaseUrl = options.databaseUrl ?? getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be provided.");
  }

  const outputDir = getOutputDir(options);
  await mkdir(outputDir, { recursive: true });

  const stdout = options.stdout ?? process.stdout;
  const client = options.createClient?.(databaseUrl) ?? new MongoClient(databaseUrl);

  try {
    await client.connect();

    const db = client.db();
    const databaseName = db.databaseName;
    const collections = await db.listCollections().toArray();

    const collectionNames = collections
      .filter((collection) => collection.type === "collection")
      .map((collection) => collection.name)
      .filter((name): name is string => Boolean(name))
      .filter((name) => !name.startsWith("system."))
      .sort();

    const manifest: BackupManifest = {
      database: databaseName,
      exportedAt: (options.now ?? new Date()).toISOString(),
      collections: [],
    };

    for (const collectionName of collectionNames) {
      const exported = await exportCollection(client, databaseName, outputDir, collectionName);
      manifest.collections.push(exported);
      stdout.write(`Exported ${collectionName}: ${exported.count} documents\n`);
    }

    await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    stdout.write(`Backup saved to ${outputDir}\n`);
    return manifest;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runMongoExport().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
