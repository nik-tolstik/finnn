# Work Log

## 2026-07-29 - Encrypted PostgreSQL backup cron

### Scope

- Added an isolated Railway cron package based on PostgreSQL 18 client tooling.
- Streamed `pg_dump` custom-format output directly through asymmetric age encryption so plaintext is not persisted.
- Added S3-compatible upload with configurable endpoint, region, bucket, and URL style; SHA-256 metadata; full
  re-download verification; and a completion manifest uploaded last.
- Added bounded child-command and whole-job timeouts, signal handling, credential redaction, secure temporary-file
  permissions and cleanup, deterministic non-zero failure exits, unit tests, and an English operations runbook.

### Files Changed

- `packages/postgres-backup`
- `.dockerignore`
- `package.json`
- `pnpm-lock.yaml`
- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/operations.md`
- `docs/postgresql-backups.md`
- `docs/plans/postgresql-migration/work-log.md`

### Commands Run

```bash
pnpm install
pnpm --filter postgres-backup check
pnpm --filter postgres-backup test
pnpm check
pnpm typecheck
pnpm test
pnpm --filter web check
docker build --file packages/postgres-backup/Dockerfile --tag finnn-postgres-backup:test .
docker run --rm --entrypoint sh finnn-postgres-backup:test -c 'node --version && age --version && pg_dump --version && id'
git diff --check
```

### Results

- Backup Biome checks pass and its 11 unit tests pass across configuration, streaming/checksum behavior, hard timeout
  cleanup, credential isolation/redaction, object metadata, full re-download verification, and manifest-last ordering.
- API and web type checks pass. The full test command passes with 291 API tests, 180 web tests, and 11 backup tests;
  four opt-in PostgreSQL API tests remain skipped in the normal run.
- The backup Docker image builds successfully. Its final non-root runtime reports Node 22.23.1, age 1.1.1, and
  PostgreSQL `pg_dump` 18.4; production dependencies load and an in-container age encrypt/decrypt smoke test passes.
- API generated-contract drift verification and the web package check pass. The root `pnpm check` then stops only because
  API Biome scans an existing gitignored local operational snapshot under `packages/api/backups`; those recovery files
  were preserved and not reformatted.
- Final whitespace checks pass, and generated OpenAPI/web-client verification left no worktree changes.
- External Railway acceptance produced the completed encrypted object
  `finnn/production/daily/2026/07/29/finnn-20260729T115837535Z.dump.age` (155,426 bytes), passed payload and source
  checksum verification, and restored successfully into an isolated PostgreSQL 18 database. The restored database had
  24 public tables, one applied migration, and the expected core counts: 5 users, 3 workspaces, 18 accounts, 913
  transactions, and 52 debts.
- Deployed `postgres-backup-cron` to the Production environment in Railway EU West with 0.5 vCPU, 500 MB memory,
  `restartPolicyType: NEVER`, no public domain, and the daily `0 2 * * *` UTC schedule. The first Railway-side manual
  execution used the private PostgreSQL hostname and completed the verified payload/manifest pair
  `finnn/production/daily/2026/07/29/finnn-20260729T120917846Z.dump.age`.
- Restored the Production PostgreSQL effective resource override to the approved 1 vCPU / 1 GB after live inspection
  found that it had drifted back to the workspace maximum. EU West placement and Serverless-disabled state were
  preserved.
- Stopped the stale `mongodb-prod` deployment after successful PostgreSQL backup and restore validation. The Railway
  service and ready `mongodb-volume-zdog` persistent volume remain intact for the approved observation period.
- Removed disposable migration logs, temporary Railway links, the local backup test image, the replaceable local backup
  role password, and local/DEV forensic exports. The authoritative pre-repair and final frozen Production MongoDB
  exports remain local with directory mode `0700` and file mode `0600`; backend and frontend `.env` files were also
  restricted to `0600`.

### Decisions

- Keep the private age identity out of Railway; the cron receives only `BACKUP_AGE_RECIPIENT`.
- Match the production PostgreSQL 18 server major in the backup image.
- Treat only a verified payload with a matching completion manifest as a completed backup.
- Default to virtual-host S3 addressing and expose path-style addressing only as an explicit option.

### Blockers / Follow-ups

- Add independent failure/freshness alerting outside Railway so a missing successful manifest for more than 36 hours
  is reported even if the cron service itself is unavailable.
- Keep the first 90 days of completed backups, then review and implement the documented manual/client-side pruning
  procedure.
- Repeat the isolated restore rehearsal at least quarterly and after any age identity rotation or risky schema change.

## 2026-07-29 - Migration kickoff

### Scope

- Assessed the current Prisma schema, MongoDB-specific code, financial transaction patterns, analytics access patterns,
  tests, and deployment workflow.
- Created the dedicated `feat/postgresql-migration` branch.
- Defined a compatibility-first migration that preserves IDs and money strings during cutover.

### Files Changed

- `docs/plans/postgresql-migration/prompt.md`
- `docs/plans/postgresql-migration/README.md`
- `docs/plans/postgresql-migration/work-log.md`

### Commands Run

```bash
git switch -c feat/postgresql-migration
```

### Results

- The repository was clean on `develop` before the branch was created.
- The migration is ready for parallel schema, runtime, ETL, and concurrency work.

### Decisions

- Preserve legacy ObjectId strings in PostgreSQL text columns.
- Keep persisted money values as strings for the initial cutover.
- Prefer a rehearsed maintenance window over custom CDC for a modest dataset.
- Treat concurrency safety and real PostgreSQL integration coverage as cutover blockers.

### Subagent Contributions

- Repository analysis covered schema portability, MongoDB-specific runtime dependencies, and migration/cutover risks.

### Blockers / Follow-ups

- Production data volume and acceptable maintenance window still need confirmation before the production runbook is
  finalized.

## 2026-07-29 - MongoDB-to-PostgreSQL ETL tooling

### Scope

- Added a direct migration command using `MONGODB_SOURCE_URL` as the MongoDB source and Prisma `DATABASE_URL` as the
  PostgreSQL target.
- Added source preflight validation for schema fields, legacy ObjectIds, dates, JSON, arrays, money strings, unique keys,
  foreign-key references, account balances, and debt ledger totals.
- Added resumable batch insertion in foreign-key dependency order and exact target count/content-digest validation.
- Added production-environment blocking and a MongoDB snapshot transaction with an explicit source-freeze fallback.

### Files Changed

- `packages/api/scripts/mongo-to-postgres-models.ts`
- `packages/api/scripts/mongo-to-postgres.ts`
- `packages/api/test/mongo-to-postgres.test.ts`
- `packages/api/package.json`
- `package.json`
- `docs/plans/postgresql-migration/README.md`
- `docs/plans/postgresql-migration/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/mongo-to-postgres.test.ts
pnpm --filter api typecheck
pnpm --filter api check
pnpm --filter api test
pnpm --filter api exec biome check scripts/mongo-to-postgres-models.ts scripts/mongo-to-postgres.ts \
  test/mongo-to-postgres.test.ts --error-on-warnings
