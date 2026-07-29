# PostgreSQL Migration

## Summary

Replace the Prisma MongoDB datasource with PostgreSQL while keeping Finnn's external behavior stable. The first cutover
preserves existing IDs as text and keeps persisted money values as strings. Native PostgreSQL numeric types and SQL
analytics are follow-up optimizations after behavioral parity is proven.

## Goals

- Enforce relational integrity with PostgreSQL foreign keys and explicit referential actions.
- Establish reviewed Prisma SQL migrations and use `prisma migrate deploy` in production.
- Preserve existing IDs, sessions, URLs, JSON references, and API response shapes.
- Prevent lost account-balance updates under concurrent financial operations.
- Provide repeatable MongoDB-to-PostgreSQL migration and validation commands.
- Support local PostgreSQL development and documented Railway deployment.

## Non-Goals

- Changing API DTOs or generated web clients.
- Converting money strings to Prisma `Decimal` in the cutover release.
- Moving analytics aggregation into SQL in the cutover release.
- Renaming all database columns to snake case.
- Automatic dual-write or reverse replication between databases.

## Starting State

- `packages/api/prisma/schema.prisma` used the MongoDB connector, `@db.ObjectId`, and Mongo `_id` mappings.
- The API used Prisma for normal runtime persistence. Direct MongoDB driver usage was limited to operational scripts.
- Railway applied `prisma db push` before API deployments.
- Local MongoDB required a replica set because domain services used transactions.
- API tests used Prisma mocks and therefore did not exercise database constraints or transaction isolation.
- Financial mutations read string balances and later wrote computed absolute balances inside interactive transactions.

## Target Data Model

- Use `provider = "postgresql"`.
- Store existing and new public IDs as `text`; migrated ObjectId values are inserted unchanged.
- Generate new IDs with Prisma `cuid()` after cutover.
- Map `DateTime` fields to timezone-aware PostgreSQL timestamps.
- Keep money amounts and exchange-rate behavior unchanged for the first cutover.
- Map JSON fields to PostgreSQL `jsonb` and scalar lists to PostgreSQL arrays.
- Make optional user email unique; PostgreSQL permits multiple `NULL` values.
- Define referential actions deliberately and index every foreign-key access path.
- Add SQL check constraints only after source-data validation proves existing rows comply.

## Implementation Plan

### 1. Schema and migrations

- Convert the Prisma schema to PostgreSQL-compatible IDs and native types.
- Add missing foreign-key indexes and explicit referential actions.
- Generate and review the initial SQL migration.
- Add `db:migrate:dev`, `db:migrate:deploy`, and migration status commands.
- Replace Railway `db push` with `prisma migrate deploy`.

### 2. Runtime portability

- Replace Mongo ObjectId validators with provider-independent ID validation.
- Remove the runtime MongoDB package after migration-only tooling no longer needs it.
- Keep web/API ID and money contracts unchanged.

### 3. Transaction correctness

- Add a reusable PostgreSQL transaction helper with bounded retry for Prisma `P2034` conflicts.
- Run balance-changing transactions at `Serializable`, or explicitly lock all affected account rows in stable ID order.
- Add real PostgreSQL integration coverage for parallel expenses, transfers, debt operations, and scheduled-payment writes.
- Keep external network or object-storage calls outside locked transaction sections.

### 4. Data transfer

- Add a preflight audit for duplicate unique fields, missing required values, orphan references, invalid IDs, invalid money
  strings, arrays, JSON, and dates.
- Export a consistent MongoDB snapshot and import in dependency order while passing IDs explicitly.
- Make import resumable or safely repeatable against an empty target database.
- Compare per-model counts and stable content digests.
- Recompute account balances and debt amount, remaining amount, and status from ledger data. Preserve the stored
  materialized account balance when it differs and report the mismatch for explicit review; never silently repair
  financial data as part of the provider cutover. Debt ledger mismatches remain fatal. Debt rows without any ledger
  transactions are reported as warnings because their historical values cannot be reconstructed.
- Ignore only explicitly retired source fields and collections with reviewed legacy shapes. Legacy debt `accountId`
  values must match the account on exactly one `created` debt transaction when that transaction exists. For debts that
  predate created ledger entries, preserve the stored amount and require subsequent entries to reproduce the stored
  remaining amount and status; changed shapes and conflicting links remain fatal.
- Skip orphan authentication sessions only when they were expired or revoked at one captured audit cutoff. An active
  session referencing a missing user remains a fatal source-integrity error.
- Skip an account whose workspace is missing only when the account also has no owner and no dependent financial or
  preference records. Preserve the source document in the immutable MongoDB backup and report every skipped account.
- Use the default MongoDB snapshot transaction when the rehearsed migration fits within the source transaction lifetime.
  MongoDB commonly defaults `transactionLifetimeLimitSeconds` to 60 seconds; for a longer cutover, stop every source
  writer for the entire maintenance window and run the importer with `--no-snapshot`.

### 5. Operations

- Replace local MongoDB Compose configuration with PostgreSQL and a persistent volume.
- Document direct and pooled connection URLs and connection limits.
- Replace MongoDB backup/restore guidance with `pg_dump`/`pg_restore`.
- Rehearse DEV migration and production restoration.

### 6. Cutover

- Prefer a short maintenance window unless measured requirements justify CDC.
- Stop financial writes, Telegram/AI commits, and cron jobs.
- Take a final MongoDB backup, run the importer, validate all invariants, deploy the PostgreSQL-backed API, and smoke test.
- Keep the MongoDB snapshot immutable during the rollback observation period.
- Treat reopening PostgreSQL writes as the rollback boundary unless reverse replication is implemented.

## Test Plan

- Prisma schema validation and migration application against an empty PostgreSQL database.
- Migration application from the previous SQL migration state.
- Real integration tests for FK actions, unique constraints, arrays, JSON, and timezone round trips.
- Concurrent mutation tests proving no lost account or debt balance updates.
- ETL tests for ObjectId preservation, nullable fields, arrays, JSON, and failure recovery.
- Row-count and invariant validation against a representative MongoDB snapshot.
- `pnpm db:generate`, `pnpm typecheck`, `pnpm check`, `pnpm test`, and `pnpm build`.

## Documentation and Operations Updates

- Update `AGENTS.md`, `docs/development.md`, `docs/operations.md`, `docs/domain-model.md`, and `docs/README.md`.
- Update `packages/api/.env.example`, `docker-compose.yml`, package scripts, and Railway configuration.
- Document migration rehearsal, production cutover, rollback boundary, backup, and restore.

## Risks

- PostgreSQL `Read Committed` can silently lose current read-modify-write balance updates unless concurrency is fixed.
- Existing MongoDB documents may violate new foreign keys or required-field constraints.
- A large source may outlive MongoDB's snapshot transaction limit; the rehearsed fallback is a full source-write freeze,
  not an inconsistent live read.
- Incorrect referential actions can delete financial history or block expected cleanup flows.
- Mixing ID conversion, money conversion, and database conversion would make validation and rollback substantially harder.
- Mocked API tests cannot validate provider behavior.

## Open Questions

- Confirm production document counts and the acceptable maintenance window before cutover.
- Confirm Railway PostgreSQL connection-pooling topology and per-environment connection limits.
- Decide the retention period for the immutable MongoDB rollback snapshot.
- Decide whether native `numeric` money storage should follow immediately after stabilization or wait for SQL analytics work.
