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

| Environment | `WEB_APP_URL` / `API_ALLOWED_ORIGINS` | `VITE_API_URL` | `TELEGRAM_REDIRECT_URI` | `GOOGLE_REDIRECT_URI` | Mini App URL |
| --- | --- | --- | --- | --- | --- |
| PROD | `https://finnn.xyz` | `https://api.finnn.xyz` | `https://api.finnn.xyz/auth/telegram/callback` | `https://api.finnn.xyz/auth/google/callback` | `https://finnn.xyz/dashboard` |
| DEV | `https://dev.finnn.xyz` | `https://api-dev.finnn.xyz` | `https://api-dev.finnn.xyz/auth/telegram/callback` | `https://api-dev.finnn.xyz/auth/google/callback` | `https://dev.finnn.xyz/dashboard` |

Telegram authentication uses two separate bots:

- PROD bot: use only for `https://finnn.xyz` and `https://api.finnn.xyz`.
- DEV bot: use for `https://dev.finnn.xyz`, `https://api-dev.finnn.xyz`, and localhost/ngrok testing.

## Vercel Topology And Agent Operations

The frontend belongs to Vercel team `nikita-tolstiks-projects`
(`team_kvIGfPhFgoNVm2ZeZo3UVA8g`) and project `finnn`
(`prj_TTGv3A6Nw34FhSHseGEGQthGqoUf`). The project root is `packages/web`, the framework preset is `vite`, the output
directory is `dist`, and the configured Node.js runtime is `24.x`.

Vercel's Git integration owns normal deployments:

- `main` creates the Production deployment and owns `finnn.xyz` plus `www.finnn.xyz`.
- `develop` creates a Preview deployment and owns the protected `dev.finnn.xyz` alias.
- Pull-request branches create protected Preview deployments.

Agents may use an authenticated Vercel connector for discovery and read-only inspection. For mutations or CLI-only
verification, use the authenticated CLI/API with the explicit team scope and project ID. Do not depend on whichever
project happens to be linked in the current directory.

```bash
pnpm --silent dlx vercel@latest whoami

pnpm --silent dlx vercel@latest api \
  /v9/projects/prj_TTGv3A6Nw34FhSHseGEGQthGqoUf \
  --scope nikita-tolstiks-projects \
  --raw | jq '{id,name,framework,rootDirectory,outputDirectory,nodeVersion}'

pnpm --silent dlx vercel@latest api \
  /v10/projects/prj_TTGv3A6Nw34FhSHseGEGQthGqoUf/env \
  --scope nikita-tolstiks-projects \
  --raw | jq '[.envs[] | {id,key,target,gitBranch,type}]'
```

The second command intentionally prints environment metadata only. Never print environment values, CLI access tokens,
deployment-protection bypass tokens, or temporary share URLs. Pipe mutation request bodies through stdin, suppress the
response when it can contain a value, and perform a separate metadata-only read after the mutation.

Before a mutation:

1. Confirm the local Git branch and working-tree state.
2. Confirm the authenticated Vercel identity and the explicit team/project metadata.
3. Resolve the exact environment-variable or deployment ID with a read-only request.
4. Confirm that the user authorized the shared-environment change, especially for Production.
5. Prefer the existing Git integration for deployments. Use manual deploy, promote, rollback, alias, or domain changes
   only when the user explicitly requests them or an authorized incident recovery requires them.

The required public Vite configuration is scoped independently:

| Vercel target | `VITE_API_URL` |
| --- | --- |
| Development | `http://localhost:4000` |
| Preview | `https://api-dev.finnn.xyz` |
| Production | `https://api.finnn.xyz` |

When replacing or renaming a build-time variable, create and validate the new scoped variables first. Let the Git
integration produce a Preview deployment, confirm that its built assets contain the expected API origin and no wrong
environment or localhost fallback, and only then delete the obsolete variables by their resolved IDs. A Vite build
without `VITE_API_URL` is expected to fail before bundling.

Use `vercel inspect` for deployment state and aliases. Preview and DEV are protected; use authenticated `vercel curl`
instead of disabling deployment protection or exposing a bypass token:

