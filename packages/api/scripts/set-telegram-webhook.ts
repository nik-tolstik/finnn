import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function assertHttpsWebhookUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("TELEGRAM_BOT_WEBHOOK_URL must be an HTTPS URL");
  }

  return url.toString();
}

async function readTelegramJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const json = (text ? JSON.parse(text) : {}) as TelegramApiResponse<T>;
  if (!response.ok || !json.ok) {
    throw new Error(json.description ? `Telegram API error: ${json.description}` : "Telegram API error");
  }

  return json.result as T;
}

async function callTelegram<T>(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return readTelegramJson<T>(response);
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));

  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const webhookUrl = assertHttpsWebhookUrl(getArgValue("--url") ?? requireEnv("TELEGRAM_BOT_WEBHOOK_URL"));
  const secretToken = getArgValue("--secret") ?? requireEnv("TELEGRAM_BOT_WEBHOOK_SECRET");
  const dropPendingUpdates = hasFlag("--drop-pending");

  await callTelegram<boolean>(token, "setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
    drop_pending_updates: dropPendingUpdates,
  });

  const info = await callTelegram<TelegramWebhookInfo>(token, "getWebhookInfo");

  process.stdout.write(`Telegram webhook enabled: ${info.url}\n`);
  process.stdout.write(`Pending updates: ${info.pending_update_count}\n`);
  if (info.last_error_message) {
    process.stdout.write(`Last error: ${info.last_error_message}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
