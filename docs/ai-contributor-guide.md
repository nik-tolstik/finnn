# AI Contributor Guide

This guide is for Codex or another AI coding agent working in this repository.

## First Context Pass

Before editing, inspect:

```bash
git status --short --branch
find src -maxdepth 3 -type d | sort
sed -n '1,220p' package.json
sed -n '1,260p' prisma/schema.prisma
sed -n '1,220p' AGENTS.md
```

Then inspect the narrow module involved in the task.

For framework or library behavior that may have changed, use Context7. Next.js App Router, Prisma MongoDB, NextAuth, TanStack Query, and Tailwind changes are good candidates for documentation lookup.

## Decision Rules

- Preserve the existing feature-module structure.
- Put server action boundaries in `*.service.ts`.
- Put complex transactional domain logic in `*.application.ts`.
- Put feature UI inside `src/modules/<feature>/components`.
- Put reusable primitives in `src/shared/ui` only when they are genuinely reusable.
- Put cross-feature helpers in `src/shared/lib` or `src/shared/utils` based on whether they are domain/application helpers or low-level utilities.
- Update `docs/` when changing setup, architecture, domain rules, operations, or AI-facing conventions.

## Server Mutation Checklist

For a new or changed server mutation:

1. Mark the file with `"use server"` when it exports server actions.
2. Validate input with an existing or new Zod schema from `src/shared/lib/validations`.
3. Use `requireUserId` or `requireWorkspaceAccess`.
4. Keep balance-changing writes inside `prisma.$transaction`.
5. Use money and balance helpers rather than raw arithmetic.
6. Return `ok`, `success`, or `fail`.
7. Revalidate affected routes through `revalidate-app-routes.ts`.
8. Add or update focused tests for domain rules and failure cases.

## Client Data Checklist

For a client view or mutation:

- Use query keys from `src/shared/lib/query-keys.ts`.
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
- Run relevant tests around `balance-domain`, transaction service, debt service, and optimistic workspace updates.

## Tests To Consider

Focused tests:

```bash
pnpm test src/shared/lib/balance-domain.test.ts
pnpm test src/modules/transactions/transaction.service.test.ts
pnpm test src/modules/debts/debt.service.test.ts
pnpm test src/shared/lib/optimistic-workspace-updates.test.ts
pnpm test src/shared/lib/service-worker-cache-policy.test.ts
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
