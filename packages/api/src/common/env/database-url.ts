type DatabaseUrlOptions = {
  env?: NodeJS.ProcessEnv;
};

export function getDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  const env = options.env ?? process.env;
  return env.DATABASE_URL?.trim() ?? "";
}

export function ensureDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  const databaseUrl = getDatabaseUrl(options);
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be provided.");
  }

  return databaseUrl;
}
