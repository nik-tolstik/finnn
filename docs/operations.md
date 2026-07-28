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

| Environment | `WEB_APP_URL` / `API_ALLOWED_ORIGINS` | `NEXT_PUBLIC_API_URL` | `TELEGRAM_REDIRECT_URI` | `GOOGLE_REDIRECT_URI` | Mini App URL |
| --- | --- | --- | --- | --- | --- |
| PROD | `https://finnn.xyz` | `https://api.finnn.xyz` | `https://api.finnn.xyz/auth/telegram/callback` | `https://api.finnn.xyz/auth/google/callback` | `https://finnn.xyz/dashboard` |
| DEV | `https://dev.finnn.xyz` | `https://api-dev.finnn.xyz` | `https://api-dev.finnn.xyz/auth/telegram/callback` | `https://api-dev.finnn.xyz/auth/google/callback` | `https://dev.finnn.xyz/dashboard` |

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

## Railway Backend Deployment

Deploy the backend as the `api` service from `packages/api`.

Railway setup:

- Set the service root directory to `/packages/api`.
- Set the config-as-code file path to `/packages/api/railway.json`.
- Keep the checked-in config on the Railpack builder with `pnpm --filter api build`, pre-deploy
  `pnpm --filter api db:push`, `pnpm --filter api start`, and `/health`.
- The pre-deploy command applies Prisma schema and index changes to the `DATABASE_URL` of the current Railway
  environment. It covers DEV and PROD automatically; keep their database URLs separate.
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
curl -H "Authorization: Bearer $CRON_SECRET" https://api.example.com/cron/scheduled-payment-reminders
```

The exchange-rate handler is `packages/api/src/currency/currency.controller.ts`.
The scheduled-payment reminder handler is `packages/api/src/scheduled-payments/scheduled-payments-cron.controller.ts`.
Exchange-rate date keys follow the `Europe/Minsk` calendar day; run the daily job after NBRB publishes that day's rates.

Operational requirements:

- Set the same `CRON_SECRET` in the API environment and in any scheduler that invokes the route.
- Confirm `DATABASE_URL` points to a MongoDB deployment that supports Prisma's transaction requirements.
- Keep `NEXT_PUBLIC_API_URL` in the web deployment aligned with the deployed API URL.

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
node -e "fetch(`${process.env.API_BASE_URL}/cron/update-exchange-rates`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).then(async (response) => { const body = await response.text(); console.log(body); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error); process.exit(1); })"
```

Scheduled payment reminder command:

```bash
node -e "fetch(`${process.env.API_BASE_URL}/cron/scheduled-payment-reminders`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).then(async (response) => { const body = await response.text(); console.log(body); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error); process.exit(1); })"
```

## MongoDB Import And Export

Scripts:

- `packages/api/scripts/mongo-export.ts`
- `packages/api/scripts/mongo-import.ts`
- `packages/api/scripts/db-seed.ts`

Commands:

```bash
pnpm db:export ./backups/manual
pnpm db:import ./backups/manual --drop --db=finnn_restore
pnpm db:seed
```

Before import/export:

- Confirm `DATABASE_URL`.
- Use throwaway database names for import verification.
- Production imports are blocked unless `--allow-production` is passed. Use that flag only when the target dataset and overwrite behavior are fully understood.
- Run `pnpm db:generate` if schema or Prisma version changed.

## Database Schema Changes

For MongoDB, the project uses Prisma `db push` rather than SQL-style change files.

Railway runs `pnpm --filter api db:push` before each API deployment. Do not run it manually against the target
Railway database during a normal release, and do not add `--accept-data-loss` or `--force-reset` to the deployment
command. A destructive schema change, rename, or data backfill needs an explicit, reviewed rollout.

Recommended sequence:

```bash
pnpm db:generate
pnpm db:push
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
NEXT_PUBLIC_API_URL="http://${FINNN_LAN_IP}:4000" pnpm --filter web exec next dev -H 0.0.0.0 -p 3000
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

The service worker is intentionally conservative. It caches only static assets and avoids financial data.

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
- MongoDB accepts Prisma transactions.
- Schema changes are backward compatible while the previous API deployment is still serving traffic; Railway pre-deploy
  applies `db:push` to the target environment.
- Railway Bucket avatar variables are present and point at the correct environment bucket.
- Cron endpoint returns success with a valid secret.
- API auth cookie variables match the deployed API and web hosts.
- Telegram redirect URI is registered in BotFather and matches `TELEGRAM_REDIRECT_URI`.
- Telegram Mini App URL is registered in BotFather and points to the existing `/dashboard` route.
- Telegram Mini App launch is tested in real Telegram clients for cookie persistence and existing dashboard flows.
- Email links use the production web URL.