```bash
pnpm --silent dlx vercel@latest inspect <deployment-url> --scope nikita-tolstiks-projects
pnpm --silent dlx vercel@latest curl https://dev.finnn.xyz/dashboard \
  --scope nikita-tolstiks-projects -- \
  --silent --show-error --output /dev/null --write-out '%{http_code} %{content_type}\n'
```

After a deployment, verify direct loads for `/`, `/login`, `/dashboard`, `/invite/test-token`, and
`/verify-email/test-token`; check the manifest, service worker, icons, and hashed assets with their expected content
types; inspect the built HTTP-client chunk for the environment's API origin and the absence of other environment URLs,
localhost, or obsolete variable names; then verify API `/health` and a credentialed CORS preflight from the matching web
origin. Keep deployment protection enabled throughout.

Do not run `vercel link`, `vercel pull`, or `vercel env pull` in an existing checkout merely to inspect the shared
project. Linking creates `.vercel` state, and pulling can overwrite local environment files. If a task genuinely needs
local linking, confirm the intended project and use the monorepo-aware link flow; preserve existing `.env` files before
any pull.

## Railway Topology And Agent Operations

Railway workspace ID is `0d1cc03f-784c-4d9f-8f21-0a35d3459ff3`. The primary project is `Finnn`
(`17245e2b-c104-4e6f-81a6-0bb8ffd4b403`): Production environment ID is
`867b4c7c-cb08-4da3-9408-f0db1a5a979d`, and develop environment ID is
`3e1d8b6f-882a-4de8-b06d-f8367de04ed1`.

| Service | Railway ID | Environments | Purpose and source |
| --- | --- | --- | --- |
| `api` | `c6c6b351-f57e-4d19-8ae4-3a7ec50a4507` | develop, production | GitHub `nik-tolstik/finnn`: `develop` deploys DEV and `main` deploys Production. |
| `Postgres` | `7ce03ef2-41e5-4ca2-a729-e7ed2e89c99c` | develop | DEV PostgreSQL 18 with a persistent volume. |
| `Postgres-x8Vl` | `25a9f5d1-c6bf-49fc-94d0-04a6fbb8b330` | production | Production PostgreSQL 18 in EU West, persistent volume, 1 vCPU / 1 GB, Serverless disabled. |
| `exchange-rates-cron` | `b7f24cda-b1eb-49af-be0b-5f77d3b53610` | develop, production | Calls the environment API at `30 8 * * *` UTC. |
| `postgres-backup-cron` | `1e19ed24-6247-4dca-9b8e-aa847e6fc21b` | production | GitHub `main`, config `/packages/postgres-backup/railway.json`, daily at `0 2 * * *` UTC. |

The retired database services, persistent volumes, source variables, and local plaintext exports were deleted after
the PostgreSQL cutover, encrypted backup, restore rehearsal, and application health checks were validated.

Encrypted PostgreSQL objects live in the private `finnn-postgres-backups-prod` Bucket
(`a52e1348-08ec-4b4e-ade4-01ca16088d92`) in the separate `Finnn Backups` project
(`1579c103-a426-4f8f-94bd-dfc7da9bd464`). Its Production environment ID is
`f7dfb57b-2aa1-437d-9b55-cf7b204140d5`. The separate project reduces accidental deletion coupling; it does not replace
offline custody of the age identity.

Authenticated agents may use Railway CLI or API access when the requested task requires it. Read-only inspection is
allowed for diagnosis. Creating or deleting services, changing variables, deploying, stopping a runtime, changing
limits, or moving data requires user authorization for that scope. Before a mutation, resolve the exact IDs above and
re-read the live state; after it, verify deployment status, region, limits, schedule, volume state, and secret-free logs.
IDs are operational selectors rather than secrets, but they become stale when a resource is recreated.

The local NVM environment can conflict with Railway's packaged CLI. Use the pinned CLI with the conflicting variables
unset, and always pass explicit targets for mutations because the main checkout may be linked to Production:

```bash
unset NVM_DIR NVM_BIN NVM_INC NVM_CD_FLAGS npm_config_prefix
pnpm dlx @railway/cli@5.30.1 status --json
```

