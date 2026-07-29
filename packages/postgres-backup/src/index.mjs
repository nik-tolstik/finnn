import { runBackup } from "./backup.mjs";

function secretValues(environment) {
  const values = [
    environment.BACKUP_DATABASE_URL,
    environment.BACKUP_S3_ACCESS_KEY_ID,
    environment.BACKUP_S3_SECRET_ACCESS_KEY,
  ];

  try {
    const databaseUrl = new URL(environment.BACKUP_DATABASE_URL);
    values.push(databaseUrl.username, databaseUrl.password);
    values.push(decodeURIComponent(databaseUrl.username), decodeURIComponent(databaseUrl.password));
  } catch {
    // Invalid configuration is reported without attempting to parse it further.
  }

  return values.filter((value) => value && value.length >= 4).sort((left, right) => right.length - left.length);
}

export function sanitizedErrorMessage(error, environment = process.env) {
  let message = error instanceof Error ? error.message : String(error);

  for (const value of secretValues(environment)) {
    message = message.replaceAll(value, "[REDACTED]");
  }

  return message;
}

export async function main(environment = process.env) {
  process.umask(0o077);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);

  try {
    await runBackup({ environment, signal: controller.signal });
  } catch (error) {
    console.error(`PostgreSQL backup failed: ${sanitizedErrorMessage(error, environment)}`);
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
