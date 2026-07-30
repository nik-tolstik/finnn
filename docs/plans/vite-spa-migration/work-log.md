# Vite SPA Migration Work Log

## 2026-07-29 19:02 +0300 - Codex / Planning

### Scope

- Created a dedicated migration worktree and branch.
- Audited the current CSR-first Next.js shell and documented the React Router/Vite target architecture.
- Defined route compatibility, PWA/static-hosting work, documentation changes, rollout steps, and an explicit Next.js artifact audit.

### Files Changed

- `docs/plans/vite-spa-migration/prompt.md`
- `docs/plans/vite-spa-migration/README.md`
- `docs/plans/vite-spa-migration/work-log.md`

### Commands Run

```bash
git worktree add -b codex/vite-spa-migration /home/vibegame/projects/finnn-vite-spa develop
```

### Results

- Worktree created at `/home/vibegame/projects/finnn-vite-spa` on `codex/vite-spa-migration`.
- `packages/web/.env` and `packages/api/.env` were copied as opaque files when present; their contents were not read.
- The implementation plan is complete and implementation may begin.

### Decisions

- Use React Router declarative/library mode and keep TanStack Query as the only server-state layer.
- Preserve the existing UI; no design concept or visual redesign is required.
- Use static Vercel hosting with an explicit history fallback.
- Treat removal of Next.js artifacts as a committed automated invariant, not only a one-time manual check.

### Subagent Contributions

- A read-only routing and Next-artifact audit was started in parallel and will be incorporated into subsequent implementation passes.

### Blockers / Follow-ups

- No implementation blocker.
- Shared Vercel environments will require `VITE_API_URL` before deployment; external environment mutation is outside the current repository-only authorization.

## 2026-07-29 19:33 +0300 - Codex / Implementation And Verification

### Scope

- Replaced the web runtime and build with Vite 8, React Router 7, and the Vite Storybook adapter.
- Moved route entries into framework-neutral auth/dashboard route trees and preserved all 12 URLs plus the fallback.
- Replaced framework navigation, links, dynamic imports, images, font loading, script loading, metadata, environment variables, and Speed Insights integration.
- Kept OAuth redirects as full-document navigation to the API; moved internal redirects, logout, workspace selection, and transaction-filter changes to React Router.
- Added static Vercel SPA routing, updated PWA caching for Vite assets, and migrated active architecture, development, operations, and contributor documentation.
- Added a committed Next.js artifact audit to the root `pnpm check` path and a focused SPA route/static-output test.

### Key Files Changed

- `packages/web/index.html`
- `packages/web/vite.config.ts`
- `packages/web/vercel.json`
- `packages/web/src/main.tsx`
- `packages/web/src/app/App.tsx`
- `packages/web/src/app/spa-shell.test.ts`
- `packages/web/src/providers/AppProviders.tsx`
- `packages/web/src/routes/**`
- `packages/web/src/styles/globals.css`
- `packages/web/public/sw.js`
- `scripts/check-no-next-artifacts.mjs`
- `package.json`
- `packages/web/package.json`
- `AGENTS.md`, `README.md`, and current `docs/*.md` architecture/operations guides

### Commands Run

```bash
pnpm install --frozen-lockfile
pnpm check:no-next-artifacts
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web build:storybook
pnpm --filter web list next --depth Infinity
git diff --check
```

A Vite production preview was also started locally and checked with `curl` for `/`, `/dashboard`, and `/sw.js`.

### Results

- Next.js artifact audit passed, including configuration, source, dependency graph, lockfile, current docs, legacy route conventions, and public environment variables.
- Full workspace typecheck passed.
- Full test suite passed: API 267 tests passed / 12 skipped, web 178 passed, PostgreSQL backup 11 passed.
- Full API and Vite production build passed; the SPA emitted `dist/index.html`, hashed assets, local Onest fonts, and lazy route chunks.
- Storybook built successfully with `@storybook/react-vite`.
- Production preview returned HTTP 200 and the same SPA shell for `/` and `/dashboard`; `/sw.js` returned JavaScript successfully.
- `git diff --check` passed.

### Decisions

