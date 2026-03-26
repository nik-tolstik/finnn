import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import Big from "big.js";

const ADMIN_EMAIL = "admin@finnn.com";
const ADMIN_PASSWORD = "123456";
const WORKSPACE_SLUG = "first-workspace";
const WORKSPACE_NAME = "First workspace";
const TRANSACTIONS_TARGET_COUNT = 45;

const TRANSACTION_TYPE = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

function getDatabaseUrl(): string {
  const explicitUrl = process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const mongoUri = process.env.MONGODB_URI?.trim() || "";
  if (!mongoUri) return "";

  try {
    const parsed = new URL(mongoUri);
    if (parsed.pathname && parsed.pathname !== "/") {
      return mongoUri;
    }

    parsed.pathname = "/finnn";
    return parsed.toString();
  } catch {
    return mongoUri;
  }
}

const databaseUrl = getDatabaseUrl();
if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

const prisma = new PrismaClient(
  databaseUrl
    ? {
        datasourceUrl: databaseUrl,
      }
    : undefined
);

type CategoryType = "income" | "expense";
type SeedAccount = {
  key: "byn" | "usd" | "eur";
  name: string;
  currency: "BYN" | "USD" | "EUR";
  color: string;
  icon: string;
};

const seedAccounts: SeedAccount[] = [
  { key: "byn", name: "Кошелёк BYN", currency: "BYN", color: "#06B6D4", icon: "wallet" },
  { key: "usd", name: "Карта USD", currency: "USD", color: "#10B981", icon: "credit-card" },
  { key: "eur", name: "Счёт EUR", currency: "EUR", color: "#F59E0B", icon: "landmark" },
];

const seedCategories: Array<{ name: string; type: CategoryType; color: string; icon: string; order: number }> = [
  { name: "Зарплата", type: "income", color: "#16A34A", icon: "briefcase", order: 1 },
  { name: "Подработка", type: "income", color: "#22C55E", icon: "wallet", order: 2 },
  { name: "Кэшбэк", type: "income", color: "#4ADE80", icon: "piggy-bank", order: 3 },
  { name: "Продукты", type: "expense", color: "#EF4444", icon: "shopping-cart", order: 1 },
  { name: "Транспорт", type: "expense", color: "#F97316", icon: "car", order: 2 },
  { name: "Кафе", type: "expense", color: "#DC2626", icon: "coffee", order: 3 },
  { name: "Коммунальные", type: "expense", color: "#B91C1C", icon: "building-2", order: 4 },
  { name: "Подписки", type: "expense", color: "#FB7185", icon: "tv", order: 5 },
];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomAmount(min: number, max: number, rng: () => number): string {
  const value = new Big(min).plus(new Big(max - min).times(rng()));
  return value.round(2, Big.roundHalfUp).toFixed(2);
}

function pickOne<T>(items: T[], rng: () => number): T {
  const index = Math.floor(rng() * items.length);
  return items[index];
}

