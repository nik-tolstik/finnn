# Finnn Documentation

Finnn is a personal and shared finance tracker. It supports workspaces, shared members, accounts, categories, payments, transfers, debts, analytics, exchange rates, MongoDB import/export, and a constrained PWA service worker.

This documentation is written for two audiences:

- Developers who need to run, change, test, and deploy the project.
- AI coding agents that need a fast, reliable map of the codebase before making edits.

## Start Here

- [Development](./development.md) - local setup, environment variables, commands, database workflow, and verification.
- [Architecture](./architecture.md) - directory map, request/data flow, feature module conventions, and cross-cutting helpers.
- [Backend Migration](./backend-migration.md) - planned NestJS API package, web package, Orval contract workflow, and Railway deployment steps.
- [Domain Model](./domain-model.md) - core entities, money invariants, workspaces, transactions, transfers, debts, exchange rates, and PWA cache boundaries.
- [Operations](./operations.md) - Vercel, cron, MongoDB import/export, email, service worker, and production checks.
- [AI Contributor Guide](./ai-contributor-guide.md) - how Codex or another AI agent should approach changes in this repo.

## Project At A Glance

- Framework: Next.js App Router, React, TypeScript.
- Data: Prisma ORM with MongoDB.
- Auth: NextAuth credentials provider with Prisma Adapter and JWT sessions.
- Client data: TanStack Query with server-side prefetch and hydration.
- UI: Tailwind CSS, local UI primitives, lucide-react, Recharts.
- Validation: Zod schemas in `src/shared/lib/validations`.
- Tests: Vitest plus static UI structure tests in `scripts`.
- Formatting/linting: Biome.
- Deployment: Vercel with a daily cron job for exchange rates.

## Primary User Flows

1. A user registers, verifies email, signs in, and creates or joins a workspace.
2. A workspace owner or member creates accounts and categories.
3. A user records income, expense, transfer, or debt activity.
4. Server-side application logic updates balances transactionally in MongoDB.
5. The dashboard and analytics views prefetch data on the server and hydrate client components.
6. Exchange rates are fetched and stored for conversion-aware analytics and UI display.

## Important Invariants

- Money amounts are stored as strings and should be manipulated only through money/domain helpers.
- Workspace access must be checked on every server-side read or mutation that depends on workspace data.
- Balance-changing operations should be transactional.
- Query keys must come from `src/shared/lib/query-keys.ts`.
- Route revalidation should use `src/shared/lib/revalidate-app-routes.ts`.
- The service worker must not cache financial app documents, API responses, server action responses, or dashboard data routes.

## Fast Verification

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

For narrow changes, run the most relevant targeted test first, then broaden verification if the change touches shared domain rules, data access, App Router behavior, or PWA caching.
