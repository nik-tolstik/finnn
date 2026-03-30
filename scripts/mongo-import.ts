import "../src/shared/lib/load-env";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  BSON,
  MongoClient,
  type Collection,
  type CreateIndexesOptions,
  type Document,
  type IndexDescriptionInfo,
} from "mongodb";

const { EJSON } = BSON;
const BATCH_SIZE = 1000;

type ExportedCollection = {
  name: string;
  documentsFile: string;
  indexesFile: string;
  count: number;
};

type BackupManifest = {
  database: string;
  exportedAt: string;
  collections: ExportedCollection[];
};

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

function getBackupDir(): string {
  const cliArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.trim();

  if (!cliArg) {
    throw new Error("Backup directory path is required.");
  }

  return path.resolve(cliArg);
}

function shouldDropCollections(): boolean {
  return process.argv.includes("--drop");
}

function getTargetDatabaseName(defaultDatabaseName: string): string {
  const override = process.argv
    .slice(2)
    .find((arg) => arg.startsWith("--db="))
    ?.slice("--db=".length)
    .trim();

  return override || defaultDatabaseName;
}

function getIndexLabel(index: IndexDescriptionInfo): string {
  if (index.name) {
    return index.name;
  }

  return Object.entries(index.key)
    .map(([field, direction]) => `${field}_${String(direction)}`)
    .join("_");
}

type RestorableIndex = {
  key: IndexDescriptionInfo["key"];
  name: string;
  options: CreateIndexesOptions;
};

function toRestorableIndex(index: IndexDescriptionInfo): RestorableIndex | null {
  if (index.name === "_id_") {
    return null;
  }

  const options: CreateIndexesOptions = {};

  if (index.name !== undefined) {
    options.name = index.name;
  }

  if (index.unique !== undefined) {
    options.unique = index.unique;
  }

  if (index.partialFilterExpression !== undefined) {
    options.partialFilterExpression = index.partialFilterExpression;
  }

  if (index.sparse !== undefined) {
    options.sparse = index.sparse;
  }

  if (index.hidden !== undefined) {
    options.hidden = index.hidden;
  }

  if (index.expireAfterSeconds !== undefined) {
    options.expireAfterSeconds = index.expireAfterSeconds;
  }

  if (index.weights !== undefined) {
    options.weights = index.weights;
  }

  if (index.default_language !== undefined) {
    options.default_language = index.default_language;
  }

  if (index.language_override !== undefined) {
    options.language_override = index.language_override;
  }

  if (index.textIndexVersion !== undefined) {
    options.textIndexVersion = index.textIndexVersion;
  }

  if (index["2dsphereIndexVersion"] !== undefined) {
    options["2dsphereIndexVersion"] = index["2dsphereIndexVersion"];
  }

  if (index.bits !== undefined) {
    options.bits = index.bits;
  }

  if (index.min !== undefined) {
    options.min = index.min;
  }

  if (index.max !== undefined) {
    options.max = index.max;
  }

  if (index.bucketSize !== undefined) {
    options.bucketSize = index.bucketSize;
  }

  if (index.wildcardProjection !== undefined) {
    options.wildcardProjection = index.wildcardProjection;
  }

  if (index.collation !== undefined) {
    options.collation = index.collation;
  }

  return {
    name: getIndexLabel(index),
    key: index.key,
    options,
  };
}

async function insertBatch(
  collection: Collection<Document>,
  batch: Document[],
  sourcePath: string
): Promise<number> {
  if (batch.length === 0) return 0;

  try {
    await collection.insertMany(batch, { ordered: true });
    return batch.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to import batch from ${sourcePath}: ${message}`);
  }
}

async function importDocuments(
  collection: Collection<Document>,
  documentsPath: string
): Promise<number> {
  const stream = createReadStream(documentsPath, { encoding: "utf8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let batch: Document[] = [];
  let importedCount = 0;

  for await (const line of reader) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    batch.push(EJSON.parse(trimmedLine, { relaxed: false }) as Document);

    if (batch.length >= BATCH_SIZE) {
      importedCount += await insertBatch(collection, batch, documentsPath);
      batch = [];
    }
  }

  importedCount += await insertBatch(collection, batch, documentsPath);
  return importedCount;
}

async function recreateIndexes(
  collection: Collection<Document>,
  indexesPath: string
): Promise<void> {
  const raw = await readFile(indexesPath, "utf8");
  const parsedIndexes = EJSON.parse(raw, { relaxed: false }) as IndexDescriptionInfo[];

  const restorableIndexes = parsedIndexes
    .map((index) => toRestorableIndex(index))
    .filter((index): index is RestorableIndex => index !== null);

  for (const index of restorableIndexes) {
    try {
      await collection.createIndex(index.key, index.options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to recreate index "${index.name}" for collection "${collection.collectionName}" from ${indexesPath}: ${message}`
      );
    }
  }
}

async function main() {
  const backupDir = getBackupDir();
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or MONGODB_URI must be provided.");
  }

  const dropCollections = shouldDropCollections();
  const client = new MongoClient(databaseUrl);

  try {
    await client.connect();

    const defaultDatabaseName = client.db().databaseName;
    const targetDatabaseName = getTargetDatabaseName(defaultDatabaseName);
    const db = client.db(targetDatabaseName);

    const existingCollections = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray())
        .map((collection) => collection.name)
        .filter((name): name is string => Boolean(name))
    );

    process.stdout.write(
      `Restoring backup from ${manifest.database} into ${targetDatabaseName}\n`
    );

    for (const exportedCollection of manifest.collections) {
      if (dropCollections && existingCollections.has(exportedCollection.name)) {
        await db.collection(exportedCollection.name).drop();
        existingCollections.delete(exportedCollection.name);
      }

      if (!existingCollections.has(exportedCollection.name)) {
        await db.createCollection(exportedCollection.name);
        existingCollections.add(exportedCollection.name);
      }

      const collection = db.collection<Document>(exportedCollection.name);
      const documentsPath = path.join(backupDir, exportedCollection.documentsFile);
      const indexesPath = path.join(backupDir, exportedCollection.indexesFile);

      const importedCount = await importDocuments(collection, documentsPath);
      await recreateIndexes(collection, indexesPath);

      process.stdout.write(
        `Imported ${exportedCollection.name}: ${importedCount} documents\n`
      );
    }

    process.stdout.write("Restore finished\n");
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
