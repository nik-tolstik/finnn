import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { uploadVerifiedBackup } from "../src/s3.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function makeClient({ corruptPayloadDownload = false } = {}) {
  const objects = new Map();
  const calls = [];

  return {
    objects,
    calls,
    async send(command) {
      const name = command.constructor.name;
      const input = command.input;
      calls.push({ name, key: input.Key });

      if (name === "PutObjectCommand") {
        objects.set(input.Key, {
          body: await bodyToBuffer(input.Body),
          metadata: input.Metadata,
          contentType: input.ContentType,
        });
        return {};
      }

      if (name === "HeadObjectCommand") {
        const object = objects.get(input.Key);
        return { ContentLength: object.body.length, Metadata: object.metadata };
      }

      if (name === "GetObjectCommand") {
        const object = objects.get(input.Key);
        const body =
          corruptPayloadDownload && !input.Key.endsWith(".manifest.json") ? Buffer.from("corrupt") : object.body;
        return { Body: Readable.from(body) };
      }

      if (name === "DeleteObjectCommand") {
        objects.delete(input.Key);
        return {};
      }

      throw new Error(`Unexpected command ${name}`);
    },
  };
}

describe("verified object storage upload", () => {
  it("re-downloads the encrypted payload and uploads the completion manifest last", async () => {
    const client = makeClient();
    const encrypted = Buffer.from("encrypted-postgresql-dump");
    const directory = await mkdtemp(join(tmpdir(), "finnn-s3-test-"));
    temporaryDirectories.push(directory);
    const encryptedPath = join(directory, "backup.dump.age");
    await writeFile(encryptedPath, encrypted);
    const encryptedSha256 = createHash("sha256").update(encrypted).digest("hex");

    const result = await uploadVerifiedBackup({
      client,
      bucket: "bucket",
      objectKey: "postgresql/production/daily/2026/07/29/finnn.dump.age",
      encryptedPath,
      encryptedBytes: encrypted.length,
      encryptedSha256,
      sourceSha256: "a".repeat(64),
      ageRecipientFingerprint: "0123456789abcdef",
      encryptionFormat: "age-v1",
      createdAt: "2026-07-29T02:00:00.000Z",
    });

    expect(client.calls).toEqual([
      { name: "PutObjectCommand", key: "postgresql/production/daily/2026/07/29/finnn.dump.age" },
      { name: "HeadObjectCommand", key: "postgresql/production/daily/2026/07/29/finnn.dump.age" },
      { name: "GetObjectCommand", key: "postgresql/production/daily/2026/07/29/finnn.dump.age" },
      { name: "PutObjectCommand", key: result.manifestKey },
      { name: "HeadObjectCommand", key: result.manifestKey },
      { name: "GetObjectCommand", key: result.manifestKey },
    ]);
    const manifest = JSON.parse(client.objects.get(result.manifestKey).body.toString());
    expect(manifest).toMatchObject({
      status: "complete",
      object: { sha256: encryptedSha256 },
      source: { format: "postgresql-custom", sha256: "a".repeat(64) },
      encryption: { format: "age-v1", recipientFingerprint: "0123456789abcdef" },
    });
  });

  it("fails and removes an object whose re-downloaded checksum differs", async () => {
    const client = makeClient({ corruptPayloadDownload: true });
    const directory = await mkdtemp(join(tmpdir(), "finnn-s3-test-"));
    temporaryDirectories.push(directory);
    const encryptedPath = join(directory, "backup.dump.age");
    const encrypted = Buffer.from("encrypted-postgresql-dump");
    await writeFile(encryptedPath, encrypted);

    await expect(
      uploadVerifiedBackup({
        client,
        bucket: "bucket",
        objectKey: "backup.dump.age",
        encryptedPath,
        encryptedBytes: encrypted.length,
        encryptedSha256: createHash("sha256").update(encrypted).digest("hex"),
        sourceSha256: "a".repeat(64),
        ageRecipientFingerprint: "0123456789abcdef",
        encryptionFormat: "age-v1",
        createdAt: "2026-07-29T02:00:00.000Z",
      })
    ).rejects.toThrow("Re-downloaded object SHA-256 does not match");
    expect(client.objects.size).toBe(0);
    expect(client.calls.at(-1)).toEqual({ name: "DeleteObjectCommand", key: "backup.dump.age" });
  });
});
