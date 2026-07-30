import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const webRoot = resolve(root, "packages/web");
const failures = [];

const forbiddenPaths = [
  "packages/web/next.config.js",
  "packages/web/next.config.cjs",
  "packages/web/next.config.cts",
  "packages/web/next.config.mjs",
  "packages/web/next.config.mts",
  "packages/web/next.config.ts",
  "packages/web/next-env.d.ts",
  "packages/web/.next",
  "packages/web/pages",
  "packages/web/src/pages",
  "packages/web/src/shared/lib/api-session-client.tsx",
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
      dependencyName.startsWith("next-") ||
      dependencyName.startsWith("@next/") ||
      dependencyName.startsWith("@storybook/nextjs") ||
      dependencyName === "vite-plugin-storybook-nextjs"
    ) {
      failures.push(`packages/web/package.json: ${section}.${dependencyName} is framework-specific`);
    }
  }
}

const sourceConventionPattern =
  /^(?:apple-icon|default|error|global-error|icon|instrumentation|instrumentation-client|layout|loading|manifest|middleware|not-found|opengraph-image|page|proxy|robots|route|sitemap|template|twitter-image)\.[cm]?[jt]sx?$/;
const obsoleteClientBoundaryPattern = /PageClient\.[cm]?[jt]sx?$/;

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

  if (sourceConventionPattern.test(entry.name)) {
    failures.push(`${filePath}: App Router convention filename remains`);
  }

  if (obsoleteClientBoundaryPattern.test(entry.name)) {
    failures.push(`${filePath}: obsolete App Router client-boundary filename remains`);
  }
});

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const activeDocumentation = ["AGENTS.md", "README.md"].filter((filePath) => existsSync(resolve(root, filePath)));
const activeRootConfiguration = [
  ".gitignore",
  ".vscode/extensions.json",
  ".vscode/settings.json",
  "biome.json",
  "docker-compose.yml",
  "package.json",
  "packages/web/.env.example",
  "packages/web/.gitignore",
  "pnpm-workspace.yaml",
].filter((filePath) => existsSync(resolve(root, filePath)));

const contentChecks = [
  { label: "framework reference", pattern: /\bNext\.js\b|\bNextjs\b/i },
  {
    label: "framework import",
    pattern: /(?:from\s+|import\s*(?:\(\s*)?)["']next(?:\/[^"']*)?["']/,
  },
  {
    label: "Next-prefixed package import",
    pattern: /(?:from\s+|import\s*(?:\(\s*)?)["']next-[^"']+["']/,
  },
  { label: "framework Speed Insights entry", pattern: /@vercel\/speed-insights\/next/ },
  { label: "server/client framework directive", pattern: /^[\t ]*["']use (?:client|server|cache)["'];?/m },
  { label: "obsolete public environment prefix", pattern: /NEXT_PUBLIC_[A-Z0-9_]+/ },
  { label: "obsolete build asset path", pattern: /\/_next\// },
  { label: "obsolete build directory reference", pattern: /\.next(?:\/|["'])/ },
  { label: "obsolete generated type path", pattern: /\.next\/(?:dev\/)?types/ },
  { label: "obsolete Storybook adapter", pattern: /@storybook\/nextjs|parameters\.nextjs/ },
  { label: "obsolete runtime command", pattern: /\bnext\s+(?:dev|build|start)\b/ },
];

const filesToScan = new Set(activeDocumentation.map((filePath) => resolve(root, filePath)));
for (const filePath of activeRootConfiguration) filesToScan.add(resolve(root, filePath));

function addTextFiles(directory) {
  if (!existsSync(directory)) return;

  walk(directory, (absolutePath, entry, isDirectory) => {
    if (isDirectory) return;
    const extension = absolutePath.slice(absolutePath.lastIndexOf("."));
    if (textExtensions.has(extension) || entry.name.startsWith("Dockerfile")) {
      filesToScan.add(absolutePath);
    }
  });
}

addTextFiles(resolve(root, "packages"));
addTextFiles(resolve(root, "scripts"));
addTextFiles(resolve(root, ".github"));

walk(resolve(root, "docs"), (absolutePath, _entry, isDirectory) => {
  if (isDirectory) return;
  if (!absolutePath.endsWith(".md")) return;
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
  { label: "Next-prefixed package", pattern: /^\s{2}next-[^:]+@/m },
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
