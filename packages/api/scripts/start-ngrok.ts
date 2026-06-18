import "../src/common/env/load-env";

import { spawn } from "node:child_process";

const DEFAULT_API_PORT = "4000";

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getNgrokUrl() {
  const explicitUrl = getArgValue("--url") ?? process.env.NGROK_URL?.trim();
  if (explicitUrl) return new URL(explicitUrl).origin;

  const webhookUrl = process.env.TELEGRAM_BOT_WEBHOOK_URL?.trim();
  if (webhookUrl) return new URL(webhookUrl).origin;

  throw new Error("NGROK_URL or TELEGRAM_BOT_WEBHOOK_URL is required");
}

function getApiPort() {
  return getArgValue("--port") ?? process.env.PORT?.trim() ?? DEFAULT_API_PORT;
}

function main() {
  const ngrokUrl = getNgrokUrl();
  const port = getApiPort();
  const args = ["http", port, "--url", ngrokUrl];

  process.stdout.write(`Starting ngrok: ngrok ${args.join(" ")}\n`);

  const child = spawn("ngrok", args, { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 0;
  });
  child.on("error", (error) => {
    process.stderr.write(`Failed to start ngrok: ${error.message}\n`);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
