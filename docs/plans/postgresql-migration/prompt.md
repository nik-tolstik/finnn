# PostgreSQL Migration Prompt

## Goal

Migrate Finnn from MongoDB to PostgreSQL and prepare a safe production cutover.

## Requirements

- Preserve existing API behavior and frontend contracts.
- Preserve existing document identifiers during the initial migration.
- Preserve exact money behavior; do not combine the database cutover with a money-type rewrite.
- Add database-backed verification for relations, transactions, and concurrent balance updates.
- Provide an idempotent MongoDB-to-PostgreSQL data migration path with explicit validation.
- Replace MongoDB-specific development, deployment, backup, restore, and schema workflows.
- Keep the implementation plan and work log current throughout the migration.

## Non-Goals

- Rewriting the frontend or public API.
- Moving financial calculations to SQL during the initial cutover.
- Replacing legacy IDs with UUIDs.
- Building a zero-downtime CDC pipeline unless production requirements make a maintenance window unacceptable.

## Branch

Use `feat/postgresql-migration`, created from `develop`.

## Verification

```bash
pnpm db:generate
pnpm typecheck
pnpm check
pnpm test
pnpm build
```
