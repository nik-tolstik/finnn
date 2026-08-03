# Database Operations

## Connections And Capacity

Prisma uses two connection URLs:

- `DATABASE_URL` is the API runtime connection. It may use a transaction-capable pooled endpoint.
- `DIRECT_URL` bypasses the runtime pool and is used by Prisma Migrate, `pg_dump`, and administrative tools.

The URLs may be identical for local PostgreSQL. In a managed environment, preserve the provider's TLS requirements and
keep `DIRECT_URL` out of a transaction pooler. Never print either URL.

Before adding API replicas or changing pool settings, resolve the live database connection limit and calculate total
runtime connections across replicas. Reserve capacity for migrations, scheduled jobs, monitoring, backups, and incident
response.

## Schema Changes

[`docs/development.md`](../development.md) owns the local schema-authoring sequence. Schema history lives in
[`packages/api/prisma/migrations`](../../packages/api/prisma/migrations) and is committed with the corresponding
[`schema.prisma`](../../packages/api/prisma/schema.prisma) change.

For shared development and production:

1. Review generated SQL for table rewrites, long locks, destructive operations, foreign-key validation, and index
   creation.
2. Apply only committed migrations through the configured deployment procedure.
3. Check migration status after deployment.
4. Never edit an applied migration; create a corrective migration instead.

Backfills and destructive changes require an expand/migrate/contract rollout so the previous API version remains
compatible while deployment applies pending migrations. Do not use `prisma db push`, `prisma migrate dev`, reset flags,
or ad hoc schema SQL against a shared database.

## Backup And Recovery

The encrypted backup configuration, monitoring, retention, and restore procedure belong to
[Encrypted PostgreSQL Backups](../postgresql-backups.md). Restore only into an empty, isolated database that does not
serve application traffic.
