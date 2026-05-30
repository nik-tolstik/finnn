# Backend Migration

This document describes the planned migration from the current single Next.js application to a `pnpm` monorepo with separate `web` and `api` packages.

The target state is:

- `packages/web` contains the Next.js App Router UI, TanStack Query integration, Tailwind CSS, PWA assets, and generated API client.
- `packages/api` contains the NestJS TypeScript API, authentication, Prisma/MongoDB access, email delivery, cron endpoints, and finance domain services.
- NestJS owns the backend contract and exports OpenAPI.
- Orval generates frontend TypeScript types and TanStack Query hooks from the backend OpenAPI document.
- The backend is deployed to Railway. The frontend remains a separate deployment and calls the Railway backend through `NEXT_PUBLIC_API_URL`.

## Current State

Finnn is currently a single Next.js App Router project.

Backend behavior is embedded in the Next.js app:

- Server actions live mostly in `src/modules/*/*.service.ts`.
- Transactional finance rules live in `src/modules/transactions/transaction.application.ts` and `src/modules/debts/debt.application.ts`.
- NextAuth is exposed through `src/app/api/auth/[...nextauth]/route.ts`.
- Exchange-rate proxy and cron routes live under `src/app/api`.
- Prisma Client and MongoDB access are imported directly from server-side Next.js code.
- Workspace authorization is enforced with `requireUserId` and `requireWorkspaceAccess`.
- Validation schemas live in `src/shared/lib/validations`.

Frontend behavior is tightly coupled to these server boundaries:

- Dashboard pages prefetch server data and hydrate TanStack Query.
- Client components call server actions directly.
- Query keys are centralized in `src/shared/lib/query-keys.ts`.
- Optimistic cache updates live in `src/shared/lib/optimistic-workspace-updates.ts`.
- The service worker must not cache financial documents, API responses, dashboard routes, server action responses, or data routes.

## Target Architecture

The repository should become a monorepo:

```text
.
├── package.json
├── pnpm-workspace.yaml
├── packages
│   ├── api
│   │   ├── src
│   │   ├── prisma
│   │   ├── test
│   │   ├── .env.example
│   │   ├── railway.json
│   │   ├── package.json
│   │   └── nest-cli.json
│   └── web
│       ├── src
│       ├── public
│       ├── .env.example
│       ├── orval.config.ts
│       ├── package.json
│       └── next.config.ts
└── docs
```

Root-level scripts should orchestrate package scripts through `pnpm --filter`. Example targets:

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm --filter api dev
pnpm --filter api build
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web api:generate
```

Recommended root scripts:

```json
{
  "dev": "pnpm -r --parallel --filter api --filter web dev",
  "dev:api": "pnpm --filter api dev",
  "dev:web": "pnpm --filter web dev",
  "build": "pnpm --filter api build && pnpm --filter web build",
  "typecheck": "pnpm --filter api typecheck && pnpm --filter web typecheck",
  "check": "pnpm --filter api check && pnpm --filter web check",
  "test": "pnpm --filter api test && pnpm --filter web test",
  "api:generate": "pnpm --filter api openapi:generate && pnpm --filter web api:generate"
}
```

API package ownership after migration:

- Authentication, registration, email verification, password validation, token/session issuance, and logout.
- Workspace authorization and role checks.
- Prisma schema, Prisma Client generation, MongoDB reads/writes, and database scripts.
- Accounts, categories, transactions, transfers, debts, analytics, currency, exchange-rate persistence, import/export, and email services.
- Cron endpoint for daily exchange-rate updates.
- OpenAPI document generation and API versioning.

Web package ownership after migration:

- App Router pages, layouts, forms, dashboard UI, analytics UI, and PWA assets.
- TanStack Query cache behavior and optimistic UI updates.
- Calling only generated API clients for backend data.
- No direct imports from Prisma, NestJS internals, backend domain services, or server action files.

Environment ownership:

- `packages/api/.env` is the only local env file that may contain server secrets such as `DATABASE_URL`, auth token secrets, SMTP credentials, `CRON_SECRET`, and external provider credentials.
- `packages/web/.env` is the local env file for browser-safe and Next.js frontend configuration such as `NEXT_PUBLIC_API_URL` and public app URL values.
- Each package should keep its own `.env.example` next to its `.env` file.
- The root `.env` should be removed after migration or kept only for root-level tooling that truly runs outside both packages.
- Do not duplicate backend-only secrets into `packages/web/.env`.

## Migration Phases

Keep a progress log while implementing this plan. Add a `## Migration Progress` section to this document when work starts, and update it after every meaningful step or phase.

Implementation should happen on a dedicated branch:

```bash
git switch -c refactor/migration-to-server
```

If the branch already exists, switch to it and continue from the latest `Migration Progress` entry.

Each progress entry should include:

- Date.
- Phase number or affected package.
- What changed.
- Verification that passed.
- Known follow-up work or blockers.

Use this format:

```md
## Migration Progress

- 2026-05-25 - Phase 1 - Moved the Next.js app to `packages/web`; `pnpm --filter web build` passes. Follow-up: split env examples.
```

Agent execution rules:

- Use subagents when they reduce risk or latency during exploration, implementation, or verification.
- Use `gpt5.5 high` for explorer subagents that need to inspect broad code areas, compare patterns, or produce migration findings.
- Use `gpt5.3-codex-spark` for worker subagents that implement focused, well-scoped changes.
- Important: `gpt5.3-codex-spark medium` has a small context window. Give it short, concrete tasks with minimal required files, explicit expected output, and no broad investigation scope.
- Record meaningful subagent findings and completed worker tasks in `Migration Progress` so the main thread stays auditable.
- After completing a migration task and recording verification, commit the full relevant change set and push the migration branch.

Testing rules:

- Treat the migration as a test-hardening opportunity. Add or improve tests for every module as it moves to `api`.
- Do not only port existing tests; add missing coverage for uncovered auth, workspace access, validation, error handling, and financial edge cases.
- Prefer focused unit and application-service tests for business rules, plus API/controller tests for auth, guards, request validation, and OpenAPI-visible behavior.
- Keep regression tests near the migrated module and record the new or updated test files in `Migration Progress`.
- Before deleting old `web` server-action code, confirm the equivalent `api` behavior has tests.

## Migration Progress

