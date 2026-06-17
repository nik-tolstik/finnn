# Operations

## Deployment Domains

Frontend deployments are hosted on Vercel:

| Environment | URL |
| --- | --- |
| PROD | `https://finnn.xyz` |
| DEV | `https://dev.finnn.xyz` |

Backend API deployments are hosted on Railway:

| Environment | URL |
| --- | --- |
| PROD | `https://api.finnn.xyz` |
| DEV | `https://api-dev.finnn.xyz` |

Keep environment variables aligned with the matching frontend/API pair:

| Environment | `WEB_APP_URL` / `API_ALLOWED_ORIGINS` | `NEXT_PUBLIC_API_URL` | `TELEGRAM_REDIRECT_URI` | Mini App URL |
| --- | --- | --- | --- | --- |
| PROD | `https://finnn.xyz` | `https://api.finnn.xyz` | `https://api.finnn.xyz/auth/telegram/callback` | `https://finnn.xyz/dashboard` |
| DEV | `https://dev.finnn.xyz` | `https://api-dev.finnn.xyz` | `https://api-dev.finnn.xyz/auth/telegram/callback` | `https://dev.finnn.xyz/dashboard` |

Telegram authentication uses two separate bots:

- PROD bot: use only for `https://finnn.xyz` and `https://api.finnn.xyz`.
- DEV bot: use for `https://dev.finnn.xyz`, `https://api-dev.finnn.xyz`, and localhost/ngrok testing.

## Production Environment

Required variables:

```env
DATABASE_URL="mongodb-connection-string"
API_AUTH_SECRET="production-secret"
API_COOKIE_SECRET="production-cookie-secret"
API_ALLOWED_ORIGINS="https://production-app-url"
CRON_SECRET="production-cron-secret"
```

Telegram authentication variables are required when Telegram login/linking is enabled:

```env
WEB_APP_URL="https://production-app-url"
TELEGRAM_CLIENT_ID="bot-or-client-id-from-botfather"
TELEGRAM_CLIENT_SECRET="telegram-client-secret"
TELEGRAM_REDIRECT_URI="https://production-api-url/auth/telegram/callback"
TELEGRAM_AUTH_STATE_SECRET="production-telegram-state-secret"
TELEGRAM_AUTH_STATE_TTL_SECONDS="600"
TELEGRAM_BOT_TOKEN="production-bot-token"
TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS="86400"
```

BotFather setup:

- Create or select the production bot.
- Open Bot Settings > Web Login.
- Register the production web URL and API callback host.
- Store the issued client ID and secret in the API deployment environment.
- Open Bot Settings > Mini Apps.
- Register the production Mini App URL as `https://finnn.xyz/dashboard`.
- Store the same production bot token in `TELEGRAM_BOT_TOKEN` for API-side Mini App `initData` validation.

Email variables are required when registration verification and workspace invites should send real email:

```env
SMTP_HOST="smtp-host"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASSWORD="smtp-password"
SMTP_FROM="Finnn <no-reply@example.com>"
```

Avatar uploads require a private Railway Bucket exposed through its S3-compatible credentials:

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

Keep the bucket private. The API stores object keys in `users.avatarStorageKey`, keeps `users.image` as a stable
`/auth/users/:userId/avatar` display path, and redirects reads to short-lived presigned URLs. Some older buckets may need
`AVATAR_BUCKET_FORCE_PATH_STYLE="true"`.

## Build

The production build runs:

```bash
pnpm build
```

This script builds the API package first, then the web package.

## Railway Backend Deployment

Deploy the backend as the `api` service from `packages/api`.

Railway setup:

- Set the service root directory to `/packages/api`.
- Set the config-as-code file path to `/packages/api/railway.json`.
- Keep the checked-in config on the Railpack builder with `pnpm --filter api build`, `pnpm --filter api start`, and `/health`.
- Confirm the service listens on Railway's injected `PORT`; the NestJS bootstrap already binds `0.0.0.0`.

Required Railway variables:

```env
DATABASE_URL="mongodb-connection-string"
API_AUTH_SECRET="production-secret"
API_COOKIE_SECRET="production-cookie-secret"
API_COOKIE_SECURE="true"
API_COOKIE_SAME_SITE="none"
API_COOKIE_DOMAIN=""
API_ALLOWED_ORIGINS="https://production-app-url"
WEB_APP_URL="https://production-app-url"
CRON_SECRET="production-cron-secret"
SMTP_HOST="smtp-host"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASSWORD="smtp-password"
SMTP_FROM="Finnn <no-reply@example.com>"
TELEGRAM_CLIENT_ID="bot-or-client-id-from-botfather"
TELEGRAM_CLIENT_SECRET="telegram-client-secret"
TELEGRAM_REDIRECT_URI="https://production-api-url/auth/telegram/callback"
TELEGRAM_AUTH_STATE_SECRET="production-telegram-state-secret"
TELEGRAM_AUTH_STATE_TTL_SECONDS="600"
TELEGRAM_BOT_TOKEN="production-bot-token"
TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS="86400"
AVATAR_BUCKET="railway-bucket-name"
AVATAR_BUCKET_ACCESS_KEY_ID="railway-bucket-access-key-id"
AVATAR_BUCKET_SECRET_ACCESS_KEY="railway-bucket-secret-access-key"
AVATAR_BUCKET_REGION="auto"
AVATAR_BUCKET_ENDPOINT="https://storage.railway.app"
AVATAR_BUCKET_FORCE_PATH_STYLE="false"
AVATAR_MAX_BYTES="2097152"
AVATAR_PRESIGNED_URL_TTL_SECONDS="3600"
```