- React Router owns internal navigation; cross-origin Google and Telegram authorization starts retain `window.location.assign` by design.
- TanStack Query remains the only server-state cache. Router loaders/actions were not introduced.
- React Strict Mode was not newly enabled because invite/email-verification effects are one-shot API operations and the previous runtime did not wrap them in a new double-invocation boundary.
- `next-themes` remains because it is framework-independent; the artifact audit targets actual Next.js runtime imports, packages, conventions, commands, and build output.
- Onest is self-hosted through `@fontsource-variable/onest` to preserve typography without a runtime font request.

### Subagent Contributions

- The routing audit enumerated the route contract and identified the raw history update in transaction filters, session refresh calls, Storybook adapter imports, and static tests that required migration.
- The framework-usage audit confirmed that protected pages were already client-first and that there were no Route Handlers, Server Actions, middleware, ISR, or required server-rendered data dependencies.

### Blockers / Follow-ups

- No repository implementation blocker remains.
- Before shared DEV rollout, create `VITE_API_URL` in Vercel, deploy, and manually verify OAuth/Telegram callbacks and real authenticated route behavior. Production should follow only after DEV validation.
- Browser screenshot QA was not run because repository instructions prohibit it without an explicit request.

## 2026-07-30 11:12 +0300 - Codex / Post-Migration Artifact Cleanup

### Scope

- Re-audited tracked source, configuration, documentation, dependency metadata, ignored build output, and the installed dependency tree for migration residue.
- Replaced the remaining `next-themes` dependency with a local SPA theme context while preserving the existing `theme` storage key, system color-scheme updates, pre-render theme initialization, favicon synchronization, and transition suppression.
- Inlined four obsolete `*PageClient` boundaries into their React Router route components and removed redundant Suspense wrappers carried over from App Router requirements.
- Renamed `api-session-client.tsx` to the framework-neutral `api-session.tsx` and updated source and architecture documentation references.
- Removed confirmed dead files carried through the migration: the unused server logger, duplicated dashboard search-param helper, desktop user menu, and exchange-rate ticker.
- Removed the obsolete `.next` Biome exclusion and the stale API comment that described environment loading in Next.js terms.
- Expanded the automated artifact audit to cover every package and reject `next-themes`, `*PageClient` files, the old session-client path, generic active Next.js references, broader App Router convention filenames, `.next` references, and matching lockfile entries.

### Commands Run

```bash
pnpm --filter web remove next-themes
pnpm prune
pnpm install --frozen-lockfile
pnpm check:no-next-artifacts
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web build:storybook
git diff --check
```

The worktree dependency directories were moved to the system trash and recreated from the frozen lockfile because `pnpm prune` retained unreferenced Next.js packages in the local virtual store.

### Results

- The committed artifact audit passes across source, package metadata, configuration, current documentation, lockfile, and the resolved web dependency graph.
- The recreated local virtual store contains no `next`, `@next/*`, `next-themes`, or Next-resolved Speed Insights package variants.
- Full workspace check and typecheck passed.
- Full test suite passed: API 267 tests passed / 12 skipped, web 182 passed, PostgreSQL backup 11 passed.
- API and Vite production builds passed, and Storybook rebuilt successfully with the Vite adapter.
- Fresh application Vite output contains no Next.js runtime markers. Storybook's generated vendor bundle still contains its own generic cross-framework Next.js mock names, but the application has no Next Storybook adapter or runtime dependency.
- `git diff --check` passed.

### Decisions

- The earlier decision to retain `next-themes` is superseded by this cleanup: the package is framework-independent, but removing the last Next-branded dependency makes the migration boundary explicit and enforceable.
- Historical references in this migration plan and work log remain intentionally; active source, configuration, dependency state, and current documentation are clean.
- Existing Suspense boundaries around actual lazy imports remain. Only boundaries inherited solely for App Router search-param behavior were removed.
- The four pre-existing dead files carried through the migration and surfaced by this audit were removed; other unrelated dead code remains outside this cleanup.

### Subagent Contributions

- A dependency/configuration audit identified the obsolete Biome exclusion, stale API comment, redundant client-boundary files, and unreferenced local Next.js install entries.
- A route/import-graph audit confirmed which Suspense wrappers and moved files were migration residue and separated them from unrelated pre-existing dead code.