- 2026-05-25 - Phase 1 - Started the monorepo migration on `refactor/migration-to-server`; confirmed there was no existing real `Migration Progress` section and began from Phase 1. Verification pending.
- 2026-05-25 - Phase 1 - Moved the existing Next.js app, Prisma schema, scripts, public assets, and frontend config into `packages/web`; added root `pnpm-workspace.yaml` and root package scripts that delegate to `web`; renamed the package to `web`. `pnpm install` passed and generated Prisma Client from `packages/web/prisma/schema.prisma`. Follow-up: run Phase 1 web verification and fix any moved-path issues.
- 2026-05-25 - Phase 1 - Added `packages/web/.gitignore` so package-local Biome can read an ignore file after the move. Verification passed: `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm --filter web exec prisma validate`, `pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts`, and `pnpm install --frozen-lockfile`. `pnpm --filter web dev` reached Ready on `http://localhost:3000` and was then stopped manually.
- 2026-05-25 - Phase 1 - Explorer subagent completed a read-only risk scan. Findings: docs outside this migration plan still describe root-level `src`, `prisma`, `scripts`, and `public`; `packages/web/.env.example` remains a Phase 1 transitional example because NextAuth, Prisma, SMTP, and cron still live in web until the API package exists; Vercel must either use `packages/web` as the project root or keep an intentional root-level Vercel config. Follow-up: update broad docs and deployment notes as the monorepo split stabilizes.
- 2026-05-25 - Phase 2 - Scaffolded `packages/api` as a NestJS TypeScript application with global validation, consistent JSON error responses, credentialed CORS from `API_ALLOWED_ORIGINS`, `PORT` plus `0.0.0.0` listen settings, `/health`, package-local Biome/Vitest/TypeScript config, and `packages/api/railway.json`. Added smoke coverage for `/health`, validation errors, CORS options, and bootstrap listen defaults. Verification passed: `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, and runtime `GET http://127.0.0.1:4010/health` returned `200 {"status":"ok"}` before the local server was stopped manually. Follow-up: Phase 3 auth endpoints and guards.
- 2026-05-25 - Phase 2 - Moved Prisma ownership to `packages/api/prisma/schema.prisma`; moved database seed/export/import scripts to `packages/api/scripts`; added `packages/api/.env.example` for backend-only variables; reduced `packages/web/.env.example` to frontend-safe public variables; updated root scripts to orchestrate `api` and `web` through package filters. Verification passed: `pnpm install`, `DATABASE_URL="mongodb://localhost:27017/finnn" pnpm --filter api exec prisma validate --schema prisma/schema.prisma`, `pnpm --filter web typecheck`, and `pnpm --filter web build`. Follow-up: `packages/web` still temporarily imports Prisma and server-action backend helpers until later migration phases replace them with API calls.
- 2026-05-25 - Phase 2 - Explorer subagent completed a read-only scaffold risk scan. Findings: keep `@prisma/client` and `prisma` in `packages/web` until server actions are removed; env loading in `packages/api/src/common/env/load-env.ts` is cwd-based and expects package-filtered commands or a Railway root of `packages/api`; `packages/web/vercel.json` still owns the old Next cron route until cron moves to the API package.
- 2026-05-25 - Phase 3 - Explorer subagent mapped the existing NextAuth/server-action auth surface and recommended starting with backend-owned registration and email verification before replacing web sessions. Implemented the first NestJS auth slice in `packages/api`: Prisma and email modules, `POST /auth/register`, `POST /auth/verify-email/:token`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, authenticated `PATCH /auth/user`, HTTP-only cookie helpers, and an `AuthSession` Prisma model for API-owned sessions. Added mocked API coverage in `packages/api/test/auth.e2e.test.ts` for registration success, existing users, expired pending registrations, email rollback, verification, unverified login denial, cookie issuance, session lookup, and guarded user updates. Verification passed: `pnpm install`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, and `DATABASE_URL="mongodb://localhost:27017/finnn" pnpm --filter api exec prisma validate --schema prisma/schema.prisma`. Follow-up: wire `web` to the API auth endpoints after OpenAPI/Orval is established, port workspace invite acceptance and workspace guards, then remove NextAuth only after equivalent web flows are verified.
- 2026-05-25 - Phase 3 - Explorer subagent mapped workspace access, invite acceptance, and role checks, recommending an API-only workspace slice before web wiring. Added `packages/api/src/workspace` with workspace role constants, `WorkspaceAccessGuard`, invite DTOs, workspace controllers, API-owned invite preview/accept/create endpoints, and invite email delivery through `EmailService` with rollback when sending fails. Added `packages/api/test/workspace.e2e.test.ts` covering owner invite creation and email sending, member access denial, email rollback, public invite preview, unauthenticated accept denial, successful accept, and email mismatch denial. Verification passed: `pnpm --filter api test test/workspace.e2e.test.ts`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, and `DATABASE_URL="mongodb://localhost:27017/finnn" pnpm --filter api exec prisma validate --schema prisma/schema.prisma`. Follow-up: add OpenAPI/Orval generation, wire `web` auth and invite flows to generated clients, and broaden workspace endpoints before removing old server actions.
- 2026-05-26 - Phase 4 - Explorer subagent completed a read-only OpenAPI/Orval gap scan and found missing Swagger setup, response DTOs, cookie-auth metadata, Orval config, and a credentialed web mutator. Added NestJS Swagger setup with `GET /openapi.json`, formatted `packages/api/openapi.json` generation, explicit auth/workspace/health request and response DTO metadata, cookie auth security metadata, `pnpm api:generate`, Orval `tags-split` generation into `packages/web/src/shared/api/generated`, and a `credentials: "include"` web fetch mutator. Added `pnpm api:check-generated` and wired it into `pnpm check` so stale OpenAPI/Orval output fails the check. Verification passed: `pnpm api:generate`, `pnpm api:check-generated`, `pnpm check`, `pnpm --filter api typecheck`, `pnpm --filter web typecheck`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: use the generated clients to wire `web` auth and invite flows, continue adding Swagger metadata as more domain modules move to `api`, and revisit Orval hook ergonomics while replacing server actions.
- 2026-05-26 - Migration workflow - Added the agent execution rule that completed migration tasks must be committed and pushed after verification is recorded. Verification: documentation-only change.
- 2026-05-26 - Phase 5 - Explorer subagent recommended starting Phase 5 with core workspace read endpoints before frontend session rewiring. Added API-owned workspace endpoints for create, list, detail, summary, members, update, delete, and leave under `packages/api/src/workspace`, with explicit Swagger DTOs and regenerated Orval clients in `packages/web/src/shared/api/generated`. Added e2e coverage for workspace creation with default categories, accessible workspace listing, authorized summary/member reads, member de-duplication, admin updates, member leave, owner delete, owner leave denial, and existing invite behavior in `packages/api/test/workspace.e2e.test.ts`. Verification passed: `pnpm --filter api test test/workspace.e2e.test.ts`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter web typecheck`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web check`, and `pnpm --filter web build`. Follow-up: wire `web` workspace reads/mutations to generated direct client functions once API cookie auth is available to the frontend; revisit Orval hook ergonomics because generated direct functions are correct but several hooks remain mutation-style under the current global Orval settings.
- 2026-05-26 - Phase 5 - Explorer subagent mapped accounts and categories server-action behavior, dependency counts, validation, and cache-shape risks. Added API-owned accounts and categories endpoints under `packages/api/src/accounts` and `packages/api/src/categories` for active/archived account reads, account create/update/archive/unarchive/delete/order, category create/list/update/delete/order, and category transaction counts. Added Swagger DTO metadata, regenerated `packages/api/openapi.json`, and regenerated Orval clients in `packages/web/src/shared/api/generated`. Added mocked e2e coverage in `packages/api/test/accounts.e2e.test.ts` and `packages/api/test/categories.e2e.test.ts` for auth denial, workspace access denial, order calculation, archived account dependency counts and deletion rules, category type filtering, category reorder validation, and transaction count access checks. Verification passed: `pnpm --filter api test test/accounts.e2e.test.ts test/categories.e2e.test.ts`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm --filter web typecheck`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web check`, `pnpm --filter web build`, and `pnpm --filter web test`. Follow-up: wire `web` account/category reads and mutations to the generated API clients, then remove the old server actions after cache shapes and optimistic updates are migrated.
- 2026-05-26 - Phase 5 - Explorer subagent mapped payment transaction and transfer server actions, balance rules, combined-list filters, and web cache-shape risks. Added API-owned transaction endpoints under `packages/api/src/transactions` for combined transaction reads, payment create/update/delete, and transfer create/update/delete, preserving string-money balance deltas, optional new payment categories, amount-range post-filtering, default debt transaction inclusion in the combined read, and owner-or-member workspace access. Added Swagger DTO metadata, regenerated `packages/api/openapi.json`, and regenerated Orval clients in `packages/web/src/shared/api/generated`. Added mocked e2e coverage in `packages/api/test/transactions.e2e.test.ts` for auth denial, workspace access denial, combined filter pushdown and amount post-filtering, payment balance updates and over-balance rejection, category disconnect updates, owner access without member rows, transfer balance deltas, same-account transfer rejection, and transfer deletion rollback. Verification passed: `pnpm --filter api test test/transactions.e2e.test.ts`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter web typecheck`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm check`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: wire `web` transaction reads and mutations to the generated API clients, then migrate debts and debt transactions before removing old transaction server actions.
- 2026-05-26 - Phase 5 - Explorer subagent mapped debt server actions, debt application balance rules, Prisma fields, and OpenAPI shape risks. Added API-owned debt endpoints under `packages/api/src/debts` for debt list/create/edit-data/update/add/close/delete and debt transaction update/delete, preserving string-money arithmetic, owner-or-member workspace access, account balance reconciliation, initial transaction handling, overpayment/early-close category payment behavior, cross-currency close validation, and created debt transaction guardrails. Added Swagger DTO metadata, regenerated `packages/api/openapi.json`, and regenerated Orval clients in `packages/web/src/shared/api/generated`. Added mocked e2e coverage in `packages/api/test/debts.e2e.test.ts` for auth denial, workspace access denial, list filters, account-backed creation, missing account/currency validation, same-currency overpayment close, cross-currency validation, add-to-debt balance deltas, edit-data fallback, debt update paid-amount bounds, debt transaction balance reconciliation, created transaction edit/delete rejection, debt transaction deletion rollback, and debt deletion rollback. Verification passed: `pnpm --filter api test test/debts.e2e.test.ts`, `pnpm --filter api typecheck`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: wire `web` debt reads and mutations to generated API clients, then migrate analytics and currency/exchange-rate/cron modules before removing old debt server actions.
- 2026-05-26 - Phase 5 - Explorer subagent mapped analytics server-action behavior, transaction filter semantics, exchange-rate conversion dependencies, OpenAPI response-shape risks, and e2e coverage gaps. Added API-owned analytics under `packages/api/src/analytics` with `GET /workspaces/:workspaceId/analytics/overview`, authenticated workspace access, top-level overview response DTOs, current/previous period aggregation, mixed transaction filtering, open-debt exposure, largest movement sorting, and API errors for missing exchange rates. Added a backend currency module with exchange-rate preloading support and a shared API money formatter used by analytics, then regenerated `packages/api/openapi.json` and Orval clients in `packages/web/src/shared/api/generated`. Added mocked e2e coverage in `packages/api/test/analytics.e2e.test.ts` for unauthenticated denial, workspace access denial, converted totals, comparisons, time series, expense categories, open debts, largest movements, implicit and reversed date ranges, debt transaction exclusion by filter, amount/category filtering across mixed transaction types, and exchange-rate failure handling. Verification passed: `pnpm --filter api test test/analytics.e2e.test.ts`, `pnpm api:generate`, `pnpm check`, `pnpm typecheck`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: wire `web` analytics reads to the generated API client, then migrate currency, exchange-rate, cron, and MongoDB import/export workflows before removing old analytics and currency server actions.
- 2026-05-26 - Phase 5 - Explorer subagent mapped the remaining currency, exchange-rate, and cron surface, including `web` server actions, the old Next.js exchange-rate proxy and cron route, `ExchangeRate` Prisma storage, provider fallback behavior, and ticker/transfer frontend consumers. Added API-owned currency and cron endpoints under `packages/api/src/currency`: `GET /exchange-rates`, `GET /exchange-rates/rate`, `GET /exchange-rates/today`, `GET /exchange-rates/yesterday`, and protected `GET /cron/update-exchange-rates`. Preserved UTC-midnight normalization, DB-first exchange-rate lookup, BYN base-rate storage for USD/EUR, cross-rate derivation, same-currency shortcut behavior, NBRB fallback handling, daily upserts, and bearer `CRON_SECRET` protection. Added Swagger DTO metadata, regenerated `packages/api/openapi.json`, and regenerated Orval clients in `packages/web/src/shared/api/generated`. Added mocked e2e coverage in `packages/api/test/currency.e2e.test.ts` for stored cross-rates, invalid query validation, missing-date fetch and upsert, fallback provider rates, cron auth denial, and cron daily persistence. Verification passed: `pnpm --filter api test test/currency.e2e.test.ts`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter web typecheck`, `pnpm check`, `pnpm --filter web test`, `pnpm --filter web build`, and `pnpm typecheck`. Follow-up: wire `web` exchange-rate ticker and transfer amount sync to generated API clients, move the production cron schedule off the old web route, then migrate MongoDB import/export and seed workflows before removing old web currency server actions and API routes.
- 2026-05-26 - Phase 5 - Explorer subagent scanned MongoDB import/export and seed workflow gaps, confirming scripts already live in `packages/api` but lacked focused tests and had stale docs. Hardened `packages/api/scripts/mongo-export.ts`, `packages/api/scripts/mongo-import.ts`, and `packages/api/scripts/db-seed.ts` with importable runners, `pnpm -- ...` CLI separator handling, production import protection unless `--allow-production` is passed, manifest import count validation, strict missing `DATABASE_URL` errors, and unconditional transfer cleanup during seed. Added script coverage in `packages/api/test/mongo-scripts.test.ts` and `packages/api/test/db-seed.test.ts`; updated README, development, and operations docs for package-local env files, `packages/api/scripts`, API-owned cron, and safe import examples. Verification passed: `pnpm --filter api test test/mongo-scripts.test.ts test/db-seed.test.ts`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm check`, `DATABASE_URL="mongodb://localhost:27017/finnn" pnpm --filter api exec prisma validate --schema prisma/schema.prisma`, and a live throwaway MongoDB round trip with `pnpm --filter api db:seed`, `pnpm --filter api db:export -- /tmp/finnn-migration-backup`, `pnpm --filter api db:import -- /tmp/finnn-migration-backup --drop --db=finnn_migration_import_verify`, and a second export from the imported database. Follow-up: wire `web` domain flows to generated API clients, move production scheduling fully to the API cron endpoint, and start Phase 6 removal of old frontend backend code once API client usage is complete.
- 2026-05-26 - Phase 6 - Rewired the frontend exchange-rate ticker and transfer amount sync hook to generated Orval currency client functions, removed the old `packages/web` exchange-rate proxy route, removed the old `packages/web` cron route and Vercel cron config, and updated exchange-rate architecture docs to point at `packages/api/src/currency`. Verification passed: `pnpm --filter web typecheck`, `pnpm --filter api test test/currency.e2e.test.ts`, `pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts`, `pnpm api:check-generated`, `pnpm --filter web build`, `pnpm check`, and `pnpm --filter web test`. Follow-up: continue wiring remaining `web` domain flows to generated API clients, then remove obsolete server-action services and NextAuth once frontend auth is fully on API cookies.
- 2026-05-26 - Phase 6 - Explorer subagent recommended the smallest safe frontend auth slice: move public registration and email verification to generated Orval direct client functions before replacing NextAuth/session ownership. Rewired `packages/web` registration and verify-email pages to call `register` and `verifyEmail` from `packages/web/src/shared/api/generated/auth/auth.ts`, removed the old `registerAction` and `verifyEmail` backend logic from `packages/web/src/modules/auth/auth.service.ts`, and kept `updateUser` on the old server-action path until API cookie sessions replace NextAuth. Verification passed: `pnpm --filter web typecheck`, `pnpm api:check-generated`, `pnpm --filter api test test/auth.e2e.test.ts`, `pnpm --filter web check`, `pnpm --filter web build`, and `pnpm --filter web test`. Follow-up: migrate login/logout/session/update-user and invite acceptance to API cookie auth, then remove the NextAuth route and remaining web auth server helpers.
- 2026-05-26 - Phase 6 - Explorer subagent mapped the remaining frontend auth/session/invite surfaces and called out the SSR cookie-forwarding risk. Replaced `next-auth/react` with a web API session provider backed by `GET /auth/session`, added a server-side API session bridge that forwards the `finnn_session` cookie for App Router redirects and transitional server actions, rewired login/logout/session refresh/update-user/invite preview/invite acceptance/invite creation to generated Orval client functions, removed the NextAuth route, NextAuth helper files, web auth server action, web SMTP email helper, and web-only NextAuth/email/backend dependencies. Added `packages/web/src/shared/lib/api-session.test.ts` for the server session cookie bridge and updated `docs/architecture.md`. Verification passed: `pnpm install --frozen-lockfile`, `pnpm --filter web test src/shared/lib/api-session.test.ts`, `pnpm --filter api test test/auth.e2e.test.ts test/workspace.e2e.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm api:check-generated`, `pnpm check`, `pnpm typecheck`, `pnpm --filter api test`, and `pnpm --filter api build`. Follow-up: wire remaining workspace/account/category/transaction/debt/analytics reads and mutations to generated API clients, then delete the transitional `web` server-action modules and Prisma/server-access helpers.
- 2026-05-26 - Phase 6 - Explorer subagent mapped the workspace frontend wiring surface and recommended a thin generated-client adapter to preserve current UI cache shapes. Replaced `packages/web/src/modules/workspace/workspace.service.ts` internals with API-backed calls for workspace create/list/summary/members/update/leave, added shared server API request options that forward the `finnn_session` cookie with `cache: "no-store"`, removed Prisma/server-access/business-rule imports from the workspace module, and decoupled `workspace.types.ts` from Prisma types. Added `packages/web/src/modules/workspace/workspace.service.test.ts` for API DTO unwrapping, cookie option forwarding, mutation revalidation, and error normalization; extended `packages/web/src/shared/lib/api-session.test.ts`; updated `docs/architecture.md` to document transitional API-backed service adapters. Verification passed: `pnpm --filter web test src/shared/lib/api-session.test.ts src/modules/workspace/workspace.service.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/workspace.e2e.test.ts`, `pnpm --filter web test`, `pnpm --filter web build`, and `pnpm api:check-generated`. Follow-up: wire account/category reads and mutations to generated API clients, then remove remaining web Prisma/server-action code module by module.
- 2026-05-26 - Phase 6 - Explorer subagent mapped the account/category frontend adapter risks: preserve existing `ActionResult` cache payloads, convert API date strings back to `Date`, normalize account owners, pass archived account dependency counts through, and keep category `_count.paymentTransactions` from API `transactionCount`. Replaced `packages/web/src/modules/accounts/account.service.ts` and `packages/web/src/modules/categories/category.service.ts` internals with generated Orval client adapters that forward the `finnn_session` cookie through `getServerApiRequestOptions`, removed Prisma/server-access/business-rule imports from those services, preserved mutation revalidation, serialized account mutation dates to ISO strings, and synthesized success results for void delete endpoints. Added `packages/web/src/modules/accounts/account.service.test.ts` and `packages/web/src/modules/categories/category.service.test.ts` for DTO unwrapping, request option forwarding, legacy shape mapping, revalidation, date serialization, archived counts, category counts, and error normalization. Verification passed: `pnpm --filter web test src/modules/accounts/account.service.test.ts src/modules/categories/category.service.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/accounts.e2e.test.ts test/categories.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm check`, `pnpm typecheck`, `pnpm --filter api test`, `pnpm --filter api build`, and `pnpm test`. Follow-up: wire transaction, debt, analytics, and remaining currency web services to generated API clients, then remove leftover web Prisma/server-action helpers.
- 2026-05-26 - Phase 6 - Explorer subagent mapped transaction frontend adapter requirements and DTO shape risks. Replaced `packages/web/src/modules/transactions/transaction.service.ts` internals with generated Orval transaction client adapters that forward the `finnn_session` cookie, serialize mutation dates to ISO strings, convert response date strings back to `Date`, preserve combined transaction pagination/total payloads, normalize nullable owners/categories/debt fields, keep legacy `ActionResult` success/error shapes, and revalidate accounting routes after mutations. Removed the obsolete web-side `packages/web/src/modules/transactions/transaction.application.ts` Prisma transaction logic and decoupled `transaction.types.ts` from Prisma model types. Replaced the old Prisma query-pushdown service test with `packages/web/src/modules/transactions/transaction.service.test.ts` covering generated-client forwarding, combined DTO mapping, mutation unwrapping, date serialization, success synthesis, revalidation, and error normalization. Verification passed: `pnpm --filter web test src/modules/transactions/transaction.service.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/transactions.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: wire debt and analytics web services to generated API clients, then remove remaining Prisma-backed web backend helpers and transitional Prisma type imports from UI-only components.
- 2026-05-26 - Phase 6 - Explorer subagent mapped the remaining debt/analytics frontend slices and noted analytics as the next smallest untouched read-only adapter, while debt was already in progress and should be completed first. Replaced `packages/web/src/modules/debts/debt.service.ts` internals with generated Orval debt client adapters that forward the `finnn_session` cookie, serialize debt and debt-transaction mutation dates to ISO strings, convert API debt/debt-transaction response dates back to `Date`, preserve list pagination totals, keep legacy `ActionResult` shapes for mutations, synthesize success results for void delete endpoints, and revalidate debt routes after mutations. Removed obsolete web-side Prisma debt application logic in `packages/web/src/modules/debts/debt.application.ts` and decoupled `debt.types.ts` from Prisma model types. Replaced the old Prisma transaction-focused debt service test with `packages/web/src/modules/debts/debt.service.test.ts` covering generated-client forwarding, list/filter mapping, mutation unwrapping, date serialization, edit-data and debt-transaction response mapping, delete success synthesis, revalidation, and error normalization. Verification passed: `pnpm --filter web test src/modules/debts/debt.service.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/debts.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, `pnpm --filter web build`, `pnpm check`, and `pnpm typecheck`. Follow-up: wire analytics web reads to the generated API client, then remove remaining web Prisma/backend helpers and transitional Prisma type imports from UI-only components.
- 2026-05-26 - Phase 6 - Replaced `packages/web/src/modules/analytics/analytics.service.ts` with a generated Orval analytics client adapter that forwards the `finnn_session` cookie, maps frontend transaction filters to API query params, preserves the legacy `AnalyticsOverviewResult | { error }` return shape, and normalizes optional API percentage-change fields to `null`. Replaced the old Prisma/exchange-rate mocked analytics service test with `packages/web/src/modules/analytics/analytics.service.test.ts` covering request option forwarding, filter mapping, empty-filter omission, response shape preservation, movement kinds, and error normalization. Verification passed: `pnpm --filter web test src/modules/analytics/analytics.service.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/analytics.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: migrate the remaining web currency/exchange-rate service backend logic and then remove leftover web Prisma/server-access helpers plus transitional Prisma type imports from UI-only components.
- 2026-05-26 - Phase 6 - Explorer subagent confirmed the next smallest cleanup was the remaining frontend currency backend residue and Prisma currency enum coupling. Removed the obsolete web-only `packages/web/src/modules/currency/currency.service.ts`, `packages/web/src/modules/currency/exchange-rate.service.ts`, and their old Prisma/provider mocked tests now that ticker and transfer flows use generated Orval currency clients. Added a frontend-owned `Currency` object/type in `packages/web/src/shared/constants/currency.ts` with the same `BYN`, `USD`, and `EUR` wire values, and moved currency-specific UI/validation imports off `@prisma/client` in the exchange-rate ticker, account creation, transfer amount sync, transfer form, and account validation schema. Verification passed: `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/currency.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: remove remaining `@prisma/client` type imports from UI-only account/category/debt/transaction components, then delete unused `packages/web` Prisma/server-access/database env helpers and drop the temporary web Prisma dependencies.
- 2026-05-26 - Phase 6 - Explorer subagent mapped the remaining web Prisma type cleanup. Added frontend-owned `Account`, `UserReference`, `AccountWithOwner`, `ArchivedAccount`, `Category`, and `CategoryWithCount` types, moved UI-only account/category/debt/transaction/shared component imports off `@prisma/client`, deleted unused `packages/web/src/shared/lib/prisma.ts`, `server-access.ts`, `database-url.ts`, and `load-env.ts`, and removed `@prisma/client`, `prisma`, the unused web `db:studio` script, and unused `tsx` dependency from `packages/web/package.json`. Verification passed: clean `rg` scan for `@prisma/client`, web Prisma helpers, and `DATABASE_URL`; `pnpm install --frozen-lockfile`; `pnpm --filter web typecheck`; `pnpm --filter web check`; `pnpm --filter web test`; `pnpm --filter web build`; `pnpm api:check-generated`; `pnpm check`; `pnpm typecheck`; and `pnpm test`. Follow-up: remove remaining transitional `web` server-action service wrappers after their callers move directly to generated API hooks/client functions, then reassess whether `packages/web/src/shared/lib/auth-session.ts` is still needed as an alias.
- 2026-05-26 - Phase 6 - Removed the obsolete `packages/web/src/shared/lib/auth-session.ts` compatibility alias after moving server session callers to `packages/web/src/shared/lib/api-session.ts` directly, and refreshed architecture docs to describe API-backed adapters instead of the old auth-session bridge. Explorer subagent identified `packages/web/src/modules/analytics/analytics.service.ts` as the next smallest server-action wrapper to remove because it is read-only and has only two runtime callers. Verification passed: clean `rg` scan for active `auth-session` web imports, `pnpm --filter web test src/shared/lib/api-session.test.ts`, `pnpm --filter web typecheck`, and `pnpm --filter web check`. Follow-up: replace the analytics web service wrapper with direct generated Orval usage, then continue the remaining `web` API-backed `*.service.ts` wrapper removals.
- 2026-05-26 - Phase 6 - Removed the analytics web server-action wrapper by deleting `packages/web/src/modules/analytics/analytics.service.ts`; the analytics server page and client content now call the generated Orval `getAnalyticsOverview` function directly, with pure `analytics.api.ts` helpers for filter mapping, DTO normalization, and legacy error result mapping. Replaced the service test with `packages/web/src/modules/analytics/analytics.api.test.ts`. Context7 TanStack Query docs confirmed the existing `prefetchQuery` and `useQuery` query function shapes support direct async generated-client calls. Verification passed: clean `rg` scan for analytics service/use-server references in the analytics slice, `pnpm --filter web test src/modules/analytics/analytics.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm api:check-generated`, `pnpm --filter api test test/analytics.e2e.test.ts`, and `pnpm --filter web build`. Follow-up: continue removing the remaining `web` API-backed server-action wrappers for workspace, accounts, categories, transactions, and debts once their callers can move to generated Orval hooks/client functions.
- 2026-05-26 - Phase 6 - Removed the workspace web server-action wrapper by replacing `packages/web/src/modules/workspace/workspace.service.ts` with pure `packages/web/src/modules/workspace/workspace.api.ts`; workspace client components now call the generated API adapter directly, and server-rendered dashboard/analytics/debts pages pass `getServerApiRequestOptions()` so the `finnn_session` cookie is forwarded during prefetches. Replaced `packages/web/src/modules/workspace/workspace.service.test.ts` with `packages/web/src/modules/workspace/workspace.api.test.ts`, updated architecture docs for pure frontend API adapters, and recorded the explorer subagent finding that categories are the next lowest-risk wrapper to remove because they have simple DTO mapping and existing API coverage. Verification passed: clean `rg` scan for `workspace.service` references and workspace `"use server"` files, `pnpm --filter web test src/modules/workspace/workspace.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter api test test/workspace.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, and `pnpm --filter web build`. Follow-up: remove the category wrapper next, then continue accounts, transactions, and debts.
- 2026-05-26 - Phase 6 - Removed the category web server-action wrapper by replacing `packages/web/src/modules/categories/category.service.ts` with pure `packages/web/src/modules/categories/category.api.ts`; dashboard and analytics server prefetches pass `getServerApiRequestOptions()` as the third `getCategories` argument to preserve the optional type filter, while client category consumers call the adapter directly through the generated API client. Preserved legacy category `Date`, `icon: null`, `_count.paymentTransactions`, mutation success, and transaction-count result shapes; replaced `packages/web/src/modules/categories/category.service.test.ts` with `packages/web/src/modules/categories/category.api.test.ts`. Explorer subagent confirmed the main risks were preserving legacy DTO shapes, cache keys, and server request option ordering. Verification passed: clean `rg` scan for `category.service` references and category `"use server"` files, `pnpm --filter web test src/modules/categories/category.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter api test test/categories.e2e.test.ts`, `pnpm api:check-generated`, `pnpm --filter web test`, `pnpm --filter web check`, and `pnpm --filter web build`. Follow-up: remove the account wrapper next, then continue transactions and debts.
- 2026-05-27 - Phase 6 - Removed the account web server-action wrapper by replacing `packages/web/src/modules/accounts/account.service.ts` with pure `packages/web/src/modules/accounts/account.api.ts`; dashboard and analytics server prefetches pass `getServerApiRequestOptions()` as the second `getAccounts` argument, while account, transaction, debt, and analytics client consumers call the API adapter directly through the generated client. Preserved legacy `ActionResult` shapes, account owner/null normalization, `Date` conversion, ISO mutation date serialization, archived account `_count` passthrough, and order update payloads; replaced `packages/web/src/modules/accounts/account.service.test.ts` with `packages/web/src/modules/accounts/account.api.test.ts`. Explorer subagent confirmed no remaining `account.service` imports and identified dashboard/analytics as the only server-side account prefetches that needed cookie forwarding. Verification passed: clean `rg` scan for `account.service` references and account `"use server"` files, `pnpm --filter web test src/modules/accounts/account.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm api:check-generated`, `pnpm --filter api test test/accounts.e2e.test.ts`, and `pnpm --filter web build`. Follow-up: remove the transaction wrapper next, then continue debts.
- 2026-05-27 - Phase 6 - Removed the transaction web server-action wrapper by replacing `packages/web/src/modules/transactions/transaction.service.ts` with pure `packages/web/src/modules/transactions/transaction.api.ts`; the dashboard server prefetch passes `getServerApiRequestOptions()` as the third `getCombinedTransactions` argument, while dashboard, create/edit transaction, create/edit transfer, and combined-list client consumers call the API adapter directly. Preserved combined transaction pagination, filter mapping, `Date` conversion, ISO mutation date serialization, nullable account/category/debt/user fields, payment/transfer response unwrapping, and synthesized success results for transfer update and deletes; replaced `packages/web/src/modules/transactions/transaction.service.test.ts` with `packages/web/src/modules/transactions/transaction.api.test.ts` and updated the contributor guide test path. Explorer subagent confirmed no remaining runtime `transaction.service` imports and identified dashboard as the only server-side transaction prefetch that needed cookie forwarding. Verification passed: clean `rg` scan for `transaction.service` references and transaction `"use server"` files, `pnpm --filter web test src/modules/transactions/transaction.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm api:check-generated`, `pnpm --filter api test test/transactions.e2e.test.ts`, and `pnpm --filter web build`. Follow-up: remove the debt wrapper next.
- 2026-05-27 - Phase 6 - Removed the debt web server-action wrapper by replacing `packages/web/src/modules/debts/debt.service.ts` with pure `packages/web/src/modules/debts/debt.api.ts`; debt and combined-transaction client consumers now call the API adapter directly, and no debt server prefetches needed cookie forwarding. Preserved debt list pagination/filter mapping, legacy `ActionResult` mutation shapes, debt and debt-transaction `Date` conversion, ISO mutation date serialization, nullable account/owner normalization, edit-data wrapping, and synthesized success results for void delete endpoints. Replaced `packages/web/src/modules/debts/debt.service.test.ts` with `packages/web/src/modules/debts/debt.api.test.ts`, removed the now-unused `packages/web/src/shared/lib/revalidate-app-routes.ts`, refreshed docs that referenced route revalidation and the old debt test path, and recorded the explorer subagent finding that there were no server-side debt prefetches. Verification passed: clean `rg` scans for active `debt.service`, debt `"use server"`, and `revalidate-app-routes` references; clean `rg` scan for remaining web `"use server"` files, `*.service.ts`, and `*.application.ts`; Context7 TanStack Query docs confirmed direct async API-client query functions; `pnpm --filter web test src/modules/debts/debt.api.test.ts`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm api:check-generated`, `pnpm --filter api test test/debts.e2e.test.ts`, `pnpm --filter web build`, and `pnpm --filter web test`. Follow-up: continue Phase 6 cleanup by removing or revising any remaining frontend backend-era docs and reassessing web auth/API-route remnants before moving to deployment work.
- 2026-05-27 - Phase 6 - Refreshed current-state docs after server-action removal: updated `AGENTS.md`, root `README.md`, and docs for the monorepo split, API-owned auth/data/cron/Prisma, generated API clients, package-local env ownership, API mutation guidance, current package paths, and frontend cache invalidation. Explorer subagent mapped stale references in read-only mode; historical `docs/backend-migration.md` plan/progress text was left intact except for this new progress entry. Confirmed `packages/web/.env` is ignored and was not edited despite containing old local backend variables. Verification passed: stale-reference `rg` scan only returned intentional `packages/api/prisma/schema.prisma` references, `pnpm check`, and `pnpm typecheck`. Follow-up: reassess whether Phase 6 is complete enough for Railway/deployment work.
- 2026-05-28 - Phase 7 - Began Railway deployment hardening after a Phase 6 residue scan found no remaining active `web` server actions, API routes, Prisma imports, backend helpers, or root Prisma schema. Checked current Railway config-as-code docs, updated `packages/api/railway.json` and both migration examples from the obsolete `NIXPACKS` builder value to `RAILPACK`, added API coverage that locks the Railway build/start/healthcheck config to the `api` package scripts, and documented the Railway backend setup, required API variables, web production variables, and post-deploy smoke checks in `docs/operations.md`. Verification passed: clean residue `rg` scans, `pnpm --filter api test test/app.e2e.test.ts`, `pnpm --filter api typecheck`, `pnpm --filter api check`, `pnpm --filter api build`, `pnpm api:check-generated`, `pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts`, `pnpm check`, `pnpm typecheck`, `pnpm build`, and `pnpm test`. Follow-up: complete a real Railway deployment once project credentials are available, then verify deployed `/health`, cron, logs, and web `NEXT_PUBLIC_API_URL`.

