# Operations

## Production Environment

Required variables:

```env
DATABASE_URL="mongodb-connection-string"
API_AUTH_SECRET="production-secret"
API_COOKIE_SECRET="production-cookie-secret"
API_ALLOWED_ORIGINS="https://production-app-url"
CRON_SECRET="production-cron-secret"
```

Email variables are required when registration verification and workspace invites should send real email:

```env
SMTP_HOST="smtp-host"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASSWORD="smtp-password"
SMTP_FROM="Finnn <no-reply@example.com>"
```

## Build

The production build runs:

```bash
pnpm build
```

This script builds the API package first, then the web package.

## Backend Cron

The migration target is for Railway or another backend scheduler to call the API cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://api.example.com/cron/update-exchange-rates
```

The API handler is `packages/api/src/currency/currency.controller.ts`.

Operational requirements:

- Set the same `CRON_SECRET` in the API environment and in any scheduler that invokes the route.
- Confirm `DATABASE_URL` points to a MongoDB deployment that supports Prisma's transaction requirements.
- Keep `NEXT_PUBLIC_API_URL` in the web deployment aligned with the deployed API URL.
- Keep `NEXT_PUBLIC_APP_URL` aligned with the deployed web URL for client-facing absolute URLs.

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

For MongoDB, the project uses Prisma `db push` rather than a SQL migration workflow.

Recommended sequence:

```bash
pnpm db:generate
pnpm db:push
pnpm typecheck
pnpm test
```

When adding indexes, verify they are represented in `packages/api/prisma/schema.prisma` and applied through `pnpm db:push`.

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
- Cron endpoint returns success with a valid secret.
- API auth cookie variables match the deployed API and web hosts.
- Email links use the production web URL.
