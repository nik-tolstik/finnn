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
