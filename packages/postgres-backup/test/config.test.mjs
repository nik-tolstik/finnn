import { describe, expect, it } from "vitest";

import { buildObjectKey, loadConfig } from "../src/config.mjs";

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
  };
}

describe("backup configuration", () => {
  it("uses virtual-host-compatible addressing by default", () => {
    const config = loadConfig(validEnvironment());

    expect(config.s3).toMatchObject({
      endpoint: "https://t3.storageapi.dev",
      region: "auto",
      bucket: "generated-bucket-name",
      forcePathStyle: false,
      prefix: "postgresql",
    });
    expect(config.jobTimeoutMs).toBe(45 * 60 * 1000);
  });

  it("creates a timestamped production daily key", () => {
    expect(
      buildObjectKey({
        prefix: "postgresql",
        environment: "production",
        now: new Date("2026-07-29T02:03:04.567Z"),
      })
    ).toBe("postgresql/production/daily/2026/07/29/finnn-20260729T020304567Z.dump.age");
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => loadConfig({ ...validEnvironment(), BACKUP_DATABASE_URL: "mongodb://database/finnn" })).toThrow(
      "must use the postgresql:// or postgres:// scheme"
    );
  });

  it("rejects multiple age recipients in one variable", () => {
    expect(() => loadConfig({ ...validEnvironment(), BACKUP_AGE_RECIPIENT: "age1first\nage1second" })).toThrow(
      "must contain exactly one recipient"
    );
  });
});