### Phase 1: Introduce The Monorepo

Move the existing Next.js app into `packages/web` without changing behavior.

Tasks:

- Add `pnpm-workspace.yaml`.
- Move current root app files into `packages/web`.
- Keep package names stable and explicit: `web` for the Next.js app and `api` for the NestJS server.
- Create `packages/web/.env.example` and move frontend-safe local variables there.
- Update root scripts to use `pnpm --filter web`.
- Keep current NextAuth, server actions, Prisma, and API routes working during this phase.
- Confirm `pnpm --filter web dev`, `pnpm --filter web typecheck`, `pnpm --filter web check`, `pnpm --filter web test`, and `pnpm --filter web build`.

### Phase 2: Scaffold The NestJS Backend

Create `packages/api` as a NestJS TypeScript application.

Tasks:

- Add NestJS app bootstrap with global validation and consistent error responses.
- Configure the app to listen on `process.env.PORT` and host `0.0.0.0`.
- Configure CORS with `credentials: true` and allow only origins from `API_ALLOWED_ORIGINS`.
- Add `/health` for Railway health checks.
- Move Prisma schema and Prisma Client generation into the `api` package. `packages/api/prisma/schema.prisma` becomes the only Prisma schema source of truth.
- Create `packages/api/.env.example` and move server-only local variables there.
- Keep MongoDB as the Prisma datasource.
- Preserve string money amounts and existing ObjectId conventions.
- Add `api` scripts for `dev`, `build`, `start`, `typecheck`, `check`, `test`, `db:generate`, `db:push`, `db:seed`, `db:export`, and `db:import`.
- Add a baseline `api` test setup and at least smoke tests for `/health`, validation behavior, and app bootstrap configuration.

