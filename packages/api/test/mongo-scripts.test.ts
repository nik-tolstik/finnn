import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BSON, type Collection, type Document, ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getOutputDir } from "../scripts/mongo-export";
import {
  assertImportedCount,
  assertImportTargetAllowed,
  importDocuments,
  insertBatch,
  parseMongoImportArgs,
  toRestorableIndex,
} from "../scripts/mongo-import";

const { EJSON } = BSON;

describe("MongoDB import/export scripts", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
    tempDirs.length = 0;
  });

  it("builds explicit and timestamped export directories from CLI arguments", () => {
    expect(getOutputDir({ argv: ["node", "mongo-export.ts", "--", "./custom"], cwd: "/repo" })).toBe(
      path.resolve("./custom")
    );

    expect(
      getOutputDir({
        argv: ["node", "mongo-export.ts"],
        cwd: "/repo",
        now: new Date("2026-05-26T12:34:56.789Z"),
      })
    ).toBe("/repo/backups/mongo-2026-05-26T12-34-56-789Z");
  });

  it("parses import flags and blocks production imports unless explicitly allowed", () => {
    const args = parseMongoImportArgs(["node", "mongo-import.ts", "/tmp/backup", "--drop", "--db=finnn_restore"]);

    expect(args).toEqual({
      allowProduction: false,
      backupDir: "/tmp/backup",
      dropCollections: true,
      targetDatabaseName: "finnn_restore",
    });
    expect(() => assertImportTargetAllowed(args, { NODE_ENV: "production" })).toThrow(
      "Refusing to import into a production environment"
    );
    expect(() =>
      assertImportTargetAllowed({ ...args, allowProduction: true }, { NODE_ENV: "production" })
    ).not.toThrow();
  });

  it("restores MongoDB index metadata without recreating the _id index", () => {
    expect(toRestorableIndex({ key: { _id: 1 }, name: "_id_" } as never)).toBeNull();

    expect(
      toRestorableIndex({
        collation: { locale: "en", strength: 2 },
        key: { email: 1 },
        name: "email_unique",
        partialFilterExpression: { email: { $exists: true } },
        unique: true,
      } as never)
    ).toEqual({
      key: { email: 1 },
      name: "email_unique",
      options: {
        collation: { locale: "en", strength: 2 },
        name: "email_unique",
        partialFilterExpression: { email: { $exists: true } },
        unique: true,
      },
    });
  });

  it("imports JSONL documents as strict Extended JSON and writes ordered batches", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "finnn-import-"));
    tempDirs.push(tempDir);

    const firstId = new ObjectId();
    const documentsPath = path.join(tempDir, "users.jsonl");
    await writeFile(
      documentsPath,
      `${EJSON.stringify({ _id: firstId, email: "one@example.com" }, { relaxed: false })}\n\n${EJSON.stringify(
        { _id: new ObjectId(), email: "two@example.com" },
        { relaxed: false }
      )}\n`,
      "utf8"
    );

    const insertedDocuments: Document[][] = [];
    const collection = {
      insertMany: vi.fn(async (batch: Document[]) => {
        insertedDocuments.push(batch);
        return { insertedCount: batch.length };
      }),
    } as unknown as Collection<Document>;

    await expect(importDocuments(collection, documentsPath)).resolves.toBe(2);
    expect(collection.insertMany).toHaveBeenCalledWith(expect.any(Array), { ordered: true });
    expect(insertedDocuments[0][0]?._id).toEqual(firstId);
  });

  it("wraps batch import failures and verifies manifest counts", async () => {
    const collection = {
      insertMany: vi.fn(async () => {
        throw new Error("duplicate key");
      }),
    } as unknown as Collection<Document>;

    await expect(insertBatch(collection, [{ _id: "doc-1" }], "users.jsonl")).rejects.toThrow(
      "Failed to import batch from users.jsonl: duplicate key"
    );
    expect(() =>
      assertImportedCount(
        {
          count: 2,
          documentsFile: "users.jsonl",
          indexesFile: "users.indexes.json",
          name: "users",
        },
        1
      )
    ).toThrow("Imported users: expected 2 documents, got 1.");
  });
});