```

### Results

- Legacy ObjectId values are copied unchanged as lowercase 24-character text IDs.
- A retry is accepted only when PostgreSQL is empty or contains an unchanged subset of source rows.
- Linked debt transactions are excluded from account-balance deltas because their linked payment transaction carries the
  balance effect; all debt transactions still contribute to debt amount/remaining validation.
- Debt rows without ledger transactions produce a warning because their totals cannot be independently reconstructed.

### Blockers / Follow-ups

- Rehearse with representative data to confirm the snapshot transaction fits the configured MongoDB transaction lifetime.
- Keep all MongoDB writers stopped when using `--no-snapshot`.

## 2026-07-29 - PostgreSQL infrastructure and operations

### Scope

- Replaced the local MongoDB replica-set service with PostgreSQL 17 and a readiness health check.
- Replaced `db push` development/deployment commands with explicit Prisma migration create, deploy, and status commands.
- Added the one-time MongoDB-to-PostgreSQL importer passthrough without changing ETL implementation.
- Updated Railway pre-deploy, environment examples, repository guidance, development setup, backup/restore operations,
  connection pooling, production cutover, and rollback-boundary documentation.

### Files Changed

- `docker-compose.yml`
- `package.json`
- `packages/api/package.json`
- `packages/api/.env.example`
- `packages/api/railway.json`
- `packages/api/test/app.e2e.test.ts`
- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/development.md`
- `docs/operations.md`
- `docs/domain-model.md`
- `docs/ai-contributor-guide.md`
- `docs/category-icons.md`
- `docs/plans/postgresql-migration/work-log.md`

