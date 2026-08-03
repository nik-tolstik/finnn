# Operations

This section contains durable procedures for operating Finnn. It does not record a snapshot of a provider account or
environment.

## Sources Of Truth

| Fact | Canonical source |
| --- | --- |
| Vercel build and routing behavior | [`packages/web/vercel.json`](../../packages/web/vercel.json) |
| API deployment behavior | [`packages/api/railway.json`](../../packages/api/railway.json) |
| Backup cron deployment behavior | [`packages/postgres-backup/railway.json`](../../packages/postgres-backup/railway.json) |
| Application environment-variable inventory | [`packages/api/.env.example`](../../packages/api/.env.example) and [`packages/web/.env.example`](../../packages/web/.env.example) |
| Current provider resources, domains, branches, schedules, limits, and variable metadata | Authenticated provider state |

## Before An Infrastructure Mutation

1. Confirm that the user authorized the exact provider, environment, and operation.
2. Use authenticated, read-only provider discovery to resolve the current organization, project, environment, service,
   branch, and resource identifier. Do not rely on a previously copied identifier or on the local checkout's link state.
3. Capture only the metadata needed to identify the target. Do not print or store secret values, database URLs,
   credentials, access tokens, encryption identities, deployment-protection bypass tokens, or temporary share URLs.
4. Use the resolved target explicitly for a mutation, then perform a separate metadata-only verification.

Do not run `vercel link`, `vercel pull`, or `vercel env pull` in an existing checkout unless the task explicitly
requires local linking or environment synchronization. Those commands can create local state or overwrite environment
files.

## Runbooks

- [Deployments and scheduled jobs](./deployments.md)
- [Database operations](./database.md)
- [External integrations](./integrations.md)
- [Encrypted PostgreSQL backups](../postgresql-backups.md)
