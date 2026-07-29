import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runBackup } from "../src/backup.mjs";

const temporaryDirectories = [];

function validEnvironment() {
  return {
    BACKUP_DATABASE_URL: "postgresql://backup:secret@database.example:5432/finnn?sslmode=require",
    BACKUP_ENVIRONMENT: "production",
    BACKUP_AGE_RECIPIENT: "age1productionrecipient",
    BACKUP_S3_ENDPOINT: "https://t3.storageapi.dev",
    BACKUP_S3_REGION: "auto",
    BACKUP_S3_BUCKET: "generated-bucket-name",
    BACKUP_S3_ACCESS_KEY_ID: "access-key",
    BACKUP_S3_SECRET_ACCESS_KEY: "secret-key",
    BACKUP_JOB_TIMEOUT_MS: "5000",
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("backup orchestration", () => {
  it("uploads the encrypted artifact and always removes temporary files", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "finnn-backup-test-"));
    temporaryDirectories.push(temporaryRoot);
    const encrypted = Buffer.from("age-encrypted-custom-dump");
    const sourceSha256 = "a".repeat(64);
    const client = { destroy: vi.fn() };
    const upload = vi.fn().mockResolvedValue({
      manifestKey: "backup.dump.age.manifest.json",
      manifestSha256: "b".repeat(64),
    });
    const messages = [];

    const result = await runBackup({
      environment: validEnvironment(),
      now: new Date("2026-07-29T02:03:04.567Z"),
      temporaryRoot,
      dumpAndEncrypt: async ({ outputPath, ageRecipient }) => {
        expect(ageRecipient).toBe("age1productionrecipient");
        await writeFile(outputPath, encrypted, { mode: 0o600 });
        return { sourceSha256 };
      },
      makeS3Client: () => client,
      upload,
      log: (message) => messages.push(message),
    });

    const encryptedSha256 = createHash("sha256").update(encrypted).digest("hex");
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "generated-bucket-name",
        objectKey: "postgresql/production/daily/2026/07/29/finnn-20260729T020304567Z.dump.age",
        encryptedBytes: encrypted.length,
        encryptedSha256,
        sourceSha256,
        encryptionFormat: "age-v1",
      })
    );
    expect(result).toMatchObject({ status: "complete", encryptedSha256, sourceSha256 });
    expect(JSON.parse(messages[0])).toMatchObject({ status: "complete", encryptedSha256 });
    expect(await readdir(temporaryRoot)).toEqual([]);
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  it("aborts the whole job at the configured hard timeout and cleans up", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "finnn-backup-timeout-test-"));
    temporaryDirectories.push(temporaryRoot);

    await expect(
      runBackup({
        environment: { ...validEnvironment(), BACKUP_JOB_TIMEOUT_MS: "20" },
        temporaryRoot,
        dumpAndEncrypt: ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          }),
        log: () => {},
      })
    ).rejects.toThrow("aborted");
    expect(await readdir(temporaryRoot)).toEqual([]);
  });
});