`railway variable list --json`, `railway variable --kv`, and `railway bucket credentials` return raw secrets. Capture
such output without echoing it, filter to non-secret metadata, and never commit it. Cross-project variable references do
not resolve, so the backup cron receives copied Bucket credentials while its database URL uses the same-project private
PostgreSQL hostname. Preserve `multiRegionConfig` when updating an instance, and treat credential resets, variable
replacement, staged-change discard, and service or Bucket deletion as destructive operations.

## Production Environment

Required variables:

```env
DATABASE_URL="postgresql-runtime-connection-string"
DIRECT_URL="postgresql-direct-connection-string"
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
TELEGRAM_BOT_WEBHOOK_SECRET="production-telegram-webhook-secret"
TELEGRAM_BOT_WEBHOOK_URL="https://api.finnn.xyz/telegram/webhook"
TELEGRAM_BOT_DRAFT_TTL_SECONDS="1800"
OPENROUTER_API_KEY="production-openrouter-api-key"
OPENROUTER_APP_REFERER="https://finnn.xyz"
OPENROUTER_APP_TITLE="Finnn"
OPENROUTER_TEXT_MODEL="openai/gpt-4.1-mini"
OPENROUTER_VISION_MODEL="google/gemini-2.5-flash"
OPENROUTER_TRANSCRIPTION_MODEL="openai/gpt-4o-mini-transcribe"
```

Google authentication variables are required when Google login/linking is enabled:

```env
GOOGLE_CLIENT_ID="google-oauth-client-id"
GOOGLE_CLIENT_SECRET="google-oauth-client-secret"
GOOGLE_REDIRECT_URI="https://production-api-url/auth/google/callback"
GOOGLE_AUTH_STATE_SECRET="production-google-state-secret"
GOOGLE_AUTH_STATE_TTL_SECONDS="600"
```

Register both deployment callback URLs in Google Cloud Console:

```text
https://api-dev.finnn.xyz/auth/google/callback
https://api.finnn.xyz/auth/google/callback
```

BotFather setup:

- Create or select the production bot.
- Open Bot Settings > Web Login.
- Register the production web URL and API callback host.
- Store the issued client ID and secret in the API deployment environment.
- Open Bot Settings > Mini Apps.
- Register the production Mini App URL as `https://finnn.xyz/dashboard`.
- Store the same production bot token in `TELEGRAM_BOT_TOKEN` for API-side Mini App `initData` validation.
- Set the production bot webhook to `https://api.finnn.xyz/telegram/webhook` with the production secret token. Repeat the
  same process for the DEV bot with `https://api-dev.finnn.xyz/telegram/webhook` and separate OpenRouter/bot secrets.