### Commands Run

```bash
docker compose config
pnpm --filter api run
pnpm run
pnpm --filter api db:generate
pnpm db:migrate:dev --help
pnpm db:migrate:status --help
pnpm --filter api test test/app.e2e.test.ts
pnpm --filter api check
pnpm --filter api typecheck
pnpm exec biome check AGENTS.md README.md docker-compose.yml docs/README.md docs/ai-contributor-guide.md docs/category-icons.md docs/development.md docs/domain-model.md docs/operations.md package.json packages/api/package.json packages/api/railway.json
git diff --check
```

### Results

- Docker Compose renders a valid PostgreSQL service, persistent volume, port mapping, and health check.
- Prisma Client generation succeeds against the converted PostgreSQL schema.
- The Railway deployment configuration test passes (6 tests).
- Migration command forwarding was verified; root scripts pass flags directly, for example
  `pnpm db:migrate:dev --name <name>`.
- An initial help probe exposed that an existing local `packages/api/.env` needs the newly documented `DIRECT_URL`.
- Targeted Biome and whitespace checks passed. Full repository verification remains part of final integration because
  schema, ETL, and transaction work proceeded in parallel.
- The first package-wide API check caught formatting in a parallel PostgreSQL integration test; after that parallel fix,
  the API check passed across 131 files.
- API type checking passed with the generated PostgreSQL Prisma Client.
- A final rerun still passed Compose validation, type checking, and the Railway config test; the package-wide check then
  caught a new formatting-only issue in a concurrently edited scheduled-payment test, reported for final integration.

### Decisions

- Use `DATABASE_URL` for runtime traffic and `DIRECT_URL` for Prisma Migrate/direct administrative access.
- Use committed `prisma migrate deploy` migrations in Railway; never use `db push` in shared environments.
- Use PostgreSQL-native `pg_dump`/`pg_restore` and require a restore rehearsal.
- Prefer a write-frozen maintenance cutover. Reopening PostgreSQL writes is the explicit lossless-rollback boundary
  unless reverse replication exists.
- Keep MongoDB tools and terminology only in clearly labeled one-time migration notes.

### Blockers / Follow-ups

- Confirm the managed PostgreSQL direct/pooled endpoint topology and per-environment connection budget.
- Confirm the production maintenance duration and immutable MongoDB snapshot retention period.
- Run the final full verification suite after the ETL and transaction branches finish writing shared files.

## 2026-07-29 - Schema, concurrency, and final integration

### Scope

- Converted all Prisma models from MongoDB ObjectIds to PostgreSQL text IDs while preserving legacy IDs during ETL.
- Added the initial reviewed PostgreSQL SQL migration, explicit referential actions, timezone-aware timestamps, JSONB,
  arrays, unique constraints, and foreign-key indexes.
- Replaced MongoDB-specific nullable filters and ID validation in runtime code.
- Added Serializable transaction retries for balance-changing account, transaction, transfer, and debt operations.
- Added unit coverage for transaction retries and real PostgreSQL coverage for constraints, cascades, JSON/arrays/time,
  and concurrent balance updates.
- Renamed the retained source backup utilities to explicit `db:mongo:*` commands and made them use
  `MONGODB_SOURCE_URL` so they cannot consume the PostgreSQL runtime URL accidentally.
- Regenerated OpenAPI and the Orval client after widening persisted-ID validation to legacy ObjectIds and new CUIDs.

### Files Changed