### Phase 3: Move Auth To NestJS

NestJS should become the owner of authentication and session validation.

Tasks:

- Recreate registration, verification, login, logout, user settings, and invite acceptance as backend endpoints.
- Replace NextAuth session ownership with a NestJS auth model.
- Use HTTP-only cookie auth as the default session transport.
- Set auth cookies from `api`; use `Secure` in production, a deliberate `SameSite` policy, and a cookie domain that matches the deployed `web` and `api` hosts.
- Make `web` API calls with credentials included so browser requests send the auth cookies.
- Implement guards for authenticated users and workspace access.
- Preserve email verification behavior for pending registrations.
- Add tests for registration, login failure modes, email verification requirements, cookie issuance, logout/session invalidation, workspace guards, and access denial.
- Remove `web` dependency on `src/shared/lib/auth.ts`, `src/shared/lib/auth-session.ts`, and the NextAuth route after replacement is complete.

### Phase 4: Establish OpenAPI And Orval

NestJS OpenAPI is the source of truth for the `web`/`api` contract.

Tasks:

- Configure `@nestjs/swagger` in the `api` bootstrap.
- Use DTOs and Swagger decorators for request bodies, path params, query params, response shapes, auth requirements, and errors.
- Expose OpenAPI JSON at `GET /openapi.json`.
- Add `pnpm --filter api openapi:generate` to write the same OpenAPI document to `packages/api/openapi.json`.
- Add `orval.config.ts` in `packages/web`.
- Generate TypeScript models and TanStack Query hooks with Orval.
- Add `pnpm --filter web api:generate`.
- Commit generated API client files for reviewability unless the team later chooses a generated-at-build policy.
- Add tests or checks that fail when OpenAPI generation or Orval generation drifts from committed output.