Frontend production variables stay with the web deployment:

```env
NEXT_PUBLIC_API_URL="https://production-api-url"
```

After deployment, verify:

```bash
curl https://production-api-url/health
curl -H "Authorization: Bearer $CRON_SECRET" https://production-api-url/cron/update-exchange-rates
```

Railway health checks only gate startup, so keep logs or external uptime monitoring for continuous runtime visibility.

## Backend Cron

Railway or another backend scheduler should call the API cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://api.example.com/cron/update-exchange-rates
```

The API handler is `packages/api/src/currency/currency.controller.ts`.

Operational requirements:

- Set the same `CRON_SECRET` in the API environment and in any scheduler that invokes the route.
- Confirm `DATABASE_URL` points to a MongoDB deployment that supports Prisma's transaction requirements.
- Keep `NEXT_PUBLIC_API_URL` in the web deployment aligned with the deployed API URL.

Railway setup:

- Keep the API service as a persistent web service.
- Create a separate Railway cron service in the same environment.
- Set the cron service schedule to run once per day after NBRB publishes rates. NBRB daily-rate aggregators
  report an update schedule around 11:00 Europe/Minsk, so use `30 8 * * *` for 11:30 Minsk time.
- Give the cron service `API_BASE_URL` and `CRON_SECRET` variables.
- Use a start command that calls the API endpoint and then exits.

Example cron service variables:

```env
API_BASE_URL="https://api-dev.finnn.xyz"
CRON_SECRET="same-secret-as-api"
```

Example cron service start command:

```bash
node -e "fetch(`${process.env.API_BASE_URL}/cron/update-exchange-rates`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).then(async (response) => { const body = await response.text(); console.log(body); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error); process.exit(1); })"
```

## MongoDB Import And Export

Scripts:

- `packages/api/scripts/mongo-export.ts`
- `packages/api/scripts/mongo-import.ts`
- `packages/api/scripts/db-seed.ts`
- `packages/api/scripts/ensure-indexes.ts`

Commands:

```bash
pnpm db:export ./backups/manual
pnpm db:import ./backups/manual --drop --db=finnn_restore
pnpm db:seed
pnpm db:ensure-indexes
```

Before import/export:

- Confirm `DATABASE_URL`.
- Use throwaway database names for import verification.
- Production imports are blocked unless `--allow-production` is passed. Use that flag only when the target dataset and overwrite behavior are fully understood.
- Run `pnpm db:generate` if schema or Prisma version changed.
- Run `pnpm db:ensure-indexes` after deploying optional-email schema changes. The command ensures
  `users_email_unique_partial` exists with `partialFilterExpression: { email: { $type: "string" } }` and drops
  older non-partial `users.email` indexes that would allow only one missing/null email.

## Database Schema Changes

For MongoDB, the project uses Prisma `db push` rather than SQL-style change files.

Recommended sequence:

```bash
pnpm db:generate
pnpm db:push
pnpm db:ensure-indexes
pnpm typecheck
pnpm test
```

When adding indexes, verify they are represented in `packages/api/prisma/schema.prisma` and applied through `pnpm db:push`.
For MongoDB partial indexes that Prisma cannot express, add or update an explicit script under `packages/api/scripts`.

## Telegram Identity Repair

Telegram OIDC `sub` values and Telegram Mini App `initData.user.id` values can differ. The API normalizes Telegram OIDC
claims to `id` when Telegram includes it, because it matches Mini App `initData.user.id`. Older production data may still
contain identities keyed by the longer OIDC `sub`.

Use the normalized Telegram id from the server logs or from `auth_identities.providerUserId` after a Mini App login
attempt:

```bash
pnpm --filter api telegram:link-mini -- --email=user@example.com --providerUserId=455466975
```

If the Mini App id already created a temporary empty user, move it to the correct user:

```bash
pnpm --filter api telegram:link-mini -- --email=user@example.com --providerUserId=455466975 --move
```

After moving the identity, delete only the temporary user after confirming it has no workspace membership or financial
data.

## Email

Email delivery is owned by `packages/api/src/email/email.service.ts`.

Current email use cases:

- Registration verification.
- Workspace invites.

Email depends on:

- API and web public URL variables for generated links.
- SMTP variables for transport.

If email delivery fails locally, verify `.env`, SMTP credentials, provider app-password requirements, and whether the SMTP account allows the selected port/security mode.

## Service Worker

The service worker is intentionally conservative. It caches only static assets and avoids financial data.

After changing `packages/web/public/sw.js`, run:

```bash
pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts
```

Then run the full test suite for broader changes:

```bash
pnpm test
```

## Release Checklist

Before deploying meaningful changes:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

Also verify:

- Required env vars exist in the target environment.
- MongoDB accepts Prisma transactions.
- `pnpm db:push` has been run for schema/index changes.
- Railway Bucket avatar variables are present and point at the correct environment bucket.
- Cron endpoint returns success with a valid secret.
- API auth cookie variables match the deployed API and web hosts.
- Telegram redirect URI is registered in BotFather and matches `TELEGRAM_REDIRECT_URI`.
- Telegram Mini App URL is registered in BotFather and points to the existing `/dashboard` route.
- Telegram Mini App launch is tested in real Telegram clients for cookie persistence and existing dashboard flows.
- Email links use the production web URL.