- `packages/api/prisma/schema.prisma`
- `packages/api/prisma/migrations/20260729000000_init_postgresql/migration.sql`
- `packages/api/src/prisma/serializable-transaction.ts`
- `packages/api/src/accounts/accounts.service.ts`
- `packages/api/src/transactions/transactions.service.ts`
- `packages/api/src/debts/debts.service.ts`
- `packages/api/src/auth/auth.service.ts`
- `packages/api/src/categories/categories.dto.ts`
- `packages/api/src/categories/categories.service.ts`
- `packages/api/src/scheduled-payments/scheduled-payments-notification.service.ts`
- `packages/api/test/postgres.integration.test.ts`
- `packages/api/test/serializable-transaction.test.ts`
- `packages/api/openapi.json`
- `packages/web/src/shared/api/generated`

### Commands Run

```bash
docker compose up -d postgres
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:generate
pnpm api:generate
pnpm typecheck
pnpm check
pnpm test
POSTGRES_TEST_DATABASE_URL="postgresql://.../finnn_test?schema=public" \
  pnpm --filter api exec vitest run test/postgres.integration.test.ts
pnpm build
```

### Results

- The committed SQL migration applies cleanly to empty local `finnn` and `finnn_test` PostgreSQL databases.
- Prisma reports no schema drift between the migrated test database and `schema.prisma`.
- API tests pass: 280 passed and 4 PostgreSQL opt-in tests skipped in the normal run.
- Web tests pass: 180 passed.
- The opt-in real PostgreSQL test passes 4/4, including two concurrent balance changes producing the expected balance.
- Prisma generation, API contract drift checks, API/web type checks, Biome checks, and production builds pass.

### Decisions

- Keep money persisted as strings for this cutover; native PostgreSQL numeric storage remains a separate follow-up.
- Keep the MongoDB driver and explicitly named source tools until production migration and rollback retention finish.
- Do not remove or mutate the existing local MongoDB container as part of the PostgreSQL implementation.

### Blockers / Follow-ups

- Run the ETL dry run and full rehearsal against a representative MongoDB snapshot before scheduling production cutover.
- Confirm Railway direct/pooled URLs and the connection budget for every environment.
- Agree on the write-freeze duration and immutable MongoDB snapshot retention period.

## 2026-07-29 - Local data migration rehearsal

### Scope

- Verified that the local MongoDB source was healthy, PostgreSQL was healthy, and no local API/web writers were running.
- Exported an immutable MongoDB backup before touching the PostgreSQL target.
- Created the isolated `finnn_pg_local` PostgreSQL database and applied the committed SQL migration.
- Ran a strict source dry run, classified legacy data deliberately, imported the data, and repeated dry-run validation
  against the populated target.
- Switched the ignored local API `.env` to PostgreSQL and performed database-count, build, startup, health, unauthenticated
  session, and exchange-rate smoke checks.

### Results

- MongoDB backup: 808 documents across 22 existing collections.
- PostgreSQL target: 803 rows across the 23 Prisma models; the five omitted documents are expired orphan auth sessions.
- Every imported model passed exact row-count and SHA-256 content-digest comparison.
- Retired `workspaces.icon`, `category_icon_assets.tags`, `categories.color`, and `debts.accountId` fields were omitted only
  after validating their expected legacy shapes. Legacy debt account links also matched their `created` ledger entries.
- One stored account balance differed from ledger reconstruction by `339.78`. The stored value was preserved during
  import. The user chose to treat this as a local-data issue, repair only the local PostgreSQL copy, and defer any
  debt-write-off runtime change unless the problem is reproduced outside local data.
- The NestJS API started successfully against PostgreSQL; `/health`, `/auth/session`, and `/exchange-rates/today` returned
  successful responses.

### Backup And Target

- Backup: `backups/pre-postgresql-local-20260729`
- PostgreSQL database: `finnn_pg_local`

### Follow-ups

- The user approved a separate local PostgreSQL repair for the historical `339.78` discrepancy. The account balance was
  atomically changed from `12005` to `11665.22` only after verifying the expected account, database, and prior balance;
  a ledger recomputation now matches `11665.22`. MongoDB and the immutable pre-migration backup were not modified.
