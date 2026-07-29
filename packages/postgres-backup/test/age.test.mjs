import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { buildPgEnvironment, dumpPostgresToAge } from "../src/age.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  return child;
}

describe("streaming pg_dump through age", () => {
  it("keeps database credentials out of arguments and hashes the plaintext stream", async () => {
    const directory = await mkdtemp(join(tmpdir(), "finnn-age-test-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "backup.dump.age");
    const dump = Buffer.from("custom-format-postgresql-dump");
    const calls = [];

    const spawnImpl = (command, args, options) => {
      calls.push({ command, args, options });
      const child = fakeChild();

      if (command === "pg_dump") {
        child.stdout = Readable.from(dump);
        child.stdout.once("end", () => {
          child.exitCode = 0;
          child.emit("close", 0, null);
        });
        return child;
      }

      const chunks = [];
      child.stdin = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
        final(callback) {
          writeFile(outputPath, Buffer.concat(chunks)).then(() => {
            child.exitCode = 0;
            child.emit("close", 0, null);
            callback();
          }, callback);
        },
      });
      return child;
    };

    const result = await dumpPostgresToAge({
      databaseUrl: "postgresql://backup-user:p%40ssword@db.example:6543/finnn?sslmode=require&schema=public",
      ageRecipient: "age1publicrecipient",
      outputPath,
      timeoutMs: 5_000,
      parentEnvironment: {
        PATH: "/usr/bin",
        BACKUP_S3_SECRET_ACCESS_KEY: "must-not-leak",
        BACKUP_AGE_RECIPIENT: "age1publicrecipient",
      },
      spawnImpl,
    });

    expect(result.sourceSha256).toBe(createHash("sha256").update(dump).digest("hex"));
    expect(await readFile(outputPath)).toEqual(dump);
    expect(calls[0]).toMatchObject({
      command: "pg_dump",
      args: ["--format=custom", "--no-owner", "--no-privileges"],
    });
    expect(calls[0].args.join(" ")).not.toContain("p@ssword");
    expect(calls[0].options.env).toMatchObject({
      PGHOST: "db.example",
      PGPORT: "6543",
      PGDATABASE: "finnn",
      PGUSER: "backup-user",
      PGPASSWORD: "p@ssword",
      PGSSLMODE: "require",
    });
    expect(calls[0].options.env).not.toHaveProperty("BACKUP_S3_SECRET_ACCESS_KEY");
    expect(calls[1]).toMatchObject({
      command: "age",
      args: ["--encrypt", "--recipient", "age1publicrecipient", "--output", outputPath],
    });
    expect(calls[1].options.env).not.toHaveProperty("PGPASSWORD");
  });

  it("builds a minimal libpq environment", () => {
    expect(
      buildPgEnvironment("postgresql://user:password@db.example/finnn?sslmode=verify-full", {
        PATH: "/usr/bin",
        BACKUP_S3_SECRET_ACCESS_KEY: "secret",
      })
    ).toEqual({
      PATH: "/usr/bin",
      PGHOST: "db.example",
      PGPORT: "5432",
      PGDATABASE: "finnn",
      PGUSER: "user",
      PGPASSWORD: "password",
      PGSSLMODE: "verify-full",
    });
  });
});
