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
pnpm db:ensure-indexes
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

Required for Telegram login/linking:

```env
WEB_APP_URL="http://localhost:3000"
TELEGRAM_CLIENT_ID="bot-or-client-id-from-botfather"
TELEGRAM_CLIENT_SECRET="secret-from-botfather"
TELEGRAM_REDIRECT_URI="https://your-stable-domain.ngrok-free.dev/auth/telegram/callback"
TELEGRAM_AUTH_STATE_SECRET="paste-generated-secret-here"
TELEGRAM_AUTH_STATE_TTL_SECONDS="600"
```

Required for Google login/linking:

```env
GOOGLE_CLIENT_ID="google-oauth-client-id"
GOOGLE_CLIENT_SECRET="google-oauth-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"
GOOGLE_AUTH_STATE_SECRET="paste-generated-secret-here"
GOOGLE_AUTH_STATE_TTL_SECONDS="600"
```

Register these OAuth redirect URIs in Google Cloud Console:

```text
Local: http://localhost:4000/auth/google/callback
DEV:   https://api-dev.finnn.xyz/auth/google/callback
PROD:  https://api.finnn.xyz/auth/google/callback
```

Password reset uses the same SMTP settings as email verification. Optional tuning:

```env
PASSWORD_RESET_CODE_TTL_SECONDS="900"
PASSWORD_RESET_MAX_ATTEMPTS="5"
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS="60"
```

Required for Telegram Mini App launch authentication:

```env
TELEGRAM_BOT_TOKEN="bot-token-from-botfather"
TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS="86400"
```

Required for custom avatar uploads:

```env
AVATAR_BUCKET="railway-bucket-name"
AVATAR_BUCKET_ACCESS_KEY_ID="railway-bucket-access-key-id"
AVATAR_BUCKET_SECRET_ACCESS_KEY="railway-bucket-secret-access-key"
AVATAR_BUCKET_REGION="auto"
AVATAR_BUCKET_ENDPOINT="https://storage.railway.app"
AVATAR_BUCKET_FORCE_PATH_STYLE="false"
AVATAR_MAX_BYTES="2097152"
AVATAR_PRESIGNED_URL_TTL_SECONDS="3600"
```

Railway Buckets expose `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, and `ENDPOINT`; map those values into
the `AVATAR_BUCKET_*` variables above. Use a dedicated development bucket when production avatar objects should stay
isolated. If these variables are missing, the avatar upload and read endpoints return a controlled service-unavailable
error instead of writing profile data.

BotFather setup:

- Create or select a bot in BotFather.
- Use the DEV Telegram bot for localhost and ngrok testing. The PROD bot is reserved for `https://finnn.xyz`.
- Open Bot Settings > Web Login.
- Register the ngrok callback URI used for local Telegram testing.
- Copy the client ID and client secret into `packages/api/.env`.
- Open Bot Settings > Mini Apps.
- Set the DEV Mini App URL to a public HTTPS URL that points at the existing dashboard route, for example
  `https://your-stable-domain.ngrok-free.app/dashboard` for local testing or `https://dev.finnn.xyz/dashboard` for the
  shared DEV environment.
- Copy the bot token into `TELEGRAM_BOT_TOKEN`; the API uses it only to validate `Telegram.WebApp.initData`.

Telegram Mini Apps must load over public HTTPS. For local testing, run the API and web app normally, then expose the web
app through a stable HTTPS tunnel and point the DEV bot's Mini App URL at the tunnel `/dashboard` route. Keep
`NEXT_PUBLIC_API_URL` aligned with an API URL that the WebView can reach and keep `API_ALLOWED_ORIGINS` aligned with the
tunnel origin.

Required in `packages/web/.env` for local web operation:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Telegram does not accept `localhost` redirect URIs. For local Telegram testing, expose the API through ngrok. Telegram redirects to the ngrok callback, and the API immediately relays non-local development callbacks back to the local API callback, where the local state and session cookies are available.

Use ngrok only for the API:

```bash
pnpm dev
ngrok http 4000 --url https://your-stable-domain.ngrok-free.dev
```

Use these values while testing through ngrok:

```env
# packages/api/.env
WEB_APP_URL="http://localhost:3000"
API_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
API_COOKIE_SAME_SITE="Lax"
API_COOKIE_SECURE="false"
TELEGRAM_REDIRECT_URI="https://your-stable-domain.ngrok-free.dev/auth/telegram/callback"

# packages/web/.env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Register the same callback URI in BotFather:

```text
https://your-stable-domain.ngrok-free.dev/auth/telegram/callback
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
pnpm db:ensure-indexes # Ensure partial unique email index for optional email users
pnpm db:seed      # Seed sample data
pnpm db:export    # Export MongoDB data
pnpm db:import <backup-dir> --drop --db=<database-name> # Import MongoDB data
```

Root database commands delegate to `packages/api`. The source files are `packages/api/scripts/db-seed.ts`,
`packages/api/scripts/mongo-export.ts`, `packages/api/scripts/mongo-import.ts`, and
`packages/api/scripts/ensure-indexes.ts`.

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
- Run `pnpm db:ensure-indexes` after user/email schema changes. It replaces non-partial `users.email` indexes
  with `users_email_unique_partial`, allowing multiple users without email while keeping string emails unique.
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
