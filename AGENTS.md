# Finnn Agent Guide

## Project Snapshot

Finnn is a personal and shared finance tracker in a `pnpm` monorepo.

- `packages/web` is the Next.js App Router frontend built with React, TypeScript, TanStack Query, Tailwind CSS, and Orval-generated API clients.
- `packages/api` is the NestJS backend built with TypeScript, Prisma, MongoDB, OpenAPI, and Vitest.

The app manages workspaces, members, accounts, categories, payment transactions, transfers, debts, analytics, exchange rates, MongoDB import/export, and PWA static asset caching.

## Required Workflow

- Use Context7 for library and framework documentation when it is relevant.
- Use subagents for parallel code analysis, implementation, or verification when they can reduce risk or latency.
- Do not revert user changes unless the user explicitly requests it.
- Prefer existing project patterns over introducing new abstractions.
- Keep comments in English.

## Key Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm check
pnpm test
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm db:export
pnpm db:import
```

Use `pnpm check`, `pnpm typecheck`, and targeted `pnpm test` runs before finishing non-trivial changes.

## Architecture Map

- `packages/web/src/app` contains App Router pages, layouts, and providers.
- `packages/web/src/modules` contains frontend feature modules: accounts, analytics, auth, categories, currency, debts, transactions, and workspace.
- `packages/web/src/shared/api/generated` contains Orval-generated API client functions and types. Do not edit generated files manually.
- `packages/web/src/shared/lib` contains frontend session, query keys, cache invalidation, optimistic updates, balance helpers, and domain types.
- `packages/web/src/shared/ui` contains reusable primitive UI components.
- `packages/web/src/shared/components` contains reusable composed components.
- `packages/web/src/shared/utils` contains low-level utilities such as money formatting and arithmetic.
- `packages/web/public/sw.js` controls the PWA service worker cache policy.
- `packages/api/src` contains NestJS modules, controllers, DTOs, guards, services, auth/session ownership, cron, email, and finance domain logic.
- `packages/api/prisma/schema.prisma` is the source of truth for database collections, relations, indexes, and enums.
- `packages/api/scripts` contains seed, MongoDB import/export, and OpenAPI generation scripts.
- `docs` contains human and AI-facing project documentation.
- `docs` contains human and AI-facing project documentation.

## Implementation Rules

- New backend behavior should live in `packages/api` NestJS modules, not in `packages/web`.
- Backend endpoints should use DTO validation, guards, explicit Swagger metadata, and API tests.
- Complex transactional business logic should live in API services that use `prisma.$transaction`.
- Check authentication and workspace authorization in the API with auth guards and `WorkspaceAccessGuard`.
- Keep money values as strings. Use backend money helpers in `packages/api/src/common/money.ts` for persisted logic and frontend helpers in `packages/web/src/shared/utils/money.ts` and `packages/web/src/shared/lib/balance-domain.ts` for UI/cache projections.
- Regenerate OpenAPI and the web client after API contract changes with `pnpm api:generate`; verify drift with `pnpm api:check-generated`.
- Use TanStack Query keys from `packages/web/src/shared/lib/query-keys.ts`; do not invent ad hoc key shapes.
- When client mutations need immediate UI feedback, prefer the existing optimistic update helpers in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`.
- Keep App Router pages server-first. Hydrate client views through TanStack Query where the existing pattern already does this.
- Do not cache financial documents, API responses, dashboard routes, or data responses in the service worker.

## Data And Infrastructure Notes

- The database is MongoDB through Prisma with `provider = "mongodb"`.
- Local MongoDB should run as a replica set. `docker-compose.yml` starts MongoDB with `--replSet rs0`; initialize the replica set before using Prisma transactions if needed.
- Run `pnpm db:generate` after schema changes.
- Run `pnpm db:push` to apply schema/index changes to MongoDB.
- `packages/api/.env` owns backend secrets such as `DATABASE_URL`, `API_AUTH_SECRET`, `API_COOKIE_SECRET`, SMTP variables, and `CRON_SECRET`.
- `packages/web/.env` owns browser-safe variables such as `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL`.
- SMTP variables are required for registration verification and workspace invite email delivery.
- Backend scheduling should call the API endpoint `/cron/update-exchange-rates` with `Authorization: Bearer <CRON_SECRET>`.

## Documentation Expectations

- Update `AGENTS.md` and `docs/` when changing architecture, setup, data model, workflows, deployment, or agent-facing conventions.
- Keep README concise and link to detailed docs instead of duplicating large sections.
- Prefer concrete file paths, commands, invariants, and failure modes over generic descriptions.