### Blockers / Follow-ups

- No repository blocker remains.

- Browser screenshot QA was not run because repository instructions prohibit it without an explicit request.

## 2026-07-30 11:30 +0300 - Codex / Migration Checker Retirement

### Scope

- Removed `scripts/check-no-next-artifacts.mjs` after the final audit and cleanup completed successfully.
- Removed `check:no-next-artifacts` from the root package scripts and restored `pnpm check` to the repository's ongoing validation concerns.
- Updated the migration plan to describe the artifact audit as a one-time migration gate whose results remain recorded in this work log.

### Commands Run

```bash
pnpm check
pnpm typecheck
git diff --check
```

### Results

- The normal workspace check passes without the migration-only command.
- Full workspace typecheck passes.
- Historical audit commands and results remain available in the preceding work-log entries.
- `git diff --check` passes.

### Decisions

- The completed audit is preserved through Git history and this work log instead of retaining a permanent checker for a finished migration.
- Ongoing regressions remain covered by package checks, typechecking, tests, production builds, dependency review, and the Vite/React Router-focused SPA shell tests.

### Blockers / Follow-ups

- No repository blocker remains.

## 2026-07-30 11:39 +0300 - Codex / Vite Dependency Pre-Bundling

### Scope

- Configured Vite dependency optimization to scan the HTML entry and every application TypeScript module, including lazy route modules.
- Excluded unit tests and Storybook stories from the application dev-server dependency graph.
- Added a focused SPA-shell assertion for the optimizer entry contract and documented cache rebuilding for dependency/configuration changes.
- Corrected the development guide's root `pnpm check` description after retirement of the migration-only checker.

### Commands Run

```bash
pnpm --filter web exec vite optimize --force
pnpm dev:web --force --host 127.0.0.1
curl --fail http://127.0.0.1:3000/dashboard
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
pnpm typecheck
pnpm check
git diff --check
```

The deprecated standalone `vite optimize` command was used only to inspect the discovered dependency set; normal development uses Vite's automatic optimizer through `pnpm dev:web`.

### Results

- Vite eagerly discovered and pre-bundled 30 runtime dependency entries, including React, React Router, TanStack Query, Recharts, Motion, date-fns, form libraries, and UI dependencies.
- Test-only and Storybook dependencies were not included in the application optimizer cache.
- A forced cold start completed in 309 ms, and `/dashboard` returned HTTP 200 from the dev server.
- Web check passed, all 182 web tests passed, and the production Vite build passed with the existing lazy route/chart chunks preserved.
- Full workspace typecheck and check passed.
- `git diff --check` passed.

### Decisions

- Use `optimizeDeps.entries` instead of a manually maintained `include` list. Vite can pre-bundle the actual packages reachable from all app modules while new runtime imports are discovered automatically.
- Keep this optimization development-only. Production code splitting remains driven by the existing lazy route and analytics imports.
- Browser screenshot QA was not run because repository instructions prohibit it without an explicit request.

### Blockers / Follow-ups

- No repository blocker remains.

## 2026-07-30 11:48 +0300 - Codex / Browser-Only Runtime Cleanup

### Scope

- Removed obsolete `typeof window === "undefined"` branches from the Vite runtime, Storybook preview, theme handling, responsive hooks, API URL resolution, email-verification redirects, and service-worker registration.
- Removed the unused server snapshot passed to `useSyncExternalStore`.
- Replaced the accent-color hydration pass with lazy browser storage initialization and removed its temporary disabled UI state.
- Removed first-mount gates that existed only to keep Next.js server and client renders aligned in the sortable account card and responsive select.
- Removed the unused account-preferences `isHydrated` return value while retaining its internal per-workspace storage synchronization guard.
- Corrected the root README after retirement of the migration-only artifact checker.

### Commands Run

```bash
rg -n 'typeof\s+(window|document|navigator|localStorage|sessionStorage)' packages/web
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
pnpm --filter web build:storybook
pnpm typecheck
pnpm check
git diff --check
```

### Results