### Phase 5: Migrate Domain Modules

Move modules from Next.js server actions to NestJS endpoints in this order:

1. Auth and workspace.
2. Accounts and categories.
3. Payment transactions and transfers.
4. Debts and debt transactions.
5. Analytics.
6. Currency, exchange rates, and cron.
7. MongoDB import/export and seed workflows.

For each module:

- Move validation to backend DTOs or shared validation helpers owned by the backend.
- Preserve workspace access checks.
- Preserve transactional balance rules.
- Preserve money-as-string behavior.
- Add or update OpenAPI metadata before frontend migration.
- Add or improve tests before each migrated module is considered complete.
- Replace `web` server action calls with generated Orval hooks or generated client functions.
- Keep TanStack Query cache keys stable where practical; when generated keys differ, migrate cache invalidation deliberately.
- Update optimistic update helpers only after the generated API response shapes are stable.

### Phase 6: Remove Frontend Backend Code

After all modules call NestJS:

- Remove server action service files from the `web` package.
- Remove `web` Prisma imports and backend-only helpers.
- Remove NextAuth route and related `web` auth server helpers.
- Remove Next.js API routes that have moved to NestJS.
- Remove the old root `prisma` directory after `packages/api/prisma/schema.prisma` is verified as the only schema source.
- Verify every removed server action has equivalent `api` tests covering the successful path, authorization failure, validation failure, and important domain edge cases.
- Keep only frontend-safe validation, formatting, and UI helpers in `packages/web`.
- Confirm the service worker still avoids caching financial documents, API calls, dashboard routes, and non-GET requests.

