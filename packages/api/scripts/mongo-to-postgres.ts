import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { type ClientSession, type Db, type Document, MongoClient } from "mongodb";

import {
  canonicalRecord,
  type FinancialInvariantInput,
  getUniqueKey,
  MIGRATION_MODELS,
  type MigrationModelSpec,
  toLegacyId,
  transformMongoDocument,
  validateFinancialInvariants,
} from "./mongo-to-postgres-models";

const DEFAULT_BATCH_SIZE = 1000;
const MAX_REPORTED_ISSUES = 100;

export type MongoToPostgresCliArgs = {
  allowProduction: boolean;
  batchSize: number;
  dryRun: boolean;
  useSnapshot: boolean;
};

export type MigrationUrls = {
  sourceUrl: string;
  targetUrl: string;
};

type PrismaDelegate = {
  count(): Promise<number>;
  createMany(args: { data: Record<string, unknown>[]; skipDuplicates: boolean }): Promise<{ count: number }>;
  findMany(args: {
    cursor?: { id: string };
    orderBy: { id: "asc" };
    select: Record<string, true>;
    skip?: number;
    take: number;
  }): Promise<Record<string, unknown>[]>;
};

type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  [delegate: string]: unknown;
};

type ModelAudit = {
  count: number;
  digest: string;
  ids: Set<string>;
  rowDigests: Map<string, string>;
  skippedIds: Set<string>;
};

type SourceAudit = {
  models: Map<string, ModelAudit>;
  issueCount: number;
  issues: string[];
  warningCount: number;
  warnings: string[];
};

type TargetAudit = {
  count: number;
  digest: string;
  rowDigests: Map<string, string>;
};

type MigrationModelReport = {
  model: string;
  source: number;
  targetBefore: number;
  inserted: number;
  targetAfter: number;
  digest: string;
};

export type MigrationReport = {
  dryRun: boolean;
  models: MigrationModelReport[];
};

type RunMigrationOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  createMongoClient?: (sourceUrl: string) => MongoClient;
  createPrismaClient?: (targetUrl: string) => PrismaClientLike;
};

class AuditMessages {
  count = 0;
  readonly messages: string[] = [];

  add(message: string): void {
    this.count += 1;
    if (this.messages.length < MAX_REPORTED_ISSUES) this.messages.push(message);
  }
}