- Keep the debt-write-off runtime path unchanged for now. Reopen the investigation if DEV or production validation
  reports a balance mismatch.
- A later audit proved that the `339.78` difference came from the ETL validator counting the payment side of a linked
  debt write-off while omitting its equal and opposite debt-transaction side. The immutable MongoDB backup value
  `12005` was correct. The local PostgreSQL account was atomically restored from `11665.22` to `12005` after validating
  the exact linked pair; runtime debt behavior remained unchanged.

## 2026-07-29 - DEV cutover

### Scope

- Confirmed that Railway DEV deploys the API from `develop` and that production uses a separate environment and MongoDB
  service.
- Created a dedicated Railway PostgreSQL service, restored the original EU West placement for API, PostgreSQL, and the
  exchange-rate cron, and kept the DEV MongoDB service and volume intact.
- Stopped the DEV API during the final export and import, retained the MongoDB runtime URL separately for rollback, and
  switched API `DATABASE_URL` and `DIRECT_URL` to the PostgreSQL service reference.
- Applied the committed Prisma migration, ran the ETL dry run, imported the valid source data, and repeated full
  count/digest validation before and after the PostgreSQL volume region move.
- Deployed the PostgreSQL-backed API and ran health, unauthenticated-session, and database-backed exchange-rate smoke
  checks.

### Results

- MongoDB backup: 529 documents across 22 collections.
- PostgreSQL target: 528 rows across 23 migration models; one expired orphan auth session was intentionally omitted.
- All populated and empty models passed exact row-count and SHA-256 content-digest comparison after import.
- The 49 preflight warnings were expected and reviewed: 47 legacy transactions defaulted missing `createdByAi` to
  `false`, one validated legacy `debts.accountId` field was omitted, and one expired orphan auth session was skipped.
- DEV reported no account-balance or debt-ledger mismatch, so no data repair and no debt-write-off runtime change were
  applied.
- Railway pre-deploy reported no pending migrations, NestJS started successfully, and `/health`, `/auth/session`, and
  `/exchange-rates/today` returned HTTP 200 against PostgreSQL.
- The DEV PostgreSQL replica is capped at `0.5` vCPU and `500 MB`, has Serverless enabled, and remains colocated with the
  API in Railway EU West.
- The exchange-rate cron previously had no deployment snapshot, so its staged EU-region change could not redeploy. A
  local source snapshot was deployed successfully, the cron remained scheduled at `30 8 * * *`, and the redundant
  failed staged patch was cleared after the EU configuration was applied.

### Backup And Rollback Boundary

- Backup: `packages/api/backups/pre-postgresql-dev-20260729T004250Z`
- The DEV MongoDB service and its volume remain available and unchanged from the migration workflow.
- Once DEV accepts PostgreSQL writes, MongoDB is stale. Roll back by forward-fixing PostgreSQL or restoring PostgreSQL;
  do not silently switch back to MongoDB and discard newer writes.

## 2026-07-29 - Production preflight and legacy repair

### Scope

- Created the Production Railway PostgreSQL service in EU West with a persistent volume, `1` vCPU, `1 GB` memory, and
  Serverless disabled, while leaving the MongoDB-backed API online.
- Applied the committed SQL migration to the empty target and ran repeated read-only MongoDB snapshot dry runs.
- Extended the ETL audit for removed `whats_new_status` documents, retired account metadata, nullable legacy debt links,
  pre-ledger debts, linked write-off pairs, and unreachable orphan accounts.
- Took a full MongoDB export before repairing one reviewed historical debt transaction.

### Results

- Pre-repair backup: `backups/pre-production-debt-repair-20260729T103650Z`, containing 1,867 documents across 23
  collections. Manifest SHA-256: `fbf39aa3d6dc90799914c87c369d54acadfa14e42d1deeb2a6a57cc6cb8bd75b`.
