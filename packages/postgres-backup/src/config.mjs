const DEFAULT_PREFIX = "postgresql";
const DEFAULT_REGION = "auto";
const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_JOB_TIMEOUT_MS = 45 * 60 * 1000;

function required(environment, name) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseSlug(value, name) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`${name} must contain only letters, numbers, dots, underscores, and hyphens`);
  }

  return value.toLowerCase();
}

function parseBoolean(value, name) {
  if (value === undefined || value.trim() === "") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function parsePositiveInteger(value, name, defaultValue) {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parsePostgresUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("BACKUP_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("BACKUP_DATABASE_URL must use the postgresql:// or postgres:// scheme");
  }

  if (!url.hostname || !url.pathname || url.pathname === "/") {
    throw new Error("BACKUP_DATABASE_URL must include a host and database name");
  }

  return url;
}

function parseAgeRecipient(value) {
  const recipient = value?.trim();
  if (!recipient) {
    throw new Error("BACKUP_AGE_RECIPIENT is required");
  }
  if (recipient.includes("\n") || recipient.includes("\0")) {
    throw new Error("BACKUP_AGE_RECIPIENT must contain exactly one recipient");
  }
  if (!recipient.startsWith("age1") && !recipient.startsWith("age-plugin-") && !recipient.startsWith("ssh-ed25519 ")) {
    throw new Error("BACKUP_AGE_RECIPIENT must be an age, age plugin, or SSH Ed25519 recipient");
  }

  return recipient;
}

export function loadConfig(environment = process.env) {
  const databaseUrl = required(environment, "BACKUP_DATABASE_URL");
  parsePostgresUrl(databaseUrl);

  const prefix = (environment.BACKUP_S3_PREFIX?.trim() || DEFAULT_PREFIX)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((part) => parseSlug(part, "BACKUP_S3_PREFIX"))
    .join("/");

  return {
    databaseUrl,
    environment: parseSlug(required(environment, "BACKUP_ENVIRONMENT"), "BACKUP_ENVIRONMENT"),
    ageRecipient: parseAgeRecipient(environment.BACKUP_AGE_RECIPIENT),
    commandTimeoutMs: parsePositiveInteger(
      environment.BACKUP_COMMAND_TIMEOUT_MS,
      "BACKUP_COMMAND_TIMEOUT_MS",
      DEFAULT_COMMAND_TIMEOUT_MS
    ),
    jobTimeoutMs: parsePositiveInteger(
      environment.BACKUP_JOB_TIMEOUT_MS,
      "BACKUP_JOB_TIMEOUT_MS",
      DEFAULT_JOB_TIMEOUT_MS
    ),
    s3: {
      endpoint: required(environment, "BACKUP_S3_ENDPOINT"),
      region: environment.BACKUP_S3_REGION?.trim() || DEFAULT_REGION,
      bucket: required(environment, "BACKUP_S3_BUCKET"),
      accessKeyId: required(environment, "BACKUP_S3_ACCESS_KEY_ID"),
      secretAccessKey: required(environment, "BACKUP_S3_SECRET_ACCESS_KEY"),
      forcePathStyle: parseBoolean(environment.BACKUP_S3_FORCE_PATH_STYLE, "BACKUP_S3_FORCE_PATH_STYLE"),
      prefix,
    },
  };
}

export function buildObjectKey({ prefix, environment, now }) {
  const iso = now.toISOString();
  const [date] = iso.split("T");
  const [year, month, day] = date.split("-");
  const timestamp = iso.replaceAll(/[-:.]/g, "");

  return `${prefix}/${environment}/daily/${year}/${month}/${day}/finnn-${timestamp}.dump.age`;
}

export { parsePostgresUrl };
