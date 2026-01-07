import { PrismaClient } from "@prisma/client";
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

async function addUserToWorkspace(
  userEmail: string,
  workspaceIdentifier: string,
  role: string = "member"
) {
  console.log(`Поиск пользователя с email: ${userEmail}`);

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new Error(`Пользователь с email ${userEmail} не найден`);
  }

  console.log(`Поиск workspace: ${workspaceIdentifier}`);

  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceIdentifier }, { slug: workspaceIdentifier }],
    },
  });

  if (!workspace) {
    throw new Error(`Workspace с ID или slug "${workspaceIdentifier}" не найден`);
  }

  console.log(`Проверка существующего членства...`);

  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
  });

  if (existingMember) {
    throw new Error(
      `Пользователь ${userEmail} уже является участником workspace "${workspace.name}"`
    );
  }

  console.log(`Добавление пользователя в workspace...`);

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role,
    },
  });

  console.log(`✅ Пользователь успешно добавлен в workspace:`);
  console.log(`   Пользователь: ${user.name || user.email} (${user.email})`);
  console.log(`   Workspace: ${workspace.name} (${workspace.slug})`);
  console.log(`   Роль: ${role}`);
  console.log(`   ID членства: ${member.id}`);
}

async function main() {
  let userEmail = process.argv[2];
  let workspaceIdentifier = process.argv[3];
  let role = process.argv[4] || "member";

  if (!userEmail || !workspaceIdentifier) {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    const response = await prompts([
      {
        type: "text",
        name: "userEmail",
        message: "Email пользователя:",
        validate: (value: string) =>
          value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
            ? true
            : "Введите корректный email",
      },
      {
        type: workspaces.length > 0 ? "select" : "text",
        name: "workspaceIdentifier",
        message: "Workspace (ID или slug):",
        choices: workspaces.map((w) => ({
          title: `${w.name} (${w.slug})`,
          value: w.id,
        })),
        validate: (value: string) => (value ? true : "Workspace обязателен"),
      },
      {
        type: "select",
        name: "role",
        message: "Роль:",
        choices: [
          { title: "Member", value: "member" },
          { title: "Admin", value: "admin" },
          { title: "Owner", value: "owner" },
        ],
        initial: 0,
      },
    ]);

    if (!response.userEmail || !response.workspaceIdentifier) {
      console.error("Операция отменена");
      process.exit(1);
    }

    userEmail = response.userEmail;
    workspaceIdentifier = response.workspaceIdentifier;
    role = response.role || "member";
  }

  const validRoles = ["member", "admin", "owner"];
  if (!validRoles.includes(role)) {
    console.error(`Неверная роль. Допустимые значения: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  try {
    await addUserToWorkspace(userEmail, workspaceIdentifier, role);
  } catch (error) {
    console.error("Ошибка:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

