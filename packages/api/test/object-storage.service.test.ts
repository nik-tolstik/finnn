import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSignedUrlMock, sendMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: class {},
  GetObjectCommand: class {},
  PutObjectCommand: class {},
  S3Client: class {
    send = sendMock;
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { ObjectStorageService } from "../src/storage/object-storage.service";

const originalEnv = { ...process.env };

describe("ObjectStorageService", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AVATAR_BUCKET: "test-bucket",
      AVATAR_BUCKET_ACCESS_KEY_ID: "test-access-key",
      AVATAR_BUCKET_SECRET_ACCESS_KEY: "test-secret-key",
      AVATAR_BUCKET_ENDPOINT: "https://storage.example.test",
    };
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("maps S3 command failures to service unavailable", async () => {
    sendMock.mockRejectedValueOnce(new Error("S3 is unavailable"));

    await expect(
      new ObjectStorageService().upload({
        key: "category-icons/workspace/icon.png",
        buffer: Buffer.from("icon"),
        contentType: "image/png",
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("maps presigned URL failures to service unavailable", async () => {
    getSignedUrlMock.mockRejectedValueOnce(new Error("S3 is unavailable"));

    await expect(new ObjectStorageService().getReadUrl("category-icons/workspace/icon.png")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("preserves existing HTTP exceptions", async () => {
    const error = new BadRequestException("Storage request is invalid");
    sendMock.mockRejectedValueOnce(error);

    await expect(new ObjectStorageService().delete("category-icons/workspace/icon.png")).rejects.toBe(error);
  });
});
