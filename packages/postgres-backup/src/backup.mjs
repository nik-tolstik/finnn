import { createHash } from "node:crypto";
import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dumpPostgresToAge, ENCRYPTION_FORMAT } from "./age.mjs";
import { sha256File } from "./checksum.mjs";
import { buildObjectKey, loadConfig } from "./config.mjs";
import { createS3Client, uploadVerifiedBackup } from "./s3.mjs";

export async function runBackup({
  environment = process.env,
  now = new Date(),
  signal,
  temporaryRoot = tmpdir(),
  dumpAndEncrypt = dumpPostgresToAge,
  makeS3Client = createS3Client,
  upload = uploadVerifiedBackup,
  log = console.log,
} = {}) {
  const config = loadConfig(environment);
  const timeoutSignal = AbortSignal.timeout(config.jobTimeoutMs);
  const jobSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let temporaryDirectory;
  let client;

  try {
    temporaryDirectory = await mkdtemp(join(temporaryRoot, "finnn-postgres-backup-"));
    await chmod(temporaryDirectory, 0o700);
    const encryptedPath = join(temporaryDirectory, "finnn.dump.age");

    const { sourceSha256 } = await dumpAndEncrypt({
      databaseUrl: config.databaseUrl,
      ageRecipient: config.ageRecipient,
      outputPath: encryptedPath,
      timeoutMs: config.commandTimeoutMs,
      signal: jobSignal,
      parentEnvironment: environment,
    });

    const encryptedSha256 = await sha256File(encryptedPath, jobSignal);
    const encryptedBytes = (await stat(encryptedPath)).size;
    const createdAt = now.toISOString();
    const objectKey = buildObjectKey({ prefix: config.s3.prefix, environment: config.environment, now });

    const ageRecipientFingerprint = createHash("sha256").update(config.ageRecipient).digest("hex").slice(0, 16);
    client = makeS3Client(config.s3);
    const { manifestKey, manifestSha256 } = await upload({
      client,
      bucket: config.s3.bucket,
      objectKey,
      encryptedPath,
      encryptedBytes,
      encryptedSha256,
      sourceSha256,
      ageRecipientFingerprint,
      encryptionFormat: ENCRYPTION_FORMAT,
      createdAt,
      signal: jobSignal,
    });

    const result = {
      status: "complete",
      createdAt,
      bucket: config.s3.bucket,
      objectKey,
      encryptedBytes,
      encryptedSha256,
      sourceSha256,
      ageRecipientFingerprint,
      manifestKey,
      manifestSha256,
    };
    log(JSON.stringify(result));
    return result;
  } finally {
    client?.destroy?.();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