export function parseMongoToPostgresArgs(argv = process.argv): MongoToPostgresCliArgs {
  let batchSize = DEFAULT_BATCH_SIZE;
  let allowProduction = false;
  let dryRun = false;
  let useSnapshot = true;

  for (const arg of argv.slice(2)) {
    if (arg === "--") continue;
    if (arg === "--allow-production") {
      allowProduction = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--no-snapshot") {
      useSnapshot = false;
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      const rawBatchSize = arg.slice("--batch-size=".length);
      batchSize = Number(rawBatchSize);
      if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
        throw new Error("--batch-size must be an integer between 1 and 10000.");
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { allowProduction, batchSize, dryRun, useSnapshot };
}

export function getMigrationUrls(env: NodeJS.ProcessEnv = process.env): MigrationUrls {
  const sourceUrl = env.MONGODB_SOURCE_URL?.trim() ?? "";
  const targetUrl = env.DATABASE_URL?.trim() ?? "";

  if (!sourceUrl) throw new Error("MONGODB_SOURCE_URL must be provided.");
  if (!targetUrl) throw new Error("DATABASE_URL must be provided for the PostgreSQL target.");

  let sourceProtocol: string;
  let targetProtocol: string;
  try {
    sourceProtocol = new URL(sourceUrl).protocol;
  } catch {
    throw new Error("MONGODB_SOURCE_URL must be a valid URL.");
  }
  try {
    targetProtocol = new URL(targetUrl).protocol;
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }

  if (sourceProtocol !== "mongodb:" && sourceProtocol !== "mongodb+srv:") {
    throw new Error("MONGODB_SOURCE_URL must use mongodb:// or mongodb+srv://.");
  }
  if (targetProtocol !== "postgres:" && targetProtocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql:// for the migration target.");
  }

  return { sourceUrl, targetUrl };
}

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  const values = [env.NODE_ENV, env.RAILWAY_ENVIRONMENT_NAME, env.RAILWAY_ENVIRONMENT, env.VERCEL_ENV];
  return values.some((value) => {
    const normalized = value?.trim().toLowerCase();
    return normalized === "production" || normalized === "prod";
  });
}

export function assertProductionMigrationAllowed(
  args: Pick<MongoToPostgresCliArgs, "allowProduction">,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (isProductionEnvironment(env) && !args.allowProduction) {
    throw new Error("Refusing to migrate into a production environment without --allow-production.");
  }
}

function getDelegate(prisma: PrismaClientLike, spec: MigrationModelSpec): PrismaDelegate {
  const delegate = prisma[spec.delegate] as PrismaDelegate | undefined;
  if (!delegate || typeof delegate.count !== "function" || typeof delegate.createMany !== "function") {
    throw new Error(`Generated Prisma client does not expose the ${spec.delegate} delegate.`);
  }
  return delegate;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function getStableDigest(rowDigests: ReadonlyMap<string, string>): string {
  const hash = createHash("sha256");
  for (const [id, digest] of [...rowDigests.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(id);
    hash.update(":");
    hash.update(digest);
    hash.update("\n");
  }
  return hash.digest("hex");
}

function getRowDigest(record: Record<string, unknown>, spec: MigrationModelSpec): string {
  return sha256(canonicalRecord(record, spec));
}

function formatDocumentIssue(spec: MigrationModelSpec, documentId: string, field: string | undefined, message: string) {
  const location = field ? `${spec.collection}.${field}` : spec.collection;
  return `${location} (${documentId}): ${message}`;
}

export function isDiscardableOrphanAuthSession(record: Record<string, unknown>, now = new Date()): boolean {
  return record.revokedAt instanceof Date || (record.expiresAt instanceof Date && record.expiresAt <= now);
}

async function auditSource(
  db: Db,
  session: ClientSession | undefined,
  batchSize: number,
  specs: readonly MigrationModelSpec[] = MIGRATION_MODELS
): Promise<SourceAudit> {
  const issues = new AuditMessages();
  const warnings = new AuditMessages();
  const auditCutoff = new Date();
  const models = new Map<string, ModelAudit>();
  const transformedRecords = new Map<string, Map<string, Record<string, unknown>>>();
  const financialRecords = {
    accounts: [] as Record<string, unknown>[],
    debtTransactions: [] as Record<string, unknown>[],
    debts: [] as Record<string, unknown>[],
    legacyDebtAccountIds: new Map<string, string>(),
    paymentTransactions: [] as Record<string, unknown>[],
    transfers: [] as Record<string, unknown>[],
  } satisfies FinancialInvariantInput;
  const knownCollections = new Set(specs.map((spec) => spec.collection));
  const collectionMetadata = await db.listCollections({}, { nameOnly: true }).toArray();

  for (const metadata of collectionMetadata) {
    const collectionName = metadata.name;
    if (!collectionName || collectionName.startsWith("system.") || knownCollections.has(collectionName)) continue;
    const count = await db.collection(collectionName).countDocuments({}, { session });
    if (count > 0) {
      issues.add(`Unknown source collection ${collectionName} contains ${count} documents and would not be migrated.`);
    }
  }

  for (const spec of specs) {
    const ids = new Set<string>();
    const collection = db.collection<Document>(spec.collection);
    const cursor = collection.find({}, { projection: { _id: 1 }, session }).batchSize(batchSize);
    let count = 0;

    for await (const document of cursor) {
      count += 1;
      const documentId = toLegacyId(document._id);
      if (!documentId) {
        issues.add(`${spec.collection} document #${count}: _id must be a 24-character ObjectId.`);
      } else if (ids.has(documentId)) {
        issues.add(`${spec.collection} (${documentId}): duplicate _id.`);
      } else {
        ids.add(documentId);
      }
    }

    models.set(spec.model, { count, digest: "", ids, rowDigests: new Map(), skippedIds: new Set() });
  }

  const references: Array<{ documentId: string; field: string; model: string; targetModel: string; value: string }> =
    [];

  for (const spec of specs) {
    const audit = models.get(spec.model);
    if (!audit) throw new Error(`Missing audit state for ${spec.model}.`);

    const uniqueValues = (spec.unique ?? []).map(() => new Map<string, string>());
    const collection = db.collection<Document>(spec.collection);
    const cursor = collection.find({}, { session }).sort({ _id: 1 }).batchSize(batchSize);

    for await (const document of cursor) {
      const documentId = toLegacyId(document._id) ?? "invalid-id";
      const transformed = transformMongoDocument(spec, document);

      for (const issue of transformed.issues) {
        issues.add(formatDocumentIssue(spec, documentId, issue.field, issue.message));
      }
      for (const warning of transformed.warnings) {
        warnings.add(formatDocumentIssue(spec, documentId, warning.field, warning.message));
      }
      if (transformed.issues.length > 0) continue;

      audit.rowDigests.set(documentId, getRowDigest(transformed.data, spec));
      const records = transformedRecords.get(spec.model) ?? new Map<string, Record<string, unknown>>();
      records.set(documentId, transformed.data);
      transformedRecords.set(spec.model, records);

      if (spec.model === "Account") financialRecords.accounts.push(transformed.data);
      if (spec.model === "Debt") {
        financialRecords.debts.push(transformed.data);
        const legacyAccountId = toLegacyId(document.accountId);
        if (legacyAccountId) financialRecords.legacyDebtAccountIds.set(documentId, legacyAccountId);
      }
      if (spec.model === "DebtTransaction") financialRecords.debtTransactions.push(transformed.data);
      if (spec.model === "PaymentTransaction") financialRecords.paymentTransactions.push(transformed.data);
      if (spec.model === "TransferTransaction") financialRecords.transfers.push(transformed.data);

      for (const [index, unique] of (spec.unique ?? []).entries()) {
        const key = getUniqueKey(transformed.data, unique);
        if (key === null) continue;
        const previousId = uniqueValues[index]?.get(key);
        if (previousId) {
          issues.add(
            `${spec.collection} (${documentId}): duplicate unique key (${unique.fields.join(", ")}); first seen in ${previousId}.`
          );
        } else {
          uniqueValues[index]?.set(key, documentId);
        }
      }

      for (const reference of spec.references ?? []) {
        const value = transformed.data[reference.field];
        if (typeof value === "string") {
          references.push({
            documentId,
            field: reference.field,
            model: spec.model,
            targetModel: reference.targetModel,
            value,
          });
        }
      }
    }
  }

  for (const reference of references) {
    const target = models.get(reference.targetModel);
    if (!target?.ids.has(reference.value)) {
      const source = models.get(reference.model);
      const record = transformedRecords.get(reference.model)?.get(reference.documentId);
      if (
        reference.model === "AuthSession" &&
        reference.field === "userId" &&
        source &&
        record &&
        isDiscardableOrphanAuthSession(record, auditCutoff)
      ) {
        if (!source.skippedIds.has(reference.documentId)) {
          source.skippedIds.add(reference.documentId);
          warnings.add(
            `AuthSession (${reference.documentId}) references a missing user and is expired or revoked; skipping it.`
          );
        }
        continue;
      }

      issues.add(
        `${reference.model} (${reference.documentId}): ${reference.field} references missing ${reference.targetModel} ${reference.value}.`
      );
    }
  }

  for (const audit of models.values()) {
    for (const documentId of audit.skippedIds) {
      audit.ids.delete(documentId);
      audit.rowDigests.delete(documentId);
      audit.count -= 1;
    }
    audit.digest = getStableDigest(audit.rowDigests);
  }

  const financialInvariants = validateFinancialInvariants(financialRecords);
  for (const issue of financialInvariants.issues) issues.add(issue);
  for (const warning of financialInvariants.warnings) warnings.add(warning);

  return {
    issueCount: issues.count,
    issues: issues.messages,
    models,
    warningCount: warnings.count,
    warnings: warnings.messages,
  };
}

async function readTargetAudit(
  prisma: PrismaClientLike,
  spec: MigrationModelSpec,
  batchSize: number
): Promise<TargetAudit> {
  const delegate = getDelegate(prisma, spec);
  const select = Object.fromEntries(spec.fields.map((field) => [field.name, true] as const));
  const rowDigests = new Map<string, string>();
  let cursor: string | undefined;

  while (true) {
    const records = await delegate.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select,
      take: batchSize,
    });
    if (records.length === 0) break;

    for (const record of records) {
      const id = record.id;
      if (typeof id !== "string") throw new Error(`${spec.model} target row has a non-string id.`);
      rowDigests.set(id, getRowDigest(record, spec));
    }

    const finalId = records.at(-1)?.id;
    if (typeof finalId !== "string") throw new Error(`${spec.model} target pagination returned a non-string id.`);
    cursor = finalId;
  }

  const count = await delegate.count();
  if (count !== rowDigests.size) {
    throw new Error(`${spec.model} target changed during validation: count=${count}, scanned=${rowDigests.size}.`);
  }

  return { count, digest: getStableDigest(rowDigests), rowDigests };
}

function compareTargetWithSource(
  spec: MigrationModelSpec,
  source: ModelAudit,
  target: TargetAudit,
  requireComplete: boolean
): string[] {
  const issues: string[] = [];

  for (const [id, targetDigest] of target.rowDigests) {
    const sourceDigest = source.rowDigests.get(id);
    if (!sourceDigest) {
      issues.push(`${spec.model} target contains id ${id}, which is absent from the MongoDB source.`);
    } else if (sourceDigest !== targetDigest) {
      issues.push(`${spec.model} target row ${id} differs from the MongoDB source.`);
    }
  }

  if (requireComplete) {
    for (const id of source.rowDigests.keys()) {
      if (!target.rowDigests.has(id)) issues.push(`${spec.model} target is missing source row ${id}.`);
    }
    if (source.count !== target.count) {
      issues.push(`${spec.model} count mismatch: source=${source.count}, target=${target.count}.`);
    }
    if (source.digest !== target.digest) {
      issues.push(`${spec.model} digest mismatch: source=${source.digest}, target=${target.digest}.`);
    }
  }

  return issues;
}

function formatAuditFailure(title: string, issueCount: number, issues: readonly string[]): Error {
  const omitted = issueCount - issues.length;
  const suffix = omitted > 0 ? `\n... ${omitted} additional issue(s) omitted.` : "";
  return new Error(`${title} failed with ${issueCount} issue(s):\n${issues.join("\n")}${suffix}`);
}

async function migrateModel(
  db: Db,
  session: ClientSession | undefined,
  prisma: PrismaClientLike,
  spec: MigrationModelSpec,
  batchSize: number,
  skippedIds: ReadonlySet<string>
): Promise<number> {
  const delegate = getDelegate(prisma, spec);
  const collection = db.collection<Document>(spec.collection);
  const cursor = collection.find({}, { session }).sort({ _id: 1 }).batchSize(batchSize);
  let batch: Record<string, unknown>[] = [];
  let inserted = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await delegate.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
    batch = [];
  };

  for await (const document of cursor) {
    const documentId = toLegacyId(document._id);
    if (documentId && skippedIds.has(documentId)) continue;

    const transformed = transformMongoDocument(spec, document);
    if (transformed.issues.length > 0) {
      throw new Error(`${spec.model} source changed after preflight validation; aborting before the next batch.`);
    }

    const data = Object.fromEntries(
      spec.fields.flatMap((field) => {
        const value = transformed.data[field.name];
        if (field.kind === "json" && value === null) return [];
        return [[field.name, value] as const];
      })
    );
    batch.push(data);

    if (batch.length >= batchSize) await flush();
  }

  await flush();
  return inserted;
}

