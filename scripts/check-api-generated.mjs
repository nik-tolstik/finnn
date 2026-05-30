import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const generatedPaths = [
  "packages/api/openapi.json",
  "packages/web/src/shared/api/generated",
];

function readSnapshot(targetPath) {
  const absolutePath = resolve(root, targetPath);
  if (!existsSync(absolutePath)) {
    return { type: "missing", files: new Map() };
  }

  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    return {
      type: "file",
      files: new Map([[targetPath, readFileSync(absolutePath, "utf8")]]),
    };
  }

  const files = new Map();
  const pending = [absolutePath];

  while (pending.length > 0) {
    const currentPath = pending.pop();
    if (!currentPath) continue;

    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        files.set(relative(root, entryPath), readFileSync(entryPath, "utf8"));
      }
    }
  }

  return { type: "directory", files };
}

function diffSnapshots(before, after) {
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);
  const changedPaths = [];

  for (const filePath of [...paths].sort()) {
    if (before.files.get(filePath) !== after.files.get(filePath)) {
      changedPaths.push(filePath);
    }
  }

  return changedPaths;
}

const before = new Map(generatedPaths.map((targetPath) => [targetPath, readSnapshot(targetPath)]));
const result = spawnSync("pnpm", ["api:generate"], {
  cwd: root,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const changedPaths = [];

for (const targetPath of generatedPaths) {
  const after = readSnapshot(targetPath);
  changedPaths.push(...diffSnapshots(before.get(targetPath), after));
}

if (changedPaths.length > 0) {
  console.error("Generated API contract output is stale. Run `pnpm api:generate` and commit the updated files.");
  for (const changedPath of changedPaths) {
    console.error(`- ${changedPath}`);
  }
  process.exit(1);
}
