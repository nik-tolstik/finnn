import type { Prisma } from "@prisma/client";

export const DEFAULT_SERIALIZABLE_TRANSACTION_MAX_RETRIES = 3;

const DEFAULT_RETRY_DELAY_MS = 10;
const MAX_RETRY_DELAY_MS = 100;

type TransactionHost = {
  $transaction: unknown;
};

type SerializableTransactionOptions = {
  maxRetries?: number;
  maxWait?: number;
  retryDelayMs?: number;
  timeout?: number;
};

type InteractiveTransactionClient = {
  $transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: {
      isolationLevel: "Serializable";
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T>;
};

export function isPrismaTransactionConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

function getRetryDelayMs(retryIndex: number, baseDelayMs: number): number {
  return Math.min(baseDelayMs * 2 ** retryIndex, MAX_RETRY_DELAY_MS);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runSerializableTransaction<T>(
  client: TransactionHost,
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: SerializableTransactionOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_SERIALIZABLE_TRANSACTION_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError("maxRetries must be a non-negative integer");
  }

  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new RangeError("retryDelayMs must be a non-negative finite number");
  }

  const transactionClient = client as InteractiveTransactionClient;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await transactionClient.$transaction(callback, {
        isolationLevel: "Serializable",
        maxWait: options.maxWait,
        timeout: options.timeout,
      });
    } catch (error) {
      if (!isPrismaTransactionConflict(error) || attempt >= maxRetries) {
        throw error;
      }

      const delayMs = getRetryDelayMs(attempt, retryDelayMs);
      if (delayMs > 0) {
        await wait(delayMs);
      }
    }
  }
}