- No direct `typeof window`, `typeof document`, `typeof navigator`, `typeof localStorage`, or `typeof sessionStorage` SSR guards remain in the web package.
- Web check passed, all 182 web tests passed, and both the application and Storybook production builds completed successfully.
- Full workspace typecheck and check passed.
- `git diff --check` passed.

### Decisions

- The Vite SPA runtime assumes browser globals because it mounts exclusively through `createRoot`; Node tests that call browser-only helpers provide explicit browser stubs.
- Keep `"serviceWorker" in navigator` because it detects an optional browser capability rather than an SSR environment.
- Keep the `typeof Element === "undefined"` branch in the pull-to-refresh helper because the pure helper is intentionally exercised in the Node-based unit-test environment.
- Keep dialog/Floating UI `mounted` state because it controls close transitions and portal lifecycles, not React hydration.
- Keep account-preference storage readiness keyed by workspace so switching workspaces cannot overwrite the new workspace's saved preferences with stale state.

### Subagent Contributions

- A browser-guard audit classified all frontend environment checks and identified the Node-sensitive pull-to-refresh helper and required HTTP-client test updates.
- A hydration-residue audit identified the responsive select's first-mount gate and confirmed which other `mounted`/storage readiness states remain behaviorally necessary.

### Blockers / Follow-ups

- No repository blocker remains.

- Browser screenshot QA was not run because repository instructions prohibit it without an explicit request.

## 2026-07-30 12:23 +0300 - Codex / Release Hardening

### Scope

- Made `VITE_API_URL` mandatory and validated for production builds while preserving the localhost default for the local development server.
- Centralized API base URL normalization and added focused tests for missing, malformed, credential-bearing, and non-HTTP URLs.
- Declared Vite's supported Node.js range at the workspace and web-package boundaries and pinned Node.js 24 in CI.
- Added a GitHub Actions verification workflow for frozen installation, typechecking, generated-client drift and Biome checks, the full test suite, and production builds.
- Explicitly declared Vercel's `dist` output directory in addition to the Vite framework and SPA history rewrite.
- Added Vite preload-error recovery for stale lazy chunks after a deployment and preserved URL hashes across the dashboard email-verification redirect.
- Updated the development prerequisites and SPA-shell contract test for the hardened deployment behavior.

### Commands Run

```bash
pnpm --filter web check
pnpm --filter web typecheck
pnpm --filter web test
VITE_API_URL="https://api-dev.finnn.xyz" pnpm --filter web build
VITE_API_URL="https://api-dev.finnn.xyz" pnpm --filter web build:storybook
VITE_API_URL="" pnpm --filter web build
pnpm typecheck
pnpm check
pnpm test
VITE_API_URL="https://api-dev.finnn.xyz" pnpm build
git diff --check
```

### Results

- A production build without `VITE_API_URL` now fails before bundling with an actionable configuration error.
- Web check and typecheck passed; all 193 web tests passed.
- Full workspace typecheck and check passed.
- The full test suite passed: API 267 tests passed / 12 skipped, web 193 passed, PostgreSQL backup 11 passed.
- API, Vite application, and Storybook production builds passed with an explicit DEV API origin.
- `git diff --check` passed.

### Decisions

- Keep the localhost API fallback only for `vite dev`; shared builds must never silently emit a browser bundle that calls the end user's localhost.
- Keep Vercel Git integration as the deployment owner; CI verifies the repository without duplicating Vercel deployment credentials or deployment steps.
- Reload the document on `vite:preloadError`, matching Vite's recommended recovery for version skew between a loaded SPA shell and newly deployed lazy chunks.
- Preserve the existing repository prohibition on browser screenshot QA; authenticated deployment and rollout checks are recorded separately.

### Subagent Contributions

- An environment-hardening pass implemented and tested API URL validation, Node.js compatibility metadata, and explicit Vercel output configuration.
- A CI pass added the secret-free GitHub Actions verification workflow.
- A read-only Vercel audit confirmed the exact project, effective monorepo root/build/output, current preview deployment, and stale project-level framework metadata.

### Blockers / Follow-ups

- Complete the authenticated Vercel environment/settings update, redeploy, and DEV/PROD rollout in the next work-log entry.
