import { PrismaClient } from "@prisma/client";

function getDatabaseUrl(): string {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || "";
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

async function migrateWorkspaceBaseCurrency() {
  console.log("Начало миграции baseCurrency для workspace...");

  const allWorkspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      baseCurrency: true,
    },
  });

  const workspacesToUpdate = allWorkspaces.filter(
    (w) => !w.baseCurrency || w.baseCurrency === ""
  );

  console.log(`Всего workspace: ${allWorkspaces.length}`);
  console.log(`Найдено workspace без baseCurrency: ${workspacesToUpdate.length}`);

  if (workspacesToUpdate.length === 0) {
    console.log("✅ Все workspace уже имеют baseCurrency");
    return;
  }

  let updatedCount = 0;
  for (const workspace of workspacesToUpdate) {
    try {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { baseCurrency: "BYN" },
      });
      updatedCount++;
    } catch (error) {
      console.error(`Ошибка при обновлении workspace ${workspace.id}:`, error);
    }
  }

  console.log(`✅ Обновлено workspace: ${updatedCount}`);
}

async function main() {
  try {
    await migrateWorkspaceBaseCurrency();
    console.log("✅ Миграция завершена успешно");
  } catch (error) {
    console.error("❌ Ошибка миграции:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
