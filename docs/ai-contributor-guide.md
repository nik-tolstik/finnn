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

For framework or library behavior that may have changed, use Context7. Vite, React Router, NestJS, Prisma PostgreSQL, TanStack Query, Orval, and Tailwind changes are good candidates for documentation lookup.

## Specification-First Planning

For a substantial task where the user explicitly asks for formal plan tracking, use the feature folder as the durable source of truth. Otherwise, execute directly without creating plan artifacts. See [`docs/plans/README.md`](./plans/README.md) for the complete eligibility criteria.

1. Read the original request and research the relevant repository areas before asking questions.
2. Identify decisions that code and project documentation cannot answer. Ask only about product behavior, priorities, users, policy, or scope. Do not ask the user to choose files, libraries, API shapes, or other implementation details that the agent can determine.
3. Ask concise, structured questions with a recommended answer and the impact of each choice when the interface supports it. Record resolved answers in `specification.md`.
4. Write or update `specification.md` in plain product language. A reader should understand the desired behavior without knowing the codebase.
5. Create the technical `README.md` only after material product decisions are resolved or an explicit, low-impact assumption is recorded in the specification.
6. Implement autonomously from the technical plan. If a new material product decision appears, pause, explain its impact, and ask the user; otherwise resolve technical details through repository research and record them in the plan or work log.

At the end of the task, verify the implementation against the specification as well as the technical checks. Capture a `docs/solutions` record only when the lesson is reusable by future work, then remove the completed feature-plan folder unless the user asks to retain it.

## Decision Rules

- Use the current checkout and branch unless the user asks for a worktree or pull request.
- Never create a worktree proactively. Create a pull request without a request only when a high-risk operation, such as
  a production data migration, materially needs its isolation, checks, or audit trail; explain that need before acting.
- Agents may use the authenticated Vercel connector, CLI, or API for authorized frontend infrastructure work. Follow
  the exact resource IDs, secret-output rules, Git-owned deployment flow, and protected-deployment verification process
  in `docs/operations.md`; do not auto-link the monorepo or pull environment files into an existing checkout.
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
- Keep route queries aligned with the centralized client query keys.
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
