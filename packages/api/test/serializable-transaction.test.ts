import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { isPrismaTransactionConflict, runSerializableTransaction } from "../src/prisma/serializable-transaction";

function createTransactionHost(transaction: Prisma.TransactionClient) {
  return {
    $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>, _options: unknown) =>
      callback(transaction)
    ),
  };
}

describe("runSerializableTransaction", () => {
  it("runs an interactive transaction at Serializable isolation", async () => {
    const transaction = { account: {} } as Prisma.TransactionClient;
    const client = createTransactionHost(transaction);
    const callback = vi.fn(async (tx: Prisma.TransactionClient) => tx);

    await expect(runSerializableTransaction(client, callback, { retryDelayMs: 0 })).resolves.toBe(transaction);

    expect(callback).toHaveBeenCalledWith(transaction);
    expect(client.$transaction).toHaveBeenCalledWith(callback, {
      isolationLevel: "Serializable",
      maxWait: undefined,
      timeout: undefined,
    });
  });

  it("retries P2034 conflicts and reruns the complete callback", async () => {
    const transaction = {} as Prisma.TransactionClient;
    const callback = vi.fn(async () => "committed");
    const conflict = { code: "P2034" };
    const client = createTransactionHost(transaction);
    let attempts = 0;
    client.$transaction.mockImplementation(async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      attempts += 1;
      const result = await run(transaction);
      if (attempts <= 2) throw conflict;
      return result;
    });

    await expect(runSerializableTransaction(client, callback, { maxRetries: 2, retryDelayMs: 0 })).resolves.toBe(
      "committed"
    );

    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("throws the last P2034 conflict after the retry budget is exhausted", async () => {
    const conflict = { code: "P2034" };
    const client = createTransactionHost({} as Prisma.TransactionClient);
    client.$transaction.mockRejectedValue(conflict);

    await expect(
      runSerializableTransaction(client, async () => undefined, { maxRetries: 2, retryDelayMs: 0 })
    ).rejects.toBe(conflict);

    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors other than P2034", async () => {
    const error = new Error("business validation failed");
    const client = createTransactionHost({} as Prisma.TransactionClient);
    client.$transaction.mockRejectedValue(error);

    await expect(runSerializableTransaction(client, async () => undefined, { retryDelayMs: 0 })).rejects.toBe(error);

    expect(client.$transaction).toHaveBeenCalledOnce();
  });

  it("recognizes only Prisma P2034 conflicts", () => {
    expect(isPrismaTransactionConflict({ code: "P2034" })).toBe(true);
    expect(isPrismaTransactionConflict({ code: "P2002" })).toBe(false);
    expect(isPrismaTransactionConflict(new Error("P2034"))).toBe(false);
    expect(isPrismaTransactionConflict(null)).toBe(false);
  });
});
