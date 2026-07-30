# Development

## Prerequisites

- Node.js compatible with the project dependencies.
- `pnpm`.
- PostgreSQL. For local development, use the provided Docker Compose service.
- Package-local `.env` files based on `packages/api/.env.example` and `packages/web/.env.example`.

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

The API server runs on `http://localhost:4000`. The web dev server runs on `http://localhost:3000`.

`docker-compose.yml` starts PostgreSQL 17 on port `5432`, persists data in the `postgres_data` volume, and exposes a
`pg_isready` health check. Wait for it to become healthy before applying migrations:

```bash
docker compose ps
```

## TypeScript Toolchain

The API and web packages use the native TypeScript 7 compiler. The `@typescript/native` dependency is an npm alias for TypeScript 7, so package scripts that invoke `tsc` use the TypeScript 7 executable.

TypeScript 7 does not expose the legacy compiler API yet. The `typescript` dependency therefore aliases `@typescript/typescript6` so tools that still load that API, including Nest CLI, Storybook, and Orval, continue to work. This compatibility package is only for tooling; `pnpm typecheck` and the package-local `tsc` commands run TypeScript 7.

Orval 8.12.3 does not parse npm alias ranges as semver. Its config uses `packages/web/orval.package.json`, a small generator-only manifest with a normal TypeScript 7 version, so `pnpm api:generate` remains compatible with the alias setup.

## Environment Variables

Required in `packages/api/.env` for normal local API operation:

```env
DATABASE_URL="postgresql://finnn:finnn_local@localhost:5432/finnn?schema=public"
DIRECT_URL="postgresql://finnn:finnn_local@localhost:5432/finnn?schema=public"
API_AUTH_SECRET="paste-generated-secret-here"
API_COOKIE_SECRET="paste-generated-secret-here"
API_ALLOWED_ORIGINS="http://localhost:3000"
CRON_SECRET="paste-cron-secret-here"
```

Email delivery uses Resend over HTTPS. Create an API key, verify the sender domain in Resend, and set:

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="Finnn <no-reply@your-verified-domain.example>"
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

Password reset uses the same Resend settings as email verification. Optional tuning:

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

Required for Telegram bot finance entry:

```env
TELEGRAM_BOT_WEBHOOK_SECRET="paste-telegram-webhook-secret-here"
TELEGRAM_BOT_WEBHOOK_URL="https://your-stable-domain.ngrok-free.dev/telegram/webhook"
TELEGRAM_BOT_DRAFT_TTL_SECONDS="1800"
OPENROUTER_API_KEY="openrouter-api-key"
OPENROUTER_APP_REFERER="http://localhost:3000"
OPENROUTER_APP_TITLE="Finnn Local"
OPENROUTER_TEXT_MODEL="openai/gpt-4.1-mini"
OPENROUTER_VISION_MODEL="google/gemini-2.5-flash"
OPENROUTER_TRANSCRIPTION_MODEL="openai/gpt-4o-mini-transcribe"
```

Required for custom avatar and category icon uploads:

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
- Set the bot webhook to the API tunnel URL and pass the same secret token as `TELEGRAM_BOT_WEBHOOK_SECRET`:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  --json '{"url":"https://your-stable-domain.ngrok-free.dev/telegram/webhook","secret_token":"paste-telegram-webhook-secret-here"}'
```

Or set `TELEGRAM_BOT_WEBHOOK_URL` and `TELEGRAM_BOT_WEBHOOK_SECRET` in `packages/api/.env`, then run:

```bash
pnpm --filter api telegram:webhook:enable
```

Use `-- --url=https://your-stable-domain.ngrok-free.dev/telegram/webhook` to override the env URL for one run, and
`-- --drop-pending` when switching environments and old queued updates should be discarded.

Telegram Mini Apps must load over public HTTPS. For local testing, run the API and web app normally, then expose the web
app through a stable HTTPS tunnel and point the DEV bot's Mini App URL at the tunnel `/dashboard` route. Keep
`VITE_API_URL` aligned with an API URL that the WebView can reach and keep `API_ALLOWED_ORIGINS` aligned with the
tunnel origin.

Required in `packages/web/.env` for local web operation:

```env
VITE_API_URL="http://localhost:4000"
```

Telegram does not accept `localhost` redirect URIs. For local Telegram testing, expose the API through ngrok. Telegram redirects to the ngrok callback, and the API immediately relays non-local development callbacks back to the local API callback, where the local state and session cookies are available.

Use ngrok only for the API:

```bash
pnpm dev
ngrok http 4000 --url https://your-stable-domain.ngrok-free.dev
```

Or set `NGROK_URL` in `packages/api/.env` and start the API tunnel with:

```bash
pnpm --filter api ngrok
```

If `NGROK_URL` is not set, the script uses the origin from `TELEGRAM_BOT_WEBHOOK_URL`. Use
`-- --url=https://your-stable-domain.ngrok-free.dev` or `-- --port=4000` to override one run.

Use these values while testing through ngrok:

```env
# packages/api/.env
WEB_APP_URL="http://localhost:3000"
API_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
API_COOKIE_SAME_SITE="Lax"
API_COOKIE_SECURE="false"
TELEGRAM_REDIRECT_URI="https://your-stable-domain.ngrok-free.dev/auth/telegram/callback"
TELEGRAM_BOT_WEBHOOK_URL="https://your-stable-domain.ngrok-free.dev/telegram/webhook"
NGROK_URL="https://your-stable-domain.ngrok-free.dev"

# packages/web/.env
VITE_API_URL="http://localhost:4000"
```

