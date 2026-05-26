# Architecture

## High-Level Shape

Finnn is migrating to a `pnpm` monorepo with a Next.js App Router frontend in `packages/web` and a NestJS API in `packages/api`.

```text
packages/web/src/app       App Router pages, layouts, and providers
packages/web/src/modules   Feature UI, frontend hooks, and transitional server actions
packages/web/src/shared    Cross-cutting UI, generated API client, lib helpers, utilities
packages/web/public        PWA assets and service worker
packages/api/src           NestJS controllers, services, guards, and modules
packages/api/prisma        Prisma schema and generated client source
packages/api/scripts       Seed, import, and export scripts
docs                       Project documentation
```

## App Router

Route groups:

- `packages/web/src/app/(auth)` contains login, registration, invite acceptance, and email verification pages.
- `packages/web/src/app/(dashboard)` contains authenticated pages and layout.
- `packages/web/src/shared/lib/api-session.ts` reads the API-owned HTTP-only session cookie during server rendering and checks it through `GET /auth/session`.
- `packages/web/src/shared/lib/api-session-client.tsx` provides client session state from the generated API client.
- Exchange-rate reads and cron persistence are owned by `packages/api/src/currency`.

Dashboard pages are server components that load session/workspace context, normalize `workspaceId` search params, prefetch TanStack Query data, and render client content inside `HydrationBoundary`.

Examples:

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/analytics/page.tsx`
- `src/app/(dashboard)/debts/page.tsx`

## Feature Modules

Feature modules live under `src/modules`.

- `accounts` - account CRUD, archive/delete behavior, ownership visibility, cards, ordering, settings.
- `analytics` - analytics aggregation, date range helpers, chart data.
- `auth` - registration, verification, user settings.
- `categories` - income/expense category CRUD and ordering.
- `currency` - external exchange-rate fetching, fallback providers, persisted daily rates.
- `debts` - debt creation, closing, additions, edits, debt transactions, debt UI.
- `transactions` - payment transactions, transfers, combined transaction feed, filtering.
- `workspace` - workspace CRUD, members, roles, invites, workspace selection.

The typical module shape is:

```text
module/
  module.service.ts       Server action boundary and revalidation
  module.application.ts   Transactional business logic when needed
  module.types.ts         Shared module types
  module.constants.ts     Domain constants
  components/             Client/server UI for the feature
```

Not every module has every file; follow the local pattern already used by that module.

## Server Action Pattern

Server-facing service files use `"use server"` and return structured action results:

- `ok(data)` for data responses.
- `success()` for successful commands without data.
- `fail(error, fallback)` for normalized errors.

During the backend migration, modules that have been wired to NestJS may keep a temporary `*.service.ts` adapter that calls generated API client functions and preserves the old `ActionResult` shape for existing UI code. `packages/web/src/modules/workspace/workspace.service.ts` is one such adapter; new backend logic should continue to live in `packages/api`.

Shared helpers:

- `src/shared/lib/action-result.ts`
- `src/shared/lib/server-access.ts`
- `src/shared/lib/revalidate-app-routes.ts`
- `src/shared/lib/validations`

Server mutation flow:

1. Check session and workspace access with `requireUserId` or `requireWorkspaceAccess`.
2. Validate inputs with Zod schemas.
3. Execute Prisma reads/writes.
4. For balance-changing operations, use application-layer transactional helpers.
5. Revalidate affected app routes.
6. Return `ok`, `success`, or `fail`.

## Transactional Application Layer

Balance-sensitive logic lives in application files:

- `src/modules/transactions/transaction.application.ts`
- `src/modules/debts/debt.application.ts`

These files use `prisma.$transaction` to keep domain writes consistent. They also centralize important checks such as:

- Account belongs to the workspace.
- A transaction date is not earlier than the account creation date.
- Expense or transfer amount does not exceed the source account balance.
- Transfer source and destination accounts are different.
- Debt changes keep balances and remaining amounts coherent.

## Auth And Access

Authentication is owned by `packages/api/src/auth`:

- `POST /auth/register` starts email-verified registration.
- `POST /auth/verify-email/:token` verifies pending registrations.
- `POST /auth/login` issues the HTTP-only `finnn_session` cookie.
- `POST /auth/logout` clears and invalidates the session.
- `GET /auth/session` returns the current API session.
- `PATCH /auth/user` updates user settings.

`packages/web` calls these endpoints through generated Orval client functions with credentials included. Server session access is cached through `src/shared/lib/auth-session.ts`, which now delegates to the API session bridge.

Workspace authorization is handled by `requireWorkspaceAccess`:

- Owners have the highest effective role.
- Members are resolved through `WorkspaceMember`.
- Optional role requirements compare role rank.

## Client Data And Cache

TanStack Query keys are centralized in `src/shared/lib/query-keys.ts`.

Server pages prefetch data and dehydrate it. Client components consume the same keys to avoid duplicate loading and keep cache behavior predictable.

Optimistic updates are centralized in `src/shared/lib/optimistic-workspace-updates.ts`. Use these helpers when changing account, category, debt, transaction, workspace, or user references in client cache.

## UI System

Reusable UI primitives live in `src/shared/ui`.

Reusable composed components live in `src/shared/components`.

Prefer existing primitives for dialogs, sheets, selects, popovers, buttons, cards, tables, forms, and date controls. Feature-specific components should stay inside the relevant `src/modules/*/components` directory.

## Invalidation

Route revalidation helpers:

- `revalidateAccountingRoutes()` revalidates dashboard accounting data.
- `revalidateDebtRoutes()` revalidates dashboard and debts data.
- `revalidateWorkspaceRoutes()` revalidates workspace-dependent routes.

Use these helpers instead of scattering raw route names across services.
