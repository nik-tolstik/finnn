import { MongoClient } from "mongodb";

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

function getConnectionString(): string {
  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || "";
  if (!mongoUri) return mongoUri;

  const dbName = "finhub";
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

async function createIndexes() {
  console.log("Создание индексов для оптимизации производительности...");

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.log("⚠️ MONGODB_URI или DATABASE_URL не установлен, пропускаем создание индексов");
    return;
  }

  const client = new MongoClient(connectionString);

  try {
    await client.connect();
    const db = client.db("finhub");

    try {
      await db.collection("transactions").createIndex({ workspaceId: 1, date: 1 });
      console.log("✅ Индекс создан: transactions (workspaceId, date)");
    } catch (error: any) {
      if (error.code === 85) {
        console.log("ℹ️ Индекс уже существует: transactions (workspaceId, date)");
      } else {
        console.error("⚠️ Ошибка при создании индекса transactions (workspaceId, date):", error.message);
      }
    }

    try {
      await db.collection("transactions").createIndex({ workspaceId: 1, accountId: 1, date: 1 });
      console.log("✅ Индекс создан: transactions (workspaceId, accountId, date)");
    } catch (error: any) {
      if (error.code === 85) {
        console.log("ℹ️ Индекс уже существует: transactions (workspaceId, accountId, date)");
      } else {
        console.error("⚠️ Ошибка при создании индекса transactions (workspaceId, accountId, date):", error.message);
      }
    }

    try {
      await db.collection("transactions").createIndex({ accountId: 1, date: 1 });
      console.log("✅ Индекс создан: transactions (accountId, date)");
    } catch (error: any) {
      if (error.code === 85) {
        console.log("ℹ️ Индекс уже существует: transactions (accountId, date)");
      } else {
        console.error("⚠️ Ошибка при создании индекса transactions (accountId, date):", error.message);
      }
    }

    try {
      await db.collection("accounts").createIndex({ workspaceId: 1, archived: 1 });
      console.log("✅ Индекс создан: accounts (workspaceId, archived)");
    } catch (error: any) {
      if (error.code === 85) {
        console.log("ℹ️ Индекс уже существует: accounts (workspaceId, archived)");
      } else {
        console.error("⚠️ Ошибка при создании индекса accounts (workspaceId, archived):", error.message);
      }
    }

    console.log("✅ Процесс создания индексов завершен");
  } catch (error) {
    console.error("⚠️ Ошибка при подключении к базе данных:", error instanceof Error ? error.message : error);
    console.log("ℹ️ Продолжаем сборку без создания индексов");
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    await createIndexes();
  } catch (error) {
    console.error("❌ Ошибка:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
