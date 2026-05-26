# Development

## Prerequisites

- Node.js compatible with the project dependencies.
- `pnpm`.
- MongoDB. For local development, use the provided Docker Compose service.
- Package-local `.env` files based on `packages/api/.env.example` and `packages/web/.env.example`.

## Local Setup

```bash
pnpm install
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
docker compose up -d
pnpm db:generate
pnpm db:push
pnpm dev
```

The API server runs on `http://localhost:4000`. The web dev server runs on `http://localhost:3000`.

`docker-compose.yml` starts MongoDB on port `27017` with `--replSet rs0`. Prisma's MongoDB connector uses transactions for some operations, so a local MongoDB deployment must support replica set transactions.

If the local database is new and Prisma reports transaction or replica set errors, initialize the replica set:

```bash
docker exec -it finnn-mongodb mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

## Environment Variables

Required in `packages/api/.env` for normal local API operation:

```env
DATABASE_URL="mongodb://localhost:27017/finnn"
API_AUTH_SECRET="paste-generated-secret-here"
API_COOKIE_SECRET="paste-generated-secret-here"
API_ALLOWED_ORIGINS="http://localhost:3000"
CRON_SECRET="paste-cron-secret-here"
```

Required for registration verification and workspace invite emails:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="paste-smtp-password-here"
SMTP_FROM="Finnn <your-email@example.com>"
```

Required in `packages/web/.env` for local web operation:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate API secrets with:

```bash
openssl rand -base64 32
```

## Scripts

```bash
pnpm dev          # API and web dev servers
pnpm dev:api      # NestJS API dev server on port 4000
pnpm dev:web      # Next.js web dev server on port 3000
pnpm build        # Build api, then web
pnpm check        # API contract check plus package Biome checks
pnpm typecheck    # TypeScript without emit for both packages
pnpm test         # Vitest run for both packages
pnpm api:generate # Generate OpenAPI JSON and Orval web client
```

Database scripts:

```bash
pnpm db:generate  # Generate Prisma Client
pnpm db:push      # Apply schema and indexes to MongoDB
pnpm db:seed      # Seed sample data
pnpm db:export    # Export MongoDB data
pnpm db:import <backup-dir> --drop --db=<database-name> # Import MongoDB data
```

Root database commands delegate to `packages/api`. The source files are `packages/api/scripts/db-seed.ts`,
`packages/api/scripts/mongo-export.ts`, and `packages/api/scripts/mongo-import.ts`.

## Prisma Workflow

The Prisma datasource uses MongoDB:

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

For this project:

- Edit `packages/api/prisma/schema.prisma` for models, indexes, enums, and relations.
- Run `pnpm db:generate` after schema changes.
- Run `pnpm db:push` to apply collection and index changes to MongoDB.
- Keep MongoDB ObjectId fields in the existing pattern: `String @id @default(auto()) @map("_id") @db.ObjectId`.
- Prefer string money amounts over floats or numbers in persisted financial fields.

## Testing Strategy

Run focused tests first when changing one module:

```bash
pnpm --filter api test test/transactions.e2e.test.ts
pnpm --filter api test test/debts.e2e.test.ts
pnpm --filter web test src/shared/lib/balance-domain.test.ts
```

Broaden to the full suite when changes affect:

- Balance rules.
- Transactions, transfers, debts, accounts, or categories.
- Query cache updates.
- App Router pages, API client adapters, or generated-client contracts.
- Service worker cache policy.
- Prisma schema.

Full verification:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

## Formatting And Style

- Biome is the source of truth for formatting and linting.
- TypeScript path alias is `@/*` mapped to `src/*`.
- TypeScript is strict.
- Comments should be in English.
- Use existing UI primitives from `packages/web/src/shared/ui` before adding a new primitive.
- Use `lucide-react` for icons where appropriate.
