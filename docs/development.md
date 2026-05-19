# Development

## Prerequisites

- Node.js compatible with the project dependencies.
- `pnpm`.
- MongoDB. For local development, use the provided Docker Compose service.
- A `.env` file based on `.env.example`.

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:push
pnpm dev
```

The dev server runs on `http://localhost:3000`.

`docker-compose.yml` starts MongoDB on port `27017` with `--replSet rs0`. Prisma's MongoDB connector uses transactions for some operations, so a local MongoDB deployment must support replica set transactions.

If the local database is new and Prisma reports transaction or replica set errors, initialize the replica set:

```bash
docker exec -it finnn-mongodb mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

## Environment Variables

Required for normal local operation:

```env
DATABASE_URL="mongodb://localhost:27017/finnn"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-generated-secret-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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

Generate `NEXTAUTH_SECRET` with:

```bash
openssl rand -base64 32
```

## Scripts

```bash
pnpm dev          # Next.js dev server on port 3000
pnpm build        # prisma generate, then next build
pnpm start        # production server on port 9999
pnpm lint         # Biome lint with warnings
pnpm lint:fix     # Biome lint fixes
pnpm format       # Biome format write
pnpm format:check # Biome format check
pnpm check        # Biome check with warnings treated as errors
pnpm check:fix    # Biome check fixes
pnpm typecheck    # TypeScript without emit
pnpm test         # Vitest run
pnpm test:watch   # Vitest watch mode
```

Database scripts:

```bash
pnpm db:generate  # Generate Prisma Client
pnpm db:push      # Apply schema and indexes to MongoDB
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Seed sample data
pnpm db:export    # Export MongoDB data
pnpm db:import    # Import MongoDB data
```

## Prisma Workflow

The Prisma datasource uses MongoDB:

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

For this project:

- Edit `prisma/schema.prisma` for models, indexes, enums, and relations.
- Run `pnpm db:generate` after schema changes.
- Run `pnpm db:push` to apply collection and index changes to MongoDB.
- Keep MongoDB ObjectId fields in the existing pattern: `String @id @default(auto()) @map("_id") @db.ObjectId`.
- Prefer string money amounts over floats or numbers in persisted financial fields.

## Testing Strategy

Run focused tests first when changing one module:

```bash
pnpm test src/modules/transactions/transaction.service.test.ts
pnpm test src/modules/debts/debt.service.test.ts
pnpm test src/shared/lib/balance-domain.test.ts
```

Broaden to the full suite when changes affect:

- Balance rules.
- Transactions, transfers, debts, accounts, or categories.
- Query cache updates.
- App Router pages or route handlers.
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
- Use existing UI primitives from `src/shared/ui` before adding a new primitive.
- Use `lucide-react` for icons where appropriate.