Register the same callback URI in BotFather:

```text
https://your-stable-domain.ngrok-free.dev/auth/telegram/callback
```

Manual Telegram bot checks:

- `/start` from a linked Telegram account shows the current context and examples.
- `/start` from an unknown Telegram account returns a Mini App/open-Finnn button.
- Text such as `Coffee 12 BYN yesterday from Main card` creates a draft and shows a preview.
- Text such as `Coffee 2 USD from Main card` creates a draft that previews and commits the account-currency amount.
- Questions about account balances, available accounts, categories, today's spending, or open debts return answers and
  must not create AI finance drafts.
- Receipt photos create grouped expense drafts by category by default, with buttons for one transaction, category, or
  item modes.
- Voice messages are transcribed through OpenRouter and then follow the same text draft flow.
- No financial records are created until the Telegram `Create` button is pressed.

Generate API secrets with:

```bash
openssl rand -base64 32
```

## Scripts

```bash
pnpm dev          # API and web dev servers
pnpm dev:api      # NestJS API dev server on port 4000
pnpm dev:web      # Vite web dev server on port 3000
pnpm build        # Build api, then web
pnpm check        # Legacy framework audit, API contract check, and package Biome checks
pnpm typecheck    # TypeScript without emit for both packages
pnpm test         # Vitest run for both packages
pnpm api:generate # Generate OpenAPI JSON and Orval web client
```

Database scripts:

```bash
pnpm db:generate        # Generate Prisma Client
pnpm db:migrate:dev     # Create and apply a local SQL migration
pnpm db:migrate:deploy  # Apply committed migrations without creating new ones
pnpm db:migrate:status  # Compare the database with committed migration history
pnpm db:seed            # Seed sample data
```

Root database commands delegate to `packages/api`. `packages/api/scripts/db-seed.ts` owns development seed data. The
completed data-provider cutover and validation history lives in
[`docs/plans/postgresql-migration`](./plans/postgresql-migration/README.md); the one-time executable migration tooling is
no longer part of the application.

## Prisma Workflow

The Prisma datasource uses PostgreSQL. `DATABASE_URL` is the runtime connection and `DIRECT_URL` is the direct
connection used by schema migration commands:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

For this project:

- Edit `packages/api/prisma/schema.prisma` for models, indexes, enums, and relations.
- Run `pnpm db:migrate:dev --name <descriptive-name>` locally after a schema change.
- Review the generated SQL under `packages/api/prisma/migrations` before applying or committing it.
- Run `pnpm db:generate` after schema changes when it was not already run by Prisma Migrate.
- Run `pnpm db:migrate:deploy` in shared DEV, test, and production environments. Never run `migrate dev` or `db push`
  against a shared database.
- Preserve imported legacy 24-character values as opaque text IDs. New rows use the ID default defined by the Prisma
  schema; application code must not depend on a 24-character ID shape.
- Prefer string money amounts over floats or numbers in persisted financial fields.

### Direct and pooled connections

For local development, `DATABASE_URL` and `DIRECT_URL` are intentionally identical. In a managed environment:

- `DATABASE_URL` may use the provider's transaction-capable pooled endpoint for API traffic.
- `DIRECT_URL` must use the direct PostgreSQL endpoint so Prisma Migrate, `pg_dump`, and administrative sessions do not
  pass through a transaction pooler.
- Keep runtime pool size within the PostgreSQL service connection limit after reserving capacity for migrations, cron,
  observability, and emergency administration. Do not multiply the configured pool by deployment replica count beyond
  the database limit.
- Use the same TLS requirements on both URLs. Do not log either URL.

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
- React Router routes, API client adapters, or generated-client contracts.
- Service worker cache policy.
- Prisma schema.

Provider behavior and concurrency need a real local PostgreSQL database because the regular API endpoint tests mock
Prisma. Create the isolated database once, apply committed migrations, and opt into the integration test explicitly:

```bash
docker exec finnn-postgres createdb --username=finnn finnn_test
FINNN_TEST_DATABASE_URL="postgresql://finnn:finnn_local@localhost:5432/finnn_test?schema=public"
DATABASE_URL="$FINNN_TEST_DATABASE_URL" DIRECT_URL="$FINNN_TEST_DATABASE_URL" pnpm db:migrate:deploy
POSTGRES_TEST_DATABASE_URL="$FINNN_TEST_DATABASE_URL" pnpm --filter api test test/postgres.integration.test.ts
```

`POSTGRES_TEST_DATABASE_URL` is accepted only for localhost databases whose name ends in `_test`. The test truncates its
tables and must never target development, shared DEV, or production data. The integration suite covers concurrent
balance changes, scheduled-payment occurrence idempotency and rollback, AI-draft rollback, one-time auth/invite token
consumption, login-method unlink races, deterministic ordering, and JSONB preference updates.

Full verification:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

## Formatting And Style

- Biome is the source of truth for formatting and linting.
- The root `biome.json` anchors editor configuration for the monorepo. Keep package-level Biome configs connected with `"extends": "//"`; the web config enables Tailwind CSS directives.
- TypeScript path alias is `@/*` mapped to `src/*`.
- TypeScript is strict.
- Comments should be in English.
- Use existing UI primitives from `packages/web/src/shared/ui` before adding a new primitive.
- Use `lucide-react` for icons where appropriate.
