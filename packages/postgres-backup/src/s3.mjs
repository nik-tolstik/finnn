import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function send(client, command, signal) {
  return client.send(command, signal ? { abortSignal: signal } : undefined);
}

async function sha256Body(body, signal) {
  if (!body) {
    throw new Error("Object storage returned an empty response body during verification");
  }

  const hash = createHash("sha256");
  const abortBody = () => {
    body.destroy?.(new Error("Object download verification was aborted"));
    const cancellation = body.cancel?.();
    cancellation?.catch(() => {});
  };
  signal?.addEventListener("abort", abortBody, { once: true });

  try {
    if (signal?.aborted) {
      abortBody();
      throw new Error("Object download verification was aborted");
    }
    for await (const chunk of body) {
      hash.update(chunk);
    }
  } finally {
    signal?.removeEventListener("abort", abortBody);
  }
  return hash.digest("hex");
}

async function verifyObject({ client, bucket, key, expectedBytes, expectedSha256, signal }) {
  const head = await send(client, new HeadObjectCommand({ Bucket: bucket, Key: key }), signal);

  if (head.ContentLength !== expectedBytes) {
    throw new Error(`Uploaded object has ${head.ContentLength} bytes; expected ${expectedBytes}`);
  }

  if (head.Metadata?.sha256 !== expectedSha256) {
    throw new Error("Uploaded object SHA-256 metadata does not match the local checksum");
  }

  const downloaded = await send(client, new GetObjectCommand({ Bucket: bucket, Key: key }), signal);
  const downloadedSha256 = await sha256Body(downloaded.Body, signal);
  if (downloadedSha256 !== expectedSha256) {
    throw new Error("Re-downloaded object SHA-256 does not match the local checksum");
  }
}

async function deleteQuietly(client, bucket, key) {
  try {
    await send(client, new DeleteObjectCommand({ Bucket: bucket, Key: key }), AbortSignal.timeout(10_000));
  } catch {
    // The original upload or verification error remains the actionable failure.
  }
}

export function createS3Client(config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadVerifiedBackup({
  client,
  bucket,
  objectKey,
  encryptedPath,
  encryptedBytes,
  encryptedSha256,
  sourceSha256,
  ageRecipientFingerprint,
  encryptionFormat,
  createdAt,
  signal,
}) {
  const manifestKey = `${objectKey}.manifest.json`;
  let payloadAttempted = false;
  let manifestAttempted = false;

  try {
    payloadAttempted = true;
    await send(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: createReadStream(encryptedPath),
        ContentLength: encryptedBytes,
        ContentType: "application/octet-stream",
        Metadata: {
          sha256: encryptedSha256,
          "source-sha256": sourceSha256,
          encryption: encryptionFormat,
          "age-recipient-fingerprint": ageRecipientFingerprint,
          "dump-format": "postgresql-custom",
          "created-at": createdAt,
        },
      }),
      signal
    );
    await verifyObject({
      client,
      bucket,
      key: objectKey,
      expectedBytes: encryptedBytes,
      expectedSha256: encryptedSha256,
      signal,
    });

    const manifest = Buffer.from(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          status: "complete",
          createdAt,
          object: {
            bucket,
            key: objectKey,
            bytes: encryptedBytes,
            sha256: encryptedSha256,
          },
          source: {
            format: "postgresql-custom",
            sha256: sourceSha256,
          },
          encryption: {
            format: encryptionFormat,
            recipientFingerprint: ageRecipientFingerprint,
          },
        },
        null,
        2
      )}\n`
    );
    const manifestSha256 = createHash("sha256").update(manifest).digest("hex");

    manifestAttempted = true;
    await send(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: manifestKey,
        Body: manifest,
        ContentLength: manifest.length,
        ContentType: "application/json",
        Metadata: {
          sha256: manifestSha256,
          "backup-sha256": encryptedSha256,
        },
      }),
      signal
    );
    await verifyObject({
      client,
      bucket,
      key: manifestKey,
      expectedBytes: manifest.length,
      expectedSha256: manifestSha256,
      signal,
    });

    return { manifestKey, manifestSha256 };
  } catch (error) {
    if (manifestAttempted) {
      await deleteQuietly(client, bucket, manifestKey);
    }
    if (payloadAttempted) {
      await deleteQuietly(client, bucket, objectKey);
    }
    throw error;
  }
}

export { sha256Body, verifyObject };
