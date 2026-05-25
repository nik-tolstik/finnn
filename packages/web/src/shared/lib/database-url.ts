type DatabaseUrlOptions = {
  env?: NodeJS.ProcessEnv;
};

export function getDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  const env = options.env ?? process.env;
  return env.DATABASE_URL?.trim() ?? "";
}

export function ensureDatabaseUrl(options: DatabaseUrlOptions = {}): string {
  return getDatabaseUrl(options);
}
