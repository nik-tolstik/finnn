import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const webRoot = resolve(root, "packages/web");
const failures = [];

const forbiddenPaths = [
  "packages/web/next.config.js",
  "packages/web/next.config.mjs",
  "packages/web/next.config.ts",
  "packages/web/next-env.d.ts",
  "packages/web/.next",
  "packages/web/src/app/(auth)",
  "packages/web/src/app/(dashboard)",
];

for (const filePath of forbiddenPaths) {
  if (existsSync(resolve(root, filePath))) {
    failures.push(`${filePath}: obsolete framework path still exists`);
  }
}

const webPackage = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
for (const section of dependencySections) {
  for (const dependencyName of Object.keys(webPackage[section] ?? {})) {
    if (
      dependencyName === "next" ||
      dependencyName.startsWith("@next/") ||
      dependencyName.startsWith("@storybook/nextjs") ||
      dependencyName === "vite-plugin-storybook-nextjs"
    ) {
      failures.push(`packages/web/package.json: ${section}.${dependencyName} is framework-specific`);
    }
  }
}

const sourceConventionNames = new Set([
  "page.tsx",
  "layout.tsx",
  "loading.tsx",
  "error.tsx",
  "not-found.tsx",
  "route.ts",
]);

function walk(directory, visit) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "storybook-static"].includes(entry.name)) continue;

    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolutePath, entry, true);
      walk(absolutePath, visit);
      continue;
    }

    if (entry.isFile()) visit(absolutePath, entry, false);
  }
}

walk(resolve(webRoot, "src"), (absolutePath, entry, isDirectory) => {
  const filePath = relative(root, absolutePath);
  if (isDirectory) {
    if (/^\(.+\)$|^\[.+\]$/.test(entry.name)) {
      failures.push(`${filePath}: route-group or dynamic-segment directory convention remains`);
    }
    return;
  }

  if (sourceConventionNames.has(entry.name)) {
    failures.push(`${filePath}: App Router convention filename remains`);
  }
});

const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsx", ".mjs", ".ts", ".tsx"]);
const activeDocumentation = [
  "AGENTS.md",
  "README.md",
].filter((filePath) => existsSync(resolve(root, filePath)));
const activeRootConfiguration = [
  ".gitignore",
  "biome.json",
  "package.json",
  "packages/web/.env.example",
  "packages/web/.gitignore",
  "pnpm-workspace.yaml",
].filter((filePath) => existsSync(resolve(root, filePath)));

const contentChecks = [
  {
    label: "framework import",
    pattern: /(?:from\s+|import\s*(?:\(\s*)?)["']next(?:\/[^"']*)?["']/,
  },
  { label: "framework Speed Insights entry", pattern: /@vercel\/speed-insights\/next/ },
  { label: "server/client framework directive", pattern: /^[\t ]*["']use (?:client|server|cache)["'];?/m },
  { label: "obsolete public environment prefix", pattern: /NEXT_PUBLIC_[A-Z0-9_]+/ },
  { label: "obsolete build asset path", pattern: /\/_next\// },
  { label: "obsolete generated type path", pattern: /\.next\/(?:dev\/)?types/ },
  { label: "obsolete Storybook adapter", pattern: /@storybook\/nextjs|parameters\.nextjs/ },
  { label: "obsolete runtime command", pattern: /\bnext\s+(?:dev|build|start)\b/ },
];

const filesToScan = new Set(activeDocumentation.map((filePath) => resolve(root, filePath)));
for (const filePath of activeRootConfiguration) filesToScan.add(resolve(root, filePath));
walk(webRoot, (absolutePath, _entry, isDirectory) => {
  if (isDirectory) return;
  const extension = absolutePath.slice(absolutePath.lastIndexOf("."));
  if (textExtensions.has(extension)) filesToScan.add(absolutePath);
});
walk(resolve(root, "docs"), (absolutePath, _entry, isDirectory) => {
  if (isDirectory || !absolutePath.endsWith(".md")) return;
  const filePath = relative(root, absolutePath);
  if (!filePath.startsWith("docs/plans/")) filesToScan.add(absolutePath);
});

for (const absolutePath of filesToScan) {
  const filePath = relative(root, absolutePath);
  if (filePath === "scripts/check-no-next-artifacts.mjs") continue;

  const content = readFileSync(absolutePath, "utf8");
  for (const check of contentChecks) {
    if (check.pattern.test(content)) {
      failures.push(`${filePath}: ${check.label}`);
    }
  }
}

const lockfile = readFileSync(resolve(root, "pnpm-lock.yaml"), "utf8");
const lockfileChecks = [
  { label: "Next.js package", pattern: /^\s{2}next@/m },
  { label: "@next package", pattern: /@next\//m },
  { label: "Next.js Storybook adapter", pattern: /@storybook\/nextjs/m },
];
for (const check of lockfileChecks) {
  if (check.pattern.test(lockfile)) {
    failures.push(`pnpm-lock.yaml: ${check.label} remains in the dependency graph`);
  }
}

const dependencyGraph = spawnSync("pnpm", ["--filter", "web", "list", "next", "--depth", "Infinity", "--json"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (dependencyGraph.status !== 0) {
  failures.push("pnpm dependency graph check failed to execute");
} else if (/"name"\s*:\s*"next"/.test(dependencyGraph.stdout)) {
  failures.push("packages/web dependency graph: Next.js is still installed transitively");
}

if (failures.length > 0) {
  console.error("Next.js artifact check failed:");
  for (const failure of [...new Set(failures)].sort()) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Next.js artifact check passed.");
