# Finnn Documentation

Finnn is a personal and shared finance tracker. It supports workspaces, shared members, accounts, categories, payments, transfers, debts, analytics, exchange rates, MongoDB import/export, and a constrained PWA service worker.

This documentation is written for two audiences:

- Developers who need to run, change, test, and deploy the project.
- AI coding agents that need a fast, reliable map of the codebase before making edits.

## Start Here

- [Development](./development.md) - local setup, environment variables, commands, database workflow, and verification.
- [Architecture](./architecture.md) - directory map, request/data flow, feature module conventions, and cross-cutting helpers.
- [Domain Model](./domain-model.md) - core entities, money invariants, workspaces, transactions, transfers, debts, exchange rates, and PWA cache boundaries.
- [Operations](./operations.md) - deployment, cron, MongoDB import/export, email, service worker, and production checks.
- [AI Contributor Guide](./ai-contributor-guide.md) - how Codex or another AI agent should approach changes in this repo.

## Project At A Glance

- Framework: Next.js App Router frontend and NestJS API, both in TypeScript.
- Data: Prisma ORM with MongoDB in `packages/api`.
- Auth: API-owned HTTP-only cookie sessions.
- Contract: NestJS OpenAPI with Orval-generated web clients.
- Client data: TanStack Query with server-side prefetch and hydration.
- UI: Tailwind CSS, local UI primitives, lucide-react, Recharts.
- Validation: NestJS DTO validation in `packages/api` plus frontend Zod schemas in `packages/web/src/shared/lib/validations`.
- Tests: Vitest plus static UI structure tests in package-local `scripts`.
- Formatting/linting: Biome.
- Deployment: `packages/api` on Railway or equivalent backend hosting; `packages/web` as the frontend deployment.

## Primary User Flows

1. A user registers, verifies email, signs in, and creates or joins a workspace.
2. A workspace owner or member creates accounts and categories.
3. A user records income, expense, transfer, or debt activity.
4. API domain logic updates balances transactionally in MongoDB.
5. The dashboard and analytics views prefetch data on the server and hydrate client components.
6. The protected API cron endpoint fetches and stores exchange rates for conversion-aware analytics and UI display.

## Important Invariants

- Money amounts are stored as strings and should be manipulated only through money/domain helpers.
- Workspace access must be checked on every server-side read or mutation that depends on workspace data.
- Balance-changing operations should be transactional.
- Query keys must come from `packages/web/src/shared/lib/query-keys.ts`.
- Client cache invalidation should use centralized query keys and domain invalidation helpers.
- The service worker must not cache financial app documents, API responses, or dashboard data routes.

## Fast Verification

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

For narrow changes, run the most relevant targeted test first, then broaden verification if the change touches shared domain rules, data access, App Router behavior, or PWA caching.
