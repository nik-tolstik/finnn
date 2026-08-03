# Finnn

Finnn is a personal and shared finance tracker for workspaces, accounts, categories, payment transactions, transfers,
debts, scheduled payments, exchange rates, and analytics.

## Documentation

Start with [`docs/README.md`](./docs/README.md). It links the development setup, architecture and domain guides,
operations runbook, design system, and active implementation plans.

Product work is tracked in the [Finnn Linear project](https://linear.app/nikita-tolstik/project/finnn-4d0360836e89/overview).
The agent workflow is documented in [`docs/ai-contributor-guide.md`](./docs/ai-contributor-guide.md#linear-task-workflow).

## Stack

- `pnpm` workspace with `packages/web`, `packages/api`, and the isolated `packages/postgres-backup` cron service.
- Vite, React Router, React, and TypeScript frontend.
- NestJS API with Prisma and PostgreSQL.
- API-owned HTTP-only cookie authentication.
- OpenAPI with an Orval-generated web client.
- TanStack Query, Tailwind CSS, Recharts, Vitest, and Biome.

## Local Setup

```bash
pnpm install
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
docker compose up -d
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

The API runs at [http://localhost:4000](http://localhost:4000), and the web app runs at
[http://localhost:3000](http://localhost:3000). Docker Compose starts local PostgreSQL on port `5432`.

The minimum local API database and application settings are:

```env
DATABASE_URL="postgresql://finnn:finnn_local@localhost:5432/finnn?schema=public"
DIRECT_URL="postgresql://finnn:finnn_local@localhost:5432/finnn?schema=public"
API_AUTH_SECRET="paste-generated-secret-here"
API_COOKIE_SECRET="paste-generated-secret-here"
API_ALLOWED_ORIGINS="http://localhost:3000"
CRON_SECRET="paste-cron-secret-here"
```

The minimum web setting is:

```env
VITE_API_URL="http://localhost:4000"
```

Generate API secrets with `openssl rand -base64 32`. Email, Telegram, Google, OpenRouter, object storage, and hosted
environment variables are documented in [`docs/development.md`](./docs/development.md) and the
[operations runbooks](./docs/operations/).

## Prisma And PostgreSQL

```bash
pnpm db:generate
pnpm db:migrate:dev --name <descriptive-name>
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
```

Create and review SQL migrations locally with `db:migrate:dev`. Shared DEV and production environments apply only
committed migrations with `db:migrate:deploy`; do not use `prisma db push` for shared databases.

PostgreSQL deployment and pooling procedures live in the [database operations runbook](./docs/operations/database.md).
The encrypted backup and restore procedure lives in [`docs/postgresql-backups.md`](./docs/postgresql-backups.md). The
one-time executable data-provider cutover tooling is no longer part of the application.

## Verification

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

`pnpm check` verifies generated API contract drift and runs package Biome checks.
`pnpm build` builds the NestJS API before the Vite frontend.

## Important Boundaries

- `packages/api/prisma/schema.prisma` and `packages/api/prisma/migrations` are the source of truth for PostgreSQL schema
  and migration history.
- Backend money values remain strings and are manipulated through `packages/api/src/common/money.ts`.
- Frontend money helpers live in `packages/web/src/shared/utils/money.ts` and
  `packages/web/src/shared/lib/balance-domain.ts`.
- `packages/web/public/sw.js` caches static assets only; it must not cache financial documents, API responses, or
  protected app routes.
- Protected cron endpoints require `Authorization: Bearer <CRON_SECRET>`.
