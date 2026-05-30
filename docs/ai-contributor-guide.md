# AI Contributor Guide

This guide is for Codex or another AI coding agent working in this repository.

## First Context Pass

Before editing, inspect:

```bash
git status --short --branch
find packages -maxdepth 3 -type d | sort
sed -n '1,220p' package.json
sed -n '1,260p' packages/api/prisma/schema.prisma
sed -n '1,220p' AGENTS.md
```

Then inspect the narrow module involved in the task.

For framework or library behavior that may have changed, use Context7. Next.js App Router, NestJS, Prisma MongoDB, TanStack Query, Orval, and Tailwind changes are good candidates for documentation lookup.

## Decision Rules

- Preserve the existing package and feature-module structure.
- Put new backend behavior in `packages/api` NestJS modules.
- Put frontend response-shaping helpers in pure `packages/web/src/modules/<feature>/<feature>.api.ts` files when generated client functions need adaptation.
- Put complex transactional domain logic in API services using `prisma.$transaction`.
- Put feature UI inside `packages/web/src/modules/<feature>/components`.
- Put reusable primitives in `packages/web/src/shared/ui` only when they are genuinely reusable.
- Put cross-feature frontend helpers in `packages/web/src/shared/lib` or `packages/web/src/shared/utils` based on whether they are domain/application helpers or low-level utilities.
- Update `docs/` when changing setup, architecture, domain rules, operations, or AI-facing conventions.

## Backend Mutation Checklist

For a new or changed API mutation:

1. Validate input with NestJS DTOs and global validation.
2. Use auth guards and `WorkspaceAccessGuard` for protected workspace data.
3. Keep balance-changing writes inside `prisma.$transaction`.
4. Use money and balance helpers rather than raw arithmetic.
5. Return explicit DTO response shapes and update Swagger metadata.
6. Run `pnpm api:generate` after contract changes.
7. Add or update focused API tests for domain rules and failure cases.
8. Update frontend generated-client usage or adapters when response shapes change.

## Client Data Checklist

For a client view or mutation:

- Use query keys from `packages/web/src/shared/lib/query-keys.ts`.
- Reuse existing optimistic update helpers where possible.
- Keep server-prefetched query data and client query keys aligned.
- Avoid duplicating workspace selection logic; follow the page-level patterns in dashboard and analytics routes.
- Keep filters represented in URL search params when the existing feature does so.

## Money And Balance Checklist

When changing accounts, transactions, transfers, debts, or analytics:

- Treat persisted amounts as strings.
- Use `compareMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, or `divideMoney`.
- Use `balance-domain.ts` for account balance effects.
- Check insufficient-balance paths.
- Check edit/delete reversal paths.
- Check cross-account and cross-currency transfer behavior.
- Run relevant tests around `balance-domain`, transaction API adapters, debt API adapters, and optimistic workspace updates.

## Tests To Consider

Focused tests:

```bash
pnpm --filter web test src/shared/lib/balance-domain.test.ts
pnpm --filter web test src/modules/transactions/transaction.api.test.ts
pnpm --filter web test src/modules/debts/debt.api.test.ts
pnpm --filter web test src/shared/lib/optimistic-workspace-updates.test.ts
pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts
```

Full checks:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

## Documentation Style

Good project docs for this repo should include:

- Exact commands.
- Exact file paths.
- Domain invariants.
- Failure modes.
- Verification steps.
- Deployment and env requirements.

Avoid vague claims that are not tied to code, commands, or known behavior.
