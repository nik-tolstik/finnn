# Finnn Agent Guide

## Project Snapshot

Finnn is a personal and shared finance tracker built with Next.js App Router, React, TypeScript, Prisma, MongoDB, NextAuth, TanStack Query, Tailwind CSS, and Vitest.

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

- `src/app` contains App Router pages, layouts, providers, and API route handlers.
- `src/modules` contains feature modules: accounts, analytics, auth, categories, currency, debts, transactions, and workspace.
- `src/shared/lib` contains cross-cutting server and domain helpers: auth/session, Prisma, access checks, query keys, action results, cache invalidation, balance rules, and optimistic updates.
- `src/shared/ui` contains reusable primitive UI components.
- `src/shared/components` contains reusable composed components.
- `src/shared/utils` contains low-level utilities such as money formatting and arithmetic.
- `prisma/schema.prisma` is the source of truth for database collections, relations, indexes, and enums.
- `scripts` contains seed, MongoDB import/export, and static/unit tests.
- `public/sw.js` controls the PWA service worker cache policy.
- `docs` contains human and AI-facing project documentation.

## Implementation Rules

- Server mutations should live in `*.service.ts` files with `"use server"` and return `ok`, `success`, or `fail` from `src/shared/lib/action-result.ts`.
- Complex transactional business logic should live in `*.application.ts` files and use `prisma.$transaction`.
- Validate inputs with schemas from `src/shared/lib/validations`.
- Check authentication and workspace authorization with `requireUserId` and `requireWorkspaceAccess`.
- Revalidate affected routes after server mutations with helpers from `src/shared/lib/revalidate-app-routes.ts`.
- Keep money values as strings and use helpers from `src/shared/utils/money.ts` and `src/shared/lib/balance-domain.ts`.
- Use branded domain ID/value helpers from `src/shared/lib/domain-types.ts` where domain boundaries need stronger typing.
- Use TanStack Query keys from `src/shared/lib/query-keys.ts`; do not invent ad hoc key shapes.
- When client mutations need immediate UI feedback, prefer the existing optimistic update helpers in `src/shared/lib/optimistic-workspace-updates.ts`.
- Keep App Router pages server-first. Hydrate client views through TanStack Query where the existing pattern already does this.
- Do not cache financial documents, API responses, dashboard routes, or server action/data responses in the service worker.

## Data And Infrastructure Notes

- The database is MongoDB through Prisma with `provider = "mongodb"`.
- Local MongoDB should run as a replica set. `docker-compose.yml` starts MongoDB with `--replSet rs0`; initialize the replica set before using Prisma transactions if needed.
- Run `pnpm db:generate` after schema changes.
- Run `pnpm db:push` to apply schema/index changes to MongoDB.
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `CRON_SECRET` are required for normal operation.
- SMTP variables are required for registration verification and workspace invite email delivery.
- Vercel cron calls `/api/cron/update-exchange-rates` daily and must be protected by `CRON_SECRET`.

## Documentation Expectations

- Update `docs/` when changing architecture, setup, data model, workflows, deployment, or agent-facing conventions.
- Keep README concise and link to detailed docs instead of duplicating large sections.
- Prefer concrete file paths, commands, invariants, and failure modes over generic descriptions.
