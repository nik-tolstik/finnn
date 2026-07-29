import { describe, expect, it } from "vitest";

import { sanitizedErrorMessage } from "../src/index.mjs";

describe("backup error reporting", () => {
  it("redacts database and object-storage credentials", () => {
    const environment = {
      BACKUP_DATABASE_URL: "postgresql://backup:p%40ssword@database.example/finnn",
      BACKUP_S3_ACCESS_KEY_ID: "access-key",
      BACKUP_S3_SECRET_ACCESS_KEY: "storage-secret",
    };
    const message = sanitizedErrorMessage(
      new Error("postgresql://backup:p%40ssword@database.example/finnn p@ssword storage-secret"),
      environment
    );

    expect(message).not.toContain("p%40ssword");
    expect(message).not.toContain("p@ssword");
    expect(message).not.toContain("storage-secret");
    expect(message).toContain("[REDACTED]");
  });
});
