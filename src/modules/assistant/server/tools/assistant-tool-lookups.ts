import { prisma } from "@/shared/lib/prisma";

export async function resolveMatchingAccounts(workspaceId: string, accountName?: string) {
  if (!accountName) {
    return null;
  }

  return prisma.account.findMany({
    where: {
      workspaceId,
      archived: false,
      name: {
        contains: accountName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
    },
    take: 20,
  });
}

export async function resolveMatchingCategories(workspaceId: string, categoryName?: string) {
  if (!categoryName) {
    return null;
  }

  return prisma.category.findMany({
    where: {
      workspaceId,
      name: {
        contains: categoryName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
    },
    take: 20,
  });
}
