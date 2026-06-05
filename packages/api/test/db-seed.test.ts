import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_EMAIL, runSeed, TRANSACTIONS_TARGET_COUNT, WORKSPACE_SLUG } from "../scripts/db-seed";

type MockPrisma = {
  account: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  category: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  debt: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  debtTransaction: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  paymentTransaction: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  transferTransaction: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  user: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  workspace: {
    upsert: ReturnType<typeof vi.fn>;
  };
  workspaceMember: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

function createPrismaMock(): MockPrisma {
  let accountSequence = 0;
  const createdAccounts = new Map<string, { id: string; currency: string }>();

  return {
    account: {
      create: vi.fn(async ({ data }) => {
        accountSequence += 1;
        const account = { id: `account-${accountSequence}`, currency: data.currency };
        createdAccounts.set(data.name, account);
        return account;
      }),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ data, where }) => ({
        id: where.id,
        ...createdAccounts.get(where.id),
        ...data,
      })),
    },
    category: {
      create: vi.fn(async ({ data }) => ({
        id: `category-${data.name}`,
        name: data.name,
        type: data.type,
      })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    debt: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    debtTransaction: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    paymentTransaction: {
      create: vi.fn(async ({ data }) => ({ id: `payment-${data.description}`, ...data })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    transferTransaction: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    user: {
      create: vi.fn(async () => ({ id: "user-1" })),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
    },
    workspace: {
      upsert: vi.fn(async () => ({ id: "workspace-1" })),
    },
    workspaceMember: {
      upsert: vi.fn(async () => ({ id: "workspace-member-1" })),
    },
  };
}

describe("database seed script", () => {
  it("seeds the fixed demo workspace deterministically and always clears transfers", async () => {
    const prisma = createPrismaMock();

    await runSeed(prisma as unknown as PrismaClient, {
      hashPassword: async () => "hashed-password",
      now: new Date("2026-05-26T12:00:00.000Z"),
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: ADMIN_EMAIL },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: ADMIN_EMAIL,
          emailVerified: new Date("2026-05-26T12:00:00.000Z"),
          password: "hashed-password",
        }),
      })
    );
    expect(prisma.workspace.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: WORKSPACE_SLUG },
      })
    );
    expect(prisma.transferTransaction.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(prisma.paymentTransaction.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(prisma.transferTransaction.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.paymentTransaction.deleteMany.mock.invocationCallOrder[0]
    );
    expect(prisma.category.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" },
    });
    expect(prisma.account.create).toHaveBeenCalledTimes(3);
    expect(prisma.category.create).toHaveBeenCalledTimes(8);
    expect(prisma.paymentTransaction.create).toHaveBeenCalledTimes(TRANSACTIONS_TARGET_COUNT);
    expect(prisma.account.update).toHaveBeenCalledTimes(3);
  });
});