function shiftDays(baseDate: Date, dayOffset: number): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: passwordHash,
      emailVerified: new Date(),
      name: "Admin",
    },
    create: {
      email: ADMIN_EMAIL,
      password: passwordHash,
      emailVerified: new Date(),
      name: "Admin",
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {
      name: WORKSPACE_NAME,
      ownerId: user.id,
      baseCurrency: "BYN",
    },
    create: {
      name: WORKSPACE_NAME,
      slug: WORKSPACE_SLUG,
      ownerId: user.id,
      baseCurrency: "BYN",
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: "owner" },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    },
  });

  const existingTransactions = await prisma.transaction.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true },
  });
  const existingTransactionIds = existingTransactions.map((item) => item.id);

  if (existingTransactionIds.length > 0) {
    await prisma.transfer.deleteMany({
      where: {
        OR: [
          { fromTransactionId: { in: existingTransactionIds } },
          { toTransactionId: { in: existingTransactionIds } },
        ],
      },
    });
  }

  await prisma.transaction.deleteMany({
    where: { workspaceId: workspace.id },
  });

  await prisma.debtTransaction.deleteMany({
    where: { workspaceId: workspace.id },
  });
  await prisma.debt.deleteMany({
    where: { workspaceId: workspace.id },
  });
  await prisma.category.deleteMany({
    where: { workspaceId: workspace.id },
  });

  const accountMap = new Map<string, { id: string; currency: SeedAccount["currency"] }>();
  for (let i = 0; i < seedAccounts.length; i++) {
    const account = seedAccounts[i];
    const existing = await prisma.account.findFirst({
      where: {
        workspaceId: workspace.id,
        name: account.name,
      },
    });

    const savedAccount = existing
      ? await prisma.account.update({
          where: { id: existing.id },
          data: {
            ownerId: user.id,
            currency: account.currency,
            color: account.color,
            icon: account.icon,
            archived: false,
            balance: "0.00",
            order: i,
          },
        })
      : await prisma.account.create({
          data: {
            workspaceId: workspace.id,
            ownerId: user.id,
            name: account.name,
            currency: account.currency,
            color: account.color,
            icon: account.icon,
            archived: false,
            order: i,
            balance: "0.00",
          },
        });

    accountMap.set(account.key, { id: savedAccount.id, currency: account.currency });
  }

  const categoryMap = new Map<string, { id: string; type: CategoryType }>();
  for (const category of seedCategories) {
    const created = await prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        order: category.order,
      },
    });
    categoryMap.set(created.name, { id: created.id, type: created.type as CategoryType });
  }

  const rng = createRng(20260307);
  const accountEntries = [...accountMap.entries()];
  const balances = new Map<string, Big>(accountEntries.map(([, account]) => [account.id, new Big(0)]));

  const incomeCategories = [...categoryMap.entries()].filter(([, category]) => category.type === "income");
  const expenseCategories = [...categoryMap.entries()].filter(([, category]) => category.type === "expense");

  const baseDate = shiftDays(new Date(), -70);
  let createdTransactions = 0;

  const incomeCount = 25;
  for (let i = 0; i < incomeCount; i++) {
    const [accountKey, account] = accountEntries[i % accountEntries.length];

    const amountByCurrency: Record<SeedAccount["currency"], [number, number]> = {
      BYN: [250, 1700],
      USD: [120, 900],
      EUR: [100, 700],
    };
    const [min, max] = amountByCurrency[account.currency];
    const amount = randomAmount(min, max, rng);

    const [categoryName, category] = pickOne(incomeCategories, rng);
    const description = `${categoryName} (${accountKey.toUpperCase()})`;
    const date = shiftDays(baseDate, i + 1);
    date.setHours(8 + (i % 10), (i * 13) % 60, 0, 0);

    await prisma.transaction.create({
      data: {
        workspaceId: workspace.id,
        accountId: account.id,
        amount,
        type: TRANSACTION_TYPE.INCOME,
        description,
        date,
        categoryId: category.id,
      },
    });

    const currentBalance = balances.get(account.id) ?? new Big(0);
    balances.set(account.id, currentBalance.plus(amount));
    createdTransactions += 1;
  }

  while (createdTransactions < TRANSACTIONS_TARGET_COUNT) {
    const [accountKey, account] = pickOne(accountEntries, rng);
    const currentBalance = balances.get(account.id);
    if (!currentBalance) {
      continue;
    }

    if (currentBalance.lte(25)) {
      const topUpAmount = randomAmount(50, 200, rng);
      const [categoryName, category] = pickOne(incomeCategories, rng);
      const topUpDate = shiftDays(baseDate, createdTransactions + 1);
      topUpDate.setHours(9 + (createdTransactions % 8), (createdTransactions * 7) % 60, 0, 0);

      await prisma.transaction.create({
        data: {
          workspaceId: workspace.id,
          accountId: account.id,
          amount: topUpAmount,
          type: TRANSACTION_TYPE.INCOME,
          description: `${categoryName} (${accountKey.toUpperCase()})`,
          date: topUpDate,
          categoryId: category.id,
        },
      });

      balances.set(account.id, currentBalance.plus(topUpAmount));
      createdTransactions += 1;
      continue;
    }

    const maxAllowedByBalance = currentBalance.times(0.45);
    const limitsByCurrency: Record<SeedAccount["currency"], [number, number]> = {
      BYN: [20, 320],
      USD: [8, 130],
      EUR: [7, 115],
    };
    const [minExpense, hardMaxExpense] = limitsByCurrency[account.currency];
    const hardMax = new Big(hardMaxExpense);
    const dynamicMax = maxAllowedByBalance.gt(hardMax) ? hardMax : maxAllowedByBalance;

    if (dynamicMax.lt(minExpense)) {
      continue;
    }

    const expenseAmount = randomAmount(minExpense, Number(dynamicMax.toString()), rng);
    const [categoryName, category] = pickOne(expenseCategories, rng);
    const date = shiftDays(baseDate, createdTransactions + 1);
    date.setHours(10 + (createdTransactions % 10), (createdTransactions * 11) % 60, 0, 0);

    await prisma.transaction.create({
      data: {
        workspaceId: workspace.id,
        accountId: account.id,
        amount: expenseAmount,
        type: TRANSACTION_TYPE.EXPENSE,
        description: `${categoryName} (${accountKey.toUpperCase()})`,
        date,
        categoryId: category.id,
      },
    });

    balances.set(account.id, currentBalance.minus(expenseAmount));
    createdTransactions += 1;
  }

  for (const [, account] of accountEntries) {
    const balance = balances.get(account.id) ?? new Big(0);
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: balance.toFixed(2) },
    });
  }

  const summaryAccounts = await prisma.account.findMany({
    where: { workspaceId: workspace.id, id: { in: accountEntries.map(([, account]) => account.id) } },
    select: {
      name: true,
      currency: true,
      balance: true,
    },
    orderBy: { order: "asc" },
  });
  for (const _account of summaryAccounts) {
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