### Phase 7: Deploy Backend To Railway

Configure Railway for `packages/api`.

Requirements:

- Railway service root points to `packages/api`, or the Railway build/start commands explicitly target that package from the monorepo root.
- Create `packages/api/railway.json` and configure the Railway service to use that file.
- Backend start command runs the compiled NestJS server.
- NestJS listens on `process.env.PORT` and `0.0.0.0`.
- `/health` returns a simple success payload without requiring authentication.
- `DATABASE_URL` points to a MongoDB deployment compatible with Prisma's MongoDB transaction requirements.
- Railway variables include `api` auth secrets, SMTP variables, allowed web origins, `CRON_SECRET`, and any external currency provider configuration.
- Web production variables include `NEXT_PUBLIC_API_URL` with the Railway API URL.
- Production variables must follow the same split as local env files: server secrets only in the Railway `api` service, frontend public variables only in the `web` deployment.

Recommended Railway config when the Railway service root directory is `packages/api`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "healthcheckPath": "/health"
  }
}
```

If the Railway service root directory is the repository root, keep the config file path in Railway pointed at `/packages/api/railway.json` and use package-filtered commands:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "pnpm --filter api build"
  },
  "deploy": {
    "startCommand": "pnpm --filter api start",
    "healthcheckPath": "/health"
  }
}
```

