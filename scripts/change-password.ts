import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import prompts from "prompts";

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

async function changePassword(email: string, newPassword: string) {
  console.log(`Поиск пользователя с email: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`Пользователь с email ${email} не найден`);
  }

  console.log(`Хеширование нового пароля...`);
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  console.log(`Обновление пароля для пользователя ${user.email}...`);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  console.log(`✅ Пароль успешно изменен для пользователя ${user.email}`);
}

async function main() {
  let email = process.argv[2];
  let newPassword = process.argv[3];

  if (!email || !newPassword) {
    const response = await prompts([
      {
        type: "text",
        name: "email",
        message: "Email пользователя:",
        validate: (value: string) =>
          value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? true : "Введите корректный email",
      },
      {
        type: "password",
        name: "newPassword",
        message: "Новый пароль:",
        validate: (value: string) => (value ? true : "Пароль не может быть пустым"),
      },
    ]);

    if (!response.email || !response.newPassword) {
      console.error("Операция отменена");
      process.exit(1);
    }

    email = response.email;
    newPassword = response.newPassword;
  }

  try {
    await changePassword(email, newPassword);
  } catch (error) {
    console.error("Ошибка:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