function writeAuditMessages(
  stdout: Pick<NodeJS.WriteStream, "write">,
  label: string,
  count: number,
  messages: readonly string[]
): void {
  if (count === 0) return;
  stdout.write(`${label}: ${count}\n`);
  for (const message of messages) stdout.write(`  - ${message}\n`);
  if (count > messages.length) stdout.write(`  - ... ${count - messages.length} additional item(s) omitted\n`);
}

export async function runMongoToPostgresMigration(options: RunMigrationOptions = {}): Promise<MigrationReport> {
  const args = parseMongoToPostgresArgs(options.argv);
  const env = options.env ?? process.env;
  assertProductionMigrationAllowed(args, env);
  const { sourceUrl, targetUrl } = getMigrationUrls(env);
  const stdout = options.stdout ?? process.stdout;
  const mongo = options.createMongoClient?.(sourceUrl) ?? new MongoClient(sourceUrl);
  const prisma =
    options.createPrismaClient?.(targetUrl) ??
    (new PrismaClient({ datasourceUrl: targetUrl }) as unknown as PrismaClientLike);
  let session: ClientSession | undefined;

  try {
    await Promise.all([mongo.connect(), prisma.$connect()]);
    const db = mongo.db();

    if (args.useSnapshot) {
      session = mongo.startSession();
      session.startTransaction({ readConcern: { level: "snapshot" } });
      stdout.write("Using a MongoDB snapshot transaction\n");
    } else {
      stdout.write("WARNING: snapshot disabled; source writes must remain stopped for the entire migration\n");
    }

    stdout.write("Running MongoDB source preflight\n");
    const sourceAudit = await auditSource(db, session, args.batchSize);
    writeAuditMessages(stdout, "Preflight warnings", sourceAudit.warningCount, sourceAudit.warnings);
    if (sourceAudit.issueCount > 0) {
      throw formatAuditFailure("MongoDB source preflight", sourceAudit.issueCount, sourceAudit.issues);
    }

    const targetBefore = new Map<string, TargetAudit>();
    const targetIssues: string[] = [];
    for (const spec of MIGRATION_MODELS) {
      const source = sourceAudit.models.get(spec.model);
      if (!source) throw new Error(`Missing source audit for ${spec.model}.`);
      const target = await readTargetAudit(prisma, spec, args.batchSize);
      targetBefore.set(spec.model, target);
      targetIssues.push(...compareTargetWithSource(spec, source, target, false));
      stdout.write(`Preflight ${spec.model}: source=${source.count}, target=${target.count}\n`);
    }
    if (targetIssues.length > 0) {
      throw formatAuditFailure("PostgreSQL target preflight", targetIssues.length, targetIssues.slice(0, 100));
    }

    if (args.dryRun) {
      if (session) await session.commitTransaction();
      stdout.write("Dry run finished; no PostgreSQL rows were written\n");
      return {
        dryRun: true,
        models: MIGRATION_MODELS.map((spec) => {
          const source = sourceAudit.models.get(spec.model);
          const target = targetBefore.get(spec.model);
          if (!source || !target) throw new Error(`Missing dry-run audit for ${spec.model}.`);
          return {
            digest: source.digest,
            inserted: 0,
            model: spec.model,
            source: source.count,
            targetAfter: target.count,
            targetBefore: target.count,
          };
        }),
      };
    }

    const reports: MigrationModelReport[] = [];
    for (const spec of MIGRATION_MODELS) {
      const source = sourceAudit.models.get(spec.model);
      const before = targetBefore.get(spec.model);
      if (!source || !before) throw new Error(`Missing migration audit for ${spec.model}.`);

      const inserted = await migrateModel(db, session, prisma, spec, args.batchSize, source.skippedIds);
      const after = await readTargetAudit(prisma, spec, args.batchSize);
      const validationIssues = compareTargetWithSource(spec, source, after, true);
      if (validationIssues.length > 0) {
        throw formatAuditFailure(`${spec.model} post-import validation`, validationIssues.length, validationIssues);
      }

      const report: MigrationModelReport = {
        digest: after.digest,
        inserted,
        model: spec.model,
        source: source.count,
        targetAfter: after.count,
        targetBefore: before.count,
      };
      reports.push(report);
      stdout.write(
        `Migrated ${spec.model}: source=${report.source}, before=${report.targetBefore}, inserted=${report.inserted}, after=${report.targetAfter}, sha256=${report.digest}\n`
      );
    }

    if (session) await session.commitTransaction();
    stdout.write("MongoDB to PostgreSQL migration and validation finished\n");
    return { dryRun: false, models: reports };
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
    await Promise.allSettled([mongo.close(), prisma.$disconnect()]);
  }
}

if (require.main === module) {
  runMongoToPostgresMigration().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