## Environment Files

Each package owns its own local environment file:

```text
packages/api/.env
packages/api/.env.example
packages/web/.env
packages/web/.env.example
```

`packages/api/.env.example` should include backend-only variables:

```env
DATABASE_URL="mongodb://localhost:27017/finnn"
API_AUTH_SECRET="paste-generated-secret-here"
API_COOKIE_SECRET="paste-generated-secret-here"
API_COOKIE_SECURE="false"
API_COOKIE_SAME_SITE="lax"
API_COOKIE_DOMAIN=""
API_ALLOWED_ORIGINS="http://localhost:3000"
CRON_SECRET="paste-cron-secret-here"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="paste-smtp-password-here"
SMTP_FROM="Finnn <your-email@example.com>"
```

`packages/web/.env.example` should include frontend-safe variables:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Rules:

- Keep `.env` files uncommitted.
- Commit `.env.example` files.
- Never expose `DATABASE_URL`, SMTP credentials, auth secrets, or `CRON_SECRET` through `NEXT_PUBLIC_*` variables.
- Package scripts should load env values from their own package directory.

## API And Orval Workflow

Local contract workflow:

1. `api` changes DTOs, controllers, or response shapes.
2. `api` exports OpenAPI JSON.
3. `web` regenerates the API client with Orval.
4. `web` code updates imports and query usage.
5. Typecheck catches contract drift before runtime.

