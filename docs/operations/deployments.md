# Deployments And Scheduled Jobs

## Deployment Sources

The checked-in configuration is authoritative for build and deployment behavior:

- [`packages/web/vercel.json`](../../packages/web/vercel.json) defines the Vite frontend output, static-asset headers,
  and SPA fallback.
- [`packages/api/railway.json`](../../packages/api/railway.json) defines the API build, migration pre-deploy command,
  start command, and health check.
- [`packages/postgres-backup/railway.json`](../../packages/postgres-backup/railway.json) defines the backup cron
  build, watch patterns, schedule, and restart policy.

Resolve the live provider project, environment, deployment branch, service, domain, and deployment state before any
operation. Prefer the existing Git integration for normal deployments. Manual deploy, promote, rollback, alias, domain,
or environment-variable changes require explicit user authorization.

## Environment Alignment

The complete application variable inventory belongs to the package `.env.example` files. Set values only in the
matching provider environment and keep each web deployment aligned with its API deployment:

- `VITE_API_URL` is public, embedded by Vite at build time, and must name the API for the same environment.
- API allowed origins, application URL, cookie settings, OAuth callback URLs, Telegram URLs, and cron URLs must all
  describe the same environment pair.
- Keep development and production database URLs, credentials, OAuth clients, Telegram bots, object storage, and backups
  separate.

Create and validate replacement build-time variables before deleting obsolete variables. A missing `VITE_API_URL` is a
build error; after changing it, rebuild the frontend and inspect the built deployment rather than trusting a local
environment file.

## Frontend Deployment Verification

After a frontend deployment, use authenticated access where protection is enabled and verify:

1. Direct loads for `/`, a public route such as `/login`, a protected deep link such as `/dashboard`, and representative
   parameterized public routes.
2. SPA fallback behavior after a hard refresh, while the client auth gate still owns protected-route redirects.
3. Static delivery and content types for the manifest, service worker, icons, and hashed `/assets/*` files.
4. The built HTTP-client assets contain only the intended API origin and no localhost, wrong-environment, or obsolete
   public variable value.
5. API `/health` and a credentialed CORS preflight from the matching web origin.

Keep deployment protection enabled. Use authenticated provider access for protected checks instead of weakening
protection or exposing a bypass token.

## API Deployment Verification

Deploy the API from the package and configuration selected by live provider discovery. The committed pre-deploy command
applies only reviewed SQL migrations; do not replace it with `db push`, `migrate dev`, reset flags, or ad hoc schema SQL
in a shared environment.

After a deployment, verify the resolved API health endpoint and inspect secret-free deployment logs. Provider health
checks gate startup only, so retain runtime monitoring appropriate to the environment.

## Scheduled Jobs

Schedulers call the protected API cron endpoints for exchange rates and scheduled-payment reminders. Give each
scheduler the API origin and the same `CRON_SECRET` as its target API environment. A cron process must exit after its
request completes.

Schedule exchange-rate updates after the configured source has published the relevant `Europe/Minsk` calendar day. Run
scheduled-payment reminders at an interval that meets the product requirement. Resolve the live schedule and service
before modifying either.

## Release Checklist

1. Confirm the target provider resources through metadata-only discovery and verify the intended Git revision.
2. Confirm package configuration and environment alignment without reading or printing secret values.
3. Verify API health, matching CORS behavior, and any changed scheduled job.
4. Verify frontend direct routes, SPA fallback, static assets, and service-worker behavior when the web package changed.
5. Record the outcome and any risks in the relevant Linear handoff or Project Update.
