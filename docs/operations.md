# Operations

## Production Environment

Required variables:

```env
DATABASE_URL="mongodb-connection-string"
NEXTAUTH_URL="https://production-app-url"
NEXTAUTH_SECRET="production-secret"
NEXT_PUBLIC_APP_URL="https://production-app-url"
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

This script first generates Prisma Client, then runs `next build`.

## Vercel

`vercel.json` configures a daily cron:

```json
{
  "path": "/api/cron/update-exchange-rates",
  "schedule": "0 0 * * *"
}
```

The route handler is `src/app/api/cron/update-exchange-rates/route.ts`.

Operational requirements:

- Set the same `CRON_SECRET` in Vercel and in any caller that manually invokes the route.
- Confirm `DATABASE_URL` points to a MongoDB deployment that supports Prisma's transaction requirements.
- Set `NEXTAUTH_URL` to the deployed URL.
- Keep `NEXT_PUBLIC_APP_URL` aligned with the deployed app URL for email links and client-facing absolute URLs.

## MongoDB Import And Export

Scripts:

- `scripts/mongo-export.ts`
- `scripts/mongo-import.ts`
- `scripts/db-seed.ts`

Commands:

```bash
pnpm db:export
pnpm db:import
pnpm db:seed
```

Before import/export:

- Confirm `DATABASE_URL`.
- Avoid running imports against production unless the target dataset and overwrite behavior are fully understood.
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

When adding indexes, verify they are represented in `prisma/schema.prisma` and applied through `pnpm db:push`.

## Email

Email helpers live in `src/shared/lib/email.ts`.

Current email use cases:

- Registration verification.
- Workspace invites.

Email depends on:

- `NEXT_PUBLIC_APP_URL` for generated links.
- SMTP variables for transport.

If email delivery fails locally, verify `.env`, SMTP credentials, provider app-password requirements, and whether the SMTP account allows the selected port/security mode.

## Service Worker

The service worker is intentionally conservative. It caches only static assets and avoids financial data.

After changing `public/sw.js`, run:

```bash
pnpm test src/shared/lib/service-worker-cache-policy.test.ts
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
- Auth redirects use the production `NEXTAUTH_URL`.
- Email links use the production `NEXT_PUBLIC_APP_URL`.