- Debt transaction `69989a69431eada097a4b6df` had an incorrect debt-side amount `14000` with account-side amount
  `580`. A guarded MongoDB transaction changed only the debt-side amount to `200`, which makes total repayments
  `1158.68` and exactly reproduces the reviewed stored remaining amount `13341.32` and `open` status.
- The final live dry run reports 1,853 target rows and no issues. The 14 intentionally omitted source documents are
  eight expired or revoked orphan sessions, four ownerless accounts whose workspace and all dependent records are
  missing, and two validated records from the removed `whats_new_status` feature.
- Linked write-off pairs pass exact payment/debt account, workspace, date, type, and account-side amount validation.
  No active account balance mismatch remains, and no runtime debt behavior was changed.
- Production API remained online and MongoDB-backed throughout preflight. PostgreSQL still contains only the schema;
  the maintenance-window backup, frozen import, variable switch, and deployment remain pending.

## 2026-07-29 - Production cutover

### Scope

- Stopped the Production API before the final MongoDB export and kept the exchange-rate cron from writing during the
  maintenance window.
- Repeated the full ETL audit against the frozen source, imported the reviewed source rows into PostgreSQL, and compared
  every migration model before opening PostgreSQL for writes.
- Switched the Production API `DATABASE_URL` and `DIRECT_URL` to the Railway PostgreSQL service while retaining
  `MONGODB_SOURCE_URL` for audited source access and rollback investigation.
- Merged PR `#10` with merge commit `0998e28d5fc665fc9e80fe46b5db1208e5244cca` and deployed the PostgreSQL-backed
  API from `main`.
- Corrected the Railway exchange-rate cron command so Bash no longer expands JavaScript `${process.env...}`
  expressions before Node.js starts.

### Results

- Final frozen backup: `backups/pre-postgresql-production-20260729T104642Z`, containing 1,868 documents across 23
  collections. Manifest SHA-256: `df7216635e38ab8bce0732025f221273e9e37ace2a894f2eae32e3205c957be8`.
- The frozen source and imported target both contained 1,854 retained rows across 23 migration models. Exact count and
  content-digest validation passed with zero mismatches before PostgreSQL writes were enabled.
- The same 14 reviewed documents were intentionally omitted: eight expired or revoked orphan sessions, four ownerless
  accounts with missing workspaces and no dependent records, and two retired `whats_new_status` records.
- Railway API deployment `3cd655a5-66a3-4f17-8c20-504b90ee5b7e` completed successfully. Its service manifest runs
  `pnpm --filter api db:migrate:deploy`, uses `/health`, keeps one EU West replica, and disables Serverless sleep.
- `/health`, `/auth/session`, and `/exchange-rates/today` returned HTTP 200 after the cutover. The unauthenticated session
  response remained `authenticated: false`, and the exchange-rate endpoint returned the expected USD, EUR, and RUB
  rates.
- The corrected Production cron command was executed with the Production variables and saved all three exchange rates.
  Cron snapshot `28d55b6a-403f-4eba-9b9f-8288332b92ae` is successful; the schedule remains `30 8 * * *`, with the next
  run at `2026-07-30T08:30:00Z`.
- Production PostgreSQL deployment `60d96bdb-3cc2-43d0-bdeb-a6353cc6a043` is healthy with one EU West replica, a ready
  persistent volume, a `1` vCPU / `1 GB` override, and Serverless disabled.

### Backup And Rollback Boundary

- The Production MongoDB service, volume, pre-repair export, and final frozen export remain intact. Do not delete them
  until the PostgreSQL retention window is explicitly approved.
- Production accepted PostgreSQL writes when the API and the manual exchange-rate cron check completed. MongoDB is now
  stale, so a lossless rollback requires replaying PostgreSQL writes or restoring from an appropriate PostgreSQL backup;
  switching the API URL directly back to MongoDB would discard post-cutover writes.
- Railway volume-backup reads are available, but both the backup-create and backup-schedule mutations returned
  `Not Authorized`. No Railway PostgreSQL volume backup or automatic daily/weekly/monthly schedule was created. Confirm
  the Railway plan or workspace permission in the UI, then create and restore-test a PostgreSQL backup before retiring
  MongoDB.
