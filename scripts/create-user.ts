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

async function createUser(email: string, name: string, password: string) {
  console.warn(`Проверка существования пользователя с email: ${email}`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error(`Пользователь с email ${email} уже существует`);
  }

  console.warn(`Хеширование пароля...`);
  const hashedPassword = await bcrypt.hash(password, 10);

  console.warn(`Создание пользователя...`);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  console.warn(`✅ Пользователь успешно создан:`);
  console.warn(`   ID: ${user.id}`);
  console.warn(`   Email: ${user.email}`);
  console.warn(`   Имя: ${user.name}`);
}

async function main() {
  let email = process.argv[2];
  let name = process.argv[3];
  let password = process.argv[4];

  if (!email || !name || !password) {
    const response = await prompts([
      {
        type: "text",
        name: "email",
        message: "Email пользователя:",
        validate: (value: string) =>
          value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? true : "Введите корректный email",
      },
      {
        type: "text",
        name: "name",
        message: "Имя пользователя:",
        validate: (value: string) => (value ? true : "Имя не может быть пустым"),
      },
      {
        type: "password",
        name: "password",
        message: "Пароль:",
        validate: (value: string) => (value ? true : "Пароль не может быть пустым"),
      },
    ]);

    if (!response.email || !response.name || !response.password) {
      console.error("Операция отменена");
      process.exit(1);
    }

    email = response.email;
    name = response.name;
    password = response.password;
  }

  try {
    await createUser(email, name, password);
  } catch (error) {
    console.error("Ошибка:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
