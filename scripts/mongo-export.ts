import "../src/shared/lib/load-env";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BSON, MongoClient, type Document } from "mongodb";

const { EJSON } = BSON;

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

function getOutputDir(): string {
  const cliArg = process.argv[2]?.trim();
  if (cliArg) return path.resolve(cliArg);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "backups", `mongo-${stamp}`);
}

async function writeJsonLine(
  stream: ReturnType<typeof createWriteStream>,
  document: Document
): Promise<void> {
  const payload = `${EJSON.stringify(document, { relaxed: false })}\n`;

  if (!stream.write(payload)) {
    await once(stream, "drain");
  }
}

async function exportCollection(
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
  await writeFile(
    indexesPath,
    EJSON.stringify(indexes, { relaxed: false }, 2),
    "utf8"
  );

  return {
    name: collectionName,
    documentsFile,
    indexesFile,
    count,
  };
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or MONGODB_URI must be provided.");
  }

  const outputDir = getOutputDir();
  await mkdir(outputDir, { recursive: true });

  const client = new MongoClient(databaseUrl);

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
      exportedAt: new Date().toISOString(),
      collections: [],
    };

    for (const collectionName of collectionNames) {
      const exported = await exportCollection(
        client,
        databaseName,
        outputDir,
        collectionName
      );
      manifest.collections.push(exported);
      process.stdout.write(
        `Exported ${collectionName}: ${exported.count} documents\n`
      );
    }

    await writeFile(
      path.join(outputDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    process.stdout.write(`Backup saved to ${outputDir}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