Use Resend over HTTPS for Railway email delivery. The sender domain must be verified in Resend:

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="Finnn <no-reply@your-verified-domain.example>"
PASSWORD_RESET_CODE_TTL_SECONDS="900"
PASSWORD_RESET_MAX_ATTEMPTS="5"
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS="60"
```

Avatar and category icon uploads require a private Railway Bucket exposed through its S3-compatible credentials:

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

## Vercel Frontend Deployment

Deploy `packages/web` as a Vite project with `dist` as the output directory. Set `VITE_API_URL` in each Vercel
environment before the build; browser bundles receive the value at build time. The checked-in
`packages/web/vercel.json` rewrites client-side route requests to `index.html` while Vercel continues to serve existing
static files directly.

After deployment, open `/`, one public route such as `/login`, and one protected deep link such as `/dashboard`
directly. A hard refresh must return the SPA shell, and the client auth gate must still own the protected-route
redirect. Confirm that `/sw.js`, the manifest, icons, and hashed `/assets/*` files are served as static files.

## Railway Backend Deployment

Deploy the backend as the `api` service from `packages/api`.

Railway setup:

- Set the service root directory to `/packages/api`.
- Set the config-as-code file path to `/packages/api/railway.json`.
- Keep the checked-in config on the Railpack builder with `pnpm --filter api build`, pre-deploy
  `pnpm --filter api db:migrate:deploy`, `pnpm --filter api start`, and `/health`.
- The pre-deploy command applies only committed Prisma SQL migrations. A failed migration blocks the new deployment;
  never replace it with `db push`, `migrate dev`, or a command containing destructive reset flags.
- Keep DEV and PROD PostgreSQL services, URLs, migration histories, and backups separate.
- Confirm the service listens on Railway's injected `PORT`; the NestJS bootstrap already binds `0.0.0.0`.

Required Railway variables:

```env
DATABASE_URL="postgresql-runtime-connection-string"
DIRECT_URL="postgresql-direct-connection-string"
API_AUTH_SECRET="production-secret"
API_COOKIE_SECRET="production-cookie-secret"
API_COOKIE_SECURE="true"
API_COOKIE_SAME_SITE="none"
API_COOKIE_DOMAIN=""
API_ALLOWED_ORIGINS="https://production-app-url"
WEB_APP_URL="https://production-app-url"
CRON_SECRET="production-cron-secret"
RESEND_API_KEY="re_..."
EMAIL_FROM="Finnn <no-reply@your-verified-domain.example>"
TELEGRAM_CLIENT_ID="bot-or-client-id-from-botfather"
TELEGRAM_CLIENT_SECRET="telegram-client-secret"
TELEGRAM_REDIRECT_URI="https://production-api-url/auth/telegram/callback"
TELEGRAM_AUTH_STATE_SECRET="production-telegram-state-secret"
TELEGRAM_AUTH_STATE_TTL_SECONDS="600"
GOOGLE_CLIENT_ID="google-oauth-client-id"
GOOGLE_CLIENT_SECRET="google-oauth-client-secret"
GOOGLE_REDIRECT_URI="https://production-api-url/auth/google/callback"
GOOGLE_AUTH_STATE_SECRET="production-google-state-secret"
GOOGLE_AUTH_STATE_TTL_SECONDS="600"
PASSWORD_RESET_CODE_TTL_SECONDS="900"
PASSWORD_RESET_MAX_ATTEMPTS="5"
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS="60"
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
VITE_API_URL="https://production-api-url"
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
curl -H "Authorization: Bearer $CRON_SECRET" https://api.example.com/cron/scheduled-payment-reminders
```

The exchange-rate handler is `packages/api/src/currency/currency.controller.ts`.
The scheduled-payment reminder handler is `packages/api/src/scheduled-payments/scheduled-payments-cron.controller.ts`.
Exchange-rate date keys follow the `Europe/Minsk` calendar day; run the daily job after NBRB publishes that day's rates.

Operational requirements:

- Set the same `CRON_SECRET` in the API environment and in any scheduler that invokes the route.
- Confirm `DATABASE_URL` points to the PostgreSQL database for the same environment and that its pool has capacity for
  API and cron traffic.
- Keep `VITE_API_URL` in the web deployment aligned with the deployed API URL. Vite embeds this value at build time,
  so rebuild the frontend after changing it.

Railway setup:

- Keep the API service as a persistent web service.
- Create a separate Railway cron service in the same environment.
- For exchange rates, set the cron service schedule to run once per day after NBRB publishes rates. NBRB daily-rate aggregators
  report an update schedule around 11:00 Europe/Minsk, so use `30 8 * * *` for 11:30 Minsk time.
- For scheduled payment reminders, run the scheduler hourly and call `/cron/scheduled-payment-reminders`.
- Give the cron service `API_BASE_URL` and `CRON_SECRET` variables.
- Use a start command that calls the API endpoint and then exits.

Example cron service variables:

```env
API_BASE_URL="https://api-dev.finnn.xyz"
CRON_SECRET="same-secret-as-api"
```

Example cron service start command:

```bash
node -e 'fetch(process.env.API_BASE_URL + "/cron/update-exchange-rates", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } }).then(async (response) => { const body = await response.text(); console.log(body); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error); process.exit(1); })'
```

Scheduled payment reminder command:

```bash
node -e 'fetch(process.env.API_BASE_URL + "/cron/scheduled-payment-reminders", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } }).then(async (response) => { const body = await response.text(); console.log(body); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error); process.exit(1); })'
```

## PostgreSQL Connections And Pooling

Prisma uses two connection URLs:

- `DATABASE_URL` is the API runtime URL. It may use a transaction-capable pooled endpoint.
- `DIRECT_URL` bypasses the pool and is used by Prisma Migrate and administrative tools.

They may be identical on local PostgreSQL. Railway API instances use the least-privilege `finnn_app` role and append
`schema=public`, `connection_limit=5`, `pool_timeout=10`, and `connect_timeout=5` to `DATABASE_URL`. `DIRECT_URL` retains
the administrative database role so Prisma Migrate can apply reviewed migrations.

Both Railway databases use `max_connections=50`, `effective_cache_size=512MB`, and
`idle_in_transaction_session_timeout=60s`. `pg_stat_statements` is installed and preload-enabled. Reserve connections
for migrations, backups, monitoring, and incident response; recalculate the five-connection per-replica pool before
horizontal scaling. Production backups use the read-only `finnn_backup` role with a two-connection role limit and
default `SELECT` privileges for future tables.

## PostgreSQL Backup And Restore

Production daily backups are owned by the isolated `packages/postgres-backup` Railway cron service. It streams the
PostgreSQL 18 custom dump through age without persisting plaintext, fully re-downloads the S3-compatible object for
SHA-256 verification, and uploads a completion manifest last. Follow the complete setup, alerting, identity rotation,
retention, and restore procedure in [`docs/postgresql-backups.md`](./postgresql-backups.md).

The commands below remain useful for a manual local backup or isolated restore rehearsal. Do not use an unencrypted
manual dump as a substitute for the scheduled production workflow.

Use PostgreSQL-native custom-format backups. `pg_dump` and `pg_restore` need a direct libpq-compatible URL; do not pass a
Prisma-only `?schema=public` parameter to them.

```bash
mkdir -p backups
FINNN_PG_DIRECT_URL="postgresql://user:password@host:5432/finnn?sslmode=require"
pg_dump --dbname="$FINNN_PG_DIRECT_URL" --format=custom --file="backups/finnn-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Verify every material backup by restoring it into an empty, non-production database:

```bash
FINNN_PG_RESTORE_LIBPQ_URL="postgresql://user:password@host:5432/finnn_restore?sslmode=require"
FINNN_PG_RESTORE_PRISMA_URL="postgresql://user:password@host:5432/finnn_restore?schema=public&sslmode=require"
pg_restore --list backups/finnn-YYYYMMDDTHHMMSSZ.dump
pg_restore --dbname="$FINNN_PG_RESTORE_LIBPQ_URL" --single-transaction --exit-on-error --no-owner --no-acl \
  backups/finnn-YYYYMMDDTHHMMSSZ.dump
DATABASE_URL="$FINNN_PG_RESTORE_PRISMA_URL" DIRECT_URL="$FINNN_PG_RESTORE_PRISMA_URL" pnpm db:migrate:status
```

The target database must already exist and must not serve application traffic. A successful `pg_dump` command alone is
not proof that the backup is restorable. Keep provider-managed retention and point-in-time recovery enabled where
available, but still rehearse logical restore before cutover and major schema changes.

## Database Schema Changes

PostgreSQL schema history lives in `packages/api/prisma/migrations` and is committed with the corresponding
`packages/api/prisma/schema.prisma` change.

Development sequence:

```bash
pnpm db:migrate:dev --name <descriptive-name>
pnpm db:migrate:status
pnpm db:generate
pnpm typecheck
pnpm test
```

Review generated SQL for table rewrites, long locks, destructive operations, foreign-key validation, and non-concurrent
index creation. Do not edit a migration after it has been applied to a shared environment; create a new corrective
migration instead. Data backfills and destructive changes should use an expand/migrate/contract rollout so the previous
API version remains compatible while Railway pre-deploy applies pending migrations.

Production and shared DEV use only:

```bash
pnpm db:migrate:deploy
pnpm db:migrate:status
```

Do not use `prisma db push`, `prisma migrate dev`, reset flags, or ad hoc schema SQL against a shared database.

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
- Scheduled payment reminders.

Email depends on:

- API and web public URL variables for generated links.
- `RESEND_API_KEY` and `EMAIL_FROM` for Railway HTTPS email delivery.

If email delivery fails, verify the Resend API key, sender-domain verification, and `EMAIL_FROM`.

Scheduled payment reminder delivery records failed email or Telegram channels in `scheduled_payment_reminder_deliveries`.
Email failures usually mean the Resend API key or sender domain is invalid. Telegram failures usually mean the recipient
has not linked Telegram or has no `telegramChatId` in `TelegramBotPreference`.

## Mobile browser testing from WSL2

WSL2 normally runs behind a private NAT address such as `172.28.x.x`. That address is reachable from WSL and Windows,
but it is not normally reachable from a phone on the same Wi-Fi network. Use the Windows host LAN address and forward
the development ports into WSL.

1. Find the Windows LAN IPv4 address with `ipconfig`. Use the IPv4 address from the active Wi-Fi or Ethernet adapter,
   for example `192.168.1.102`. The phone and the Windows host must be on the same local network.

2. In WSL, start the API with the Windows LAN origin allowed by CORS:

```bash
FINNN_LAN_IP=192.168.1.102
API_ALLOWED_ORIGINS="http://${FINNN_LAN_IP}:3000,http://localhost:3000" pnpm --filter api dev
```

3. In a second WSL terminal, start the web app with the forwarded API URL:

```bash
FINNN_LAN_IP=192.168.1.102
VITE_API_URL="http://${FINNN_LAN_IP}:4000" pnpm --filter web exec vite --host 0.0.0.0 --port 3000
```

4. In Windows PowerShell started **as Administrator**, create port forwarding and allow only local-subnet traffic:

```powershell
$wslIp = (wsl.exe hostname -I).Trim().Split()[0]

netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=3000
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=4000

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=3000 connectaddress=$wslIp connectport=3000
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=4000 connectaddress=$wslIp connectport=4000

New-NetFirewallRule -DisplayName "Finnn WSL Dev" -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort 3000,4000 -RemoteAddress LocalSubnet -Profile Any
```

The port proxy points to the current WSL IP. Re-run the PowerShell block after `wsl --shutdown` or any WSL restart,
because the `172.28.x.x` address can change. Open `http://192.168.1.102:3000` on the phone; do not use the WSL NAT
address directly. Stop the API and web processes with `Ctrl+C` in their WSL terminals when testing is finished.

For a quick local check, run `curl http://127.0.0.1:3000/login` and `curl http://127.0.0.1:4000/health` from WSL.
If the phone cannot connect, verify that the Windows PowerShell commands were run as Administrator, the phone is on
the same Wi-Fi, and Windows Firewall allows the local-subnet rule.

## Service Worker

The service worker is intentionally conservative. It uses cache-first only for same-origin, content-hashed Vite files
under `/assets/`; Vercel also serves `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`. Documents,
API responses, financial routes, unhashed public files, and non-GET requests remain outside the service-worker cache.

On touch screens, the web app provides a custom pull-to-refresh gesture. Pull down from the top of a page and release
after the content-attached indicator reaches the ready state. The gesture ignores dialogs, nested scrollable containers,
and interactive controls, then performs a full document reload after release.

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
- `DATABASE_URL` reaches the runtime PostgreSQL endpoint, `DIRECT_URL` reaches the direct endpoint, and the total pool
  budget covers every deployed API replica plus operational reserve.
- `pnpm db:migrate:status` reports no unapplied or divergent migrations after Railway pre-deploy runs
  `db:migrate:deploy`.
- Schema changes are backward compatible while the previous API deployment is still serving traffic.
- A current PostgreSQL backup has been restored successfully in a non-production database.
- Railway Bucket avatar variables are present and point at the correct environment bucket.
- Cron endpoint returns success with a valid secret.
- API auth cookie variables match the deployed API and web hosts.
- Telegram redirect URI is registered in BotFather and matches `TELEGRAM_REDIRECT_URI`.
- Telegram Mini App URL is registered in BotFather and points to the existing `/dashboard` route.
- Telegram Mini App launch is tested in real Telegram clients for cookie persistence and existing dashboard flows.
- Email links use the production web URL.
