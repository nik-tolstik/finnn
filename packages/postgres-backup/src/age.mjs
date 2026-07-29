import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, rm } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { parsePostgresUrl } from "./config.mjs";

const MAX_STDERR_BYTES = 16 * 1024;
const KILL_GRACE_MS = 5_000;

function minimalEnvironment(parentEnvironment = process.env) {
  const environment = {};

  for (const name of ["PATH", "LANG", "LC_ALL", "TZ", "SSL_CERT_FILE", "SSL_CERT_DIR"]) {
    if (parentEnvironment[name]) {
      environment[name] = parentEnvironment[name];
    }
  }

  return environment;
}

export function buildPgEnvironment(databaseUrl, parentEnvironment = process.env) {
  const url = parsePostgresUrl(databaseUrl);
  const environment = minimalEnvironment(parentEnvironment);

  environment.PGHOST = decodeURIComponent(url.hostname);
  environment.PGPORT = url.port || "5432";
  environment.PGDATABASE = decodeURIComponent(url.pathname.slice(1));

  if (url.username) {
    environment.PGUSER = decodeURIComponent(url.username);
  }
  if (url.password) {
    environment.PGPASSWORD = decodeURIComponent(url.password);
  }

  const libpqParameters = {
    sslmode: "PGSSLMODE",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT",
  };
  for (const [queryName, environmentName] of Object.entries(libpqParameters)) {
    const value = url.searchParams.get(queryName);
    if (value) {
      environment[environmentName] = value;
    }
  }

  return environment;
}

function captureStderr(stream) {
  let value = "";
  stream?.on("data", (chunk) => {
    value = `${value}${chunk.toString()}`.slice(-MAX_STDERR_BYTES);
  });
  return () => value.trim();
}

function waitForChild(child, name, getStderr) {
  return new Promise((resolve, reject) => {
    child.once("error", (error) => reject(new Error(`Could not start ${name}: ${error.message}`)));
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = getStderr();
      const status = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${name} failed with ${status}${detail ? `: ${detail}` : ""}`));
    });
  });
}

function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return undefined;
  }

  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
  timer.unref?.();
  return timer;
}

export async function dumpPostgresToAge({
  databaseUrl,
  ageRecipient,
  outputPath,
  timeoutMs,
  signal,
  parentEnvironment = process.env,
  spawnImpl = spawn,
}) {
  const pgDump = spawnImpl("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], {
    env: buildPgEnvironment(databaseUrl, parentEnvironment),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const age = spawnImpl("age", ["--encrypt", "--recipient", ageRecipient, "--output", outputPath], {
    env: minimalEnvironment(parentEnvironment),
    stdio: ["pipe", "ignore", "pipe"],
  });
  const getPgDumpStderr = captureStderr(pgDump.stderr);
  const getAgeStderr = captureStderr(age.stderr);
  const sourceHash = createHash("sha256");
  const hashPassThrough = new Transform({
    transform(chunk, _encoding, callback) {
      sourceHash.update(chunk);
      callback(null, chunk);
    },
  });
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const commandSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const terminateChildren = () => {
    terminate(pgDump);
    terminate(age);
  };
  commandSignal.addEventListener("abort", terminateChildren, { once: true });

  const pipelinePromise = pipeline(pgDump.stdout, hashPassThrough, age.stdin, { signal: commandSignal });
  const pgDumpPromise = waitForChild(pgDump, "pg_dump", getPgDumpStderr);
  const agePromise = waitForChild(age, "age", getAgeStderr);

  try {
    await Promise.all([pipelinePromise, pgDumpPromise, agePromise]);
    await chmod(outputPath, 0o600);
    return { sourceSha256: sourceHash.digest("hex") };
  } catch (error) {
    terminateChildren();
    await Promise.allSettled([pipelinePromise, pgDumpPromise, agePromise]);
    await rm(outputPath, { force: true });

    if (commandSignal.aborted && !signal?.aborted) {
      throw new Error(`pg_dump and age exceeded their ${timeoutMs}ms timeout`);
    }
    if (signal?.aborted) {
      throw new Error("pg_dump and age were aborted");
    }
    throw error;
  } finally {
    commandSignal.removeEventListener("abort", terminateChildren);
  }
}

export async function decryptAgeFile({
  inputPath,
  outputPath,
  identityFile,
  parentEnvironment = process.env,
  spawnImpl = spawn,
}) {
  const age = spawnImpl("age", ["--decrypt", "--identity", identityFile, "--output", outputPath, inputPath], {
    env: minimalEnvironment(parentEnvironment),
    stdio: ["ignore", "ignore", "pipe"],
  });
  const getStderr = captureStderr(age.stderr);

  try {
    await waitForChild(age, "age", getStderr);
    await chmod(outputPath, 0o600);
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
}

export const ENCRYPTION_FORMAT = "age-v1";
