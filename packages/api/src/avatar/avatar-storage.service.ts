import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const DEFAULT_AVATAR_PRESIGNED_URL_TTL_SECONDS = 3600;

type AvatarStorageConfig = {
  bucket: string;
  client: S3Client;
  ttlSeconds: number;
};

export type AvatarUploadInput = {
  userId: string;
  buffer: Buffer;
  contentType: string;
};

function getBooleanEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function getPositiveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getExtensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

@Injectable()
export class AvatarStorageService {
  async upload(input: AvatarUploadInput): Promise<string> {
    const config = this.getConfig();
    const key = `avatars/${input.userId}/${randomUUID()}.${getExtensionForContentType(input.contentType)}`;

    await config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      })
    );

    return key;
  }

  async delete(key: string): Promise<void> {
    const config = this.getConfig();
    await config.client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
  }

  async getReadUrl(key: string): Promise<string> {
    const config = this.getConfig();
    return getSignedUrl(
      config.client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
      { expiresIn: config.ttlSeconds }
    );
  }

  private getConfig(): AvatarStorageConfig {
    const bucket = process.env.AVATAR_BUCKET?.trim();
    const accessKeyId = process.env.AVATAR_BUCKET_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AVATAR_BUCKET_SECRET_ACCESS_KEY?.trim();
    const region = process.env.AVATAR_BUCKET_REGION?.trim() || "auto";
    const endpoint = process.env.AVATAR_BUCKET_ENDPOINT?.trim();

    if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new ServiceUnavailableException("Avatar storage is not configured");
    }

    return {
      bucket,
      client: new S3Client({
        region,
        endpoint,
        forcePathStyle: getBooleanEnv(process.env.AVATAR_BUCKET_FORCE_PATH_STYLE),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }),
      ttlSeconds: getPositiveIntegerEnv(
        process.env.AVATAR_PRESIGNED_URL_TTL_SECONDS,
        DEFAULT_AVATAR_PRESIGNED_URL_TTL_SECONDS
      ),
    };
  }
}
