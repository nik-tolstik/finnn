import { PrismaClient } from "@prisma/client";
import { addMoney, subtractMoney } from "../src/shared/utils/money";

const prisma = new PrismaClient();

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
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

async function generateTransactions(workspaceId: string, count: number = 100) {
  console.log(`Генерация ${count} транзакций для workspace: ${workspaceId}`);

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
    accountBalances.set(account.id, account.balance);
  }

  for (let i = 0; i < count; i++) {
    const account = accounts[randomInt(0, accounts.length - 1)];
    const accountCreatedDate = new Date(account.createdAt);
    accountCreatedDate.setHours(0, 0, 0, 0);

    const transactionDate = randomDate(
      accountCreatedDate > startDate ? accountCreatedDate : startDate,
      endDate
    );
    transactionDate.setHours(0, 0, 0, 0);

    const type = Math.random() > 0.3 ? "expense" : "income";
    const amount = randomFloat(10, 5000);

    let categoryId: string | undefined;
    if (type === "income" && incomeCategories.length > 0) {
      categoryId =
        incomeCategories[randomInt(0, incomeCategories.length - 1)].id;
    } else if (type === "expense" && expenseCategories.length > 0) {
      categoryId =
        expenseCategories[randomInt(0, expenseCategories.length - 1)].id;
    }

    const description =
      descriptions[randomInt(0, descriptions.length - 1)] +
      ` #${i + 1}`;

    const currentBalance = accountBalances.get(account.id) || "0";
    let newBalance: string;

    if (type === "income") {
      newBalance = addMoney(currentBalance, amount);
    } else {
      newBalance = subtractMoney(currentBalance, amount);
    }

    accountBalances.set(account.id, newBalance);

    transactions.push({
      workspaceId,
      accountId: account.id,
      amount,
      type,
      description,
      date: transactionDate,
      categoryId: categoryId || null,
    });
  }

  console.log("Создание транзакций...");

  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: transaction,
    });
  }

  console.log("Обновление балансов счетов...");

  for (const [accountId, balance] of accountBalances.entries()) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance },
    });
  }

  console.log(`✅ Успешно создано ${count} транзакций`);
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

