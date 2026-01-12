import { PrismaClient } from "@prisma/client";

import { addMoney, subtractMoney, compareMoney } from "../src/shared/utils/money";

function getDatabaseUrl(): string {
  const mongoUri = process.env.MONGODB_URI || "";
  const dbName = "finhub";

  if (!mongoUri) return mongoUri;

  if (mongoUri.includes(`/${dbName}`) || mongoUri.includes(`/${dbName}?`)) {
    return mongoUri;
  }

  const hasQuery = mongoUri.includes("?");

  if (hasQuery) {
    const [base, query] = mongoUri.split("?");
    const separator = base.endsWith("/") ? "" : "/";
    return `${base}${separator}${dbName}?${query}`;
  }

  const separator = mongoUri.endsWith("/") ? "" : "/";
  return `${mongoUri}${separator}${dbName}`;
}

const databaseUrl = getDatabaseUrl();

if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
});

const descriptions = [
  "Покупка продуктов",
  "Оплата интернета",
  "Зарплата",
  "Подарок другу",
  "Обед в ресторане",
  "Транспорт",
  "Развлечения",
  "Одежда",
  "Медицина",
  "Образование",
  "Бытовая техника",
  "Книги",
  "Спорт",
  "Путешествия",
  "Коммунальные услуги",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): string {
  const num = Math.random() * (max - min) + min;
  return num.toFixed(decimals);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function clearTransactions(workspaceId: string) {
  console.warn("Очистка существующих транзакций...");

  const transactions = await prisma.transaction.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  if (transactions.length === 0) {
    console.warn("Нет транзакций для удаления");
    return;
  }

  const transactionIds = transactions.map((t) => t.id);

  const transfers = await prisma.transfer.findMany({
    where: {
      OR: [{ fromTransactionId: { in: transactionIds } }, { toTransactionId: { in: transactionIds } }],
    },
  });

  if (transfers.length > 0) {
    console.warn(`Удаление ${transfers.length} переводов...`);
    await prisma.transfer.deleteMany({
      where: {
        OR: [{ fromTransactionId: { in: transactionIds } }, { toTransactionId: { in: transactionIds } }],
      },
    });
  }

  console.warn(`Удаление ${transactions.length} транзакций...`);
  await prisma.transaction.deleteMany({
    where: { workspaceId },
  });

  const accounts = await prisma.account.findMany({
    where: { workspaceId },
  });

  console.warn("Сброс балансов счетов...");
  for (const account of accounts) {
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: "0" },
    });
  }

  console.warn("✅ Очистка завершена");
}

async function generateTransactions(workspaceId: string, count: number = 100) {
  console.warn(`Генерация ${count} транзакций для workspace: ${workspaceId}`);

  await clearTransactions(workspaceId);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new Error(`Workspace с ID ${workspaceId} не найден`);
  }

  const accounts = await prisma.account.findMany({
    where: {
      workspaceId,
      archived: false,
    },
  });

  if (accounts.length === 0) {
    throw new Error("Нет доступных счетов в workspace");
  }

  const categories = await prisma.category.findMany({
    where: { workspaceId },
  });

  const incomeCategories = categories.filter((cat) => cat.type === "income");
  const expenseCategories = categories.filter((cat) => cat.type === "expense");

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date();

  const transactions = [];
  const accountBalances = new Map<string, string>();

  for (const account of accounts) {
    accountBalances.set(account.id, "0");
  }

  const incomeCount = Math.floor(count * 0.4);
  const expenseCount = count - incomeCount;

  for (let i = 0; i < incomeCount; i++) {
    const account = accounts[randomInt(0, accounts.length - 1)];
    const accountCreatedDate = new Date(account.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);

    const transactionDate = randomDate(accountCreatedDate > startDate ? accountCreatedDate : startDate, endDate);
    transactionDate.setHours(0, 0, 0, 0);

    const amount = randomFloat(100, 10000);
    const categoryId =
      incomeCategories.length > 0 ? incomeCategories[randomInt(0, incomeCategories.length - 1)].id : undefined;

    const description = descriptions[randomInt(0, descriptions.length - 1)] + ` #${i + 1}`;

    const currentBalance = accountBalances.get(account.id) || "0";
    const newBalance = addMoney(currentBalance, amount);
    accountBalances.set(account.id, newBalance);

    transactions.push({
      workspaceId,
      accountId: account.id,
      amount,
      type: "income",
      description,
      date: transactionDate,
      categoryId: categoryId || null,
    });
  }

  let expenseAttempts = 0;
  const maxExpenseAttempts = expenseCount * 3;

  for (let i = 0; i < expenseCount && expenseAttempts < maxExpenseAttempts; expenseAttempts++) {
    const account = accounts[randomInt(0, accounts.length - 1)];
    const accountCreatedDate = new Date(account.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);

    const transactionDate = randomDate(accountCreatedDate > startDate ? accountCreatedDate : startDate, endDate);
    transactionDate.setHours(0, 0, 0, 0);

    const amount = randomFloat(10, 5000);
    const currentBalance = accountBalances.get(account.id) || "0";

    if (compareMoney(currentBalance, amount) < 0) {
      continue;
    }

    const categoryId =
      expenseCategories.length > 0 ? expenseCategories[randomInt(0, expenseCategories.length - 1)].id : undefined;

    const description = descriptions[randomInt(0, descriptions.length - 1)] + ` #${incomeCount + i + 1}`;

    const newBalance = subtractMoney(currentBalance, amount);
    accountBalances.set(account.id, newBalance);

    transactions.push({
      workspaceId,
      accountId: account.id,
      amount,
      type: "expense",
      description,
      date: transactionDate,
      categoryId: categoryId || null,
    });

    i++;
  }

  console.warn("Создание транзакций...");

  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: transaction,
    });
  }

  console.warn("Обновление балансов счетов...");

  for (const [accountId, balance] of accountBalances.entries()) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance },
    });
  }

  console.warn(
    `✅ Успешно создано ${transactions.length} транзакций (${incomeCount} доходов, ${transactions.length - incomeCount} расходов)`
  );
}

async function main() {
  const workspaceId = process.argv[2];
  const count = parseInt(process.argv[3] || "100", 10);

  if (!workspaceId) {
    console.error("Использование: tsx scripts/generate-transactions.ts <workspaceId> [count]");
    process.exit(1);
  }

  try {
    await generateTransactions(workspaceId, count);
  } catch (error) {
    console.error("Ошибка:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