Recommended commands:

```bash
pnpm --filter api openapi:generate
pnpm --filter web api:generate
pnpm --filter web typecheck
```

`GET /openapi.json` is the runtime contract endpoint. `packages/api/openapi.json` is the local generated artifact that lets Orval run without requiring the API server to be running.

Recommended Orval policy:

- Input target: `api` OpenAPI JSON.
- Output client: TanStack Query.
- Output mode: split by tags or modules so generated files remain reviewable.
- Generated output target: `packages/web/src/shared/api/generated`.
- Generated models and hooks are committed to the repository.
- Generated code should not be manually edited.
- Custom fetch behavior should live in `packages/web/src/shared/api/http-client.ts`.
- Configure Orval's `mutator` option to call that custom HTTP client. In Orval terms, a mutator is the request function used by generated code instead of raw `fetch`; it should inject `NEXT_PUBLIC_API_URL`, use `credentials: "include"`, and normalize API errors.

OpenAPI rules:

- Every endpoint must have a stable operation ID.
- Request and response DTOs must be explicit.
- Auth-protected endpoints must be marked in the OpenAPI document.
- Pagination, filters, date ranges, and money strings must be represented consistently.
- Errors should use a documented response shape.

## Verification Checklist

Run these checks while migrating:

```bash
pnpm install
pnpm --filter api typecheck
pnpm --filter api check
pnpm --filter api test
pnpm --filter api build
pnpm api:generate
pnpm --filter web typecheck
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
```

Smoke-test these flows before removing old code:

- Registration, email verification, login, logout, and session refresh.
- Workspace creation, member invite acceptance, role checks, and access denial.
- Account and category CRUD.
- Income, expense, transfer, debt creation, debt payment, debt close, edit, and delete flows.
- Analytics date ranges and currency conversion.
- Exchange-rate cron endpoint with valid and invalid `CRON_SECRET`.
- MongoDB import/export against a non-production database.
- PWA service worker behavior for static assets and financial routes.
- Local startup with both `packages/api/.env` and `packages/web/.env`.
- Railway config file exists at `packages/api/railway.json` and points health checks at `/health`.
- Railway `/health` endpoint and backend logs after deployment.

Test coverage priorities:

- Auth: registration, verification, login, logout, session cookies, invalid credentials, unverified email, and expired or invalid tokens.
- Workspace access: owner/member/admin role behavior, denied access, missing workspace, and invite acceptance.
- Finance rules: account balances, insufficient funds, transfer source/destination validation, debt remaining amount, close/reopen behavior, edit/delete rollbacks, and money string precision.
- API contract: request validation, response shapes, documented errors, auth-protected OpenAPI endpoints, and Orval generation.
- Infrastructure: `/health`, cron secret validation, exchange-rate fallback behavior, import/export safety checks, and service worker cache exclusions.

## Completion Criteria

The migration is complete when:

- The `Migration Progress` section lists completed phases, verification results, and any intentionally deferred follow-up work.
- The repository uses `pnpm` workspaces with separate `web` and `api` packages.
- Each package has its own `.env.example`, and local `.env` usage is split by package.
- `packages/api/railway.json` exists and Railway uses it for API deployment settings.
- `web` code no longer imports Prisma, server actions, backend-only auth helpers, or database scripts.
- NestJS owns auth, authorization, data access, cron, email, and finance domain rules.
- Migrated modules have added or improved tests for their key success, authorization, validation, and domain failure paths.
- OpenAPI is generated from NestJS and Orval-generated frontend types/hooks are up to date.
- The `api` package is deployed on Railway and `web` calls it through `NEXT_PUBLIC_API_URL`.
- Full `web` and `api` verification passes.
