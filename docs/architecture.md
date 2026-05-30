# Architecture

## High-Level Shape

Finnn is a `pnpm` monorepo with a Next.js App Router frontend in `packages/web` and a NestJS API in `packages/api`.

```text
packages/web/src/app       App Router pages, layouts, and providers
packages/web/src/modules   Feature UI, frontend hooks, and API-backed adapters
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

- `packages/web/src/app/(dashboard)/dashboard/page.tsx`
- `packages/web/src/app/(dashboard)/analytics/page.tsx`
- `packages/web/src/app/(dashboard)/debts/page.tsx`

## Feature Modules

Frontend feature modules live under `packages/web/src/modules`.

- `accounts` - account CRUD, archive/delete behavior, ownership visibility, cards, ordering, settings.
- `analytics` - analytics aggregation, date range helpers, chart data.
- `auth` - registration, verification, user settings.
- `categories` - income/expense category CRUD and ordering.
- `currency` - exchange-rate UI and generated API client usage.
- `debts` - debt creation, closing, additions, edits, debt transactions, debt UI.
- `transactions` - payment transactions, transfers, combined transaction feed, filtering.
- `workspace` - workspace CRUD, members, roles, invites, workspace selection.

The typical frontend module shape is:

```text
module/
  module.api.ts           Pure generated-client adapter when response shaping is needed
  module.types.ts         Shared module types
  module.constants.ts     Domain constants
  components/             Client/server UI for the feature
```

Not every module has every file; follow the local pattern already used by that module.

Backend domain modules live under `packages/api/src`. They own controllers, DTOs, guards, Prisma access, email, cron, OpenAPI metadata, and finance transaction rules.

## API Adapter Pattern

Frontend API adapters are pure TypeScript helpers that call generated Orval client functions and return structured action results where existing UI code expects them:

- `ok(data)` for data responses.
- `success()` for successful commands without data.
- `fail(error, fallback)` for normalized errors.

Prefer direct generated client functions when no response normalization is needed. Use pure `*.api.ts` helpers when a module must preserve UI-facing shapes such as `Date` instances, nullable owner/account fields, or `ActionResult` wrappers. New backend logic should live in `packages/api`.

Shared helpers:

- `packages/web/src/shared/lib/action-result.ts`
- `packages/web/src/shared/lib/api-session.ts`
- `packages/web/src/shared/lib/query-invalidation.ts`
- `packages/web/src/shared/lib/validations`

Backend mutation flow:

1. Authenticate with API auth guards.
2. Check workspace access with `WorkspaceAccessGuard` and role metadata when needed.
3. Validate inputs with NestJS DTOs.
4. Execute Prisma reads/writes in API services.
5. Keep balance-changing operations inside `prisma.$transaction`.
6. Return explicit DTO response shapes documented in OpenAPI.

## Transactional Application Layer

Balance-sensitive persisted logic lives in API services:

- `packages/api/src/transactions/transactions.service.ts`
- `packages/api/src/debts/debts.service.ts`

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
- `GET /auth/telegram/start` starts Telegram OIDC login with PKCE.
- `GET /auth/telegram/callback` validates Telegram state, nonce, and ID token before issuing the same session cookie.
- `GET /auth/telegram/link/start` starts Telegram account linking for an authenticated user.
- `DELETE /auth/telegram/link` unlinks Telegram when another viable sign-in method remains.
- `POST /auth/logout` clears and invalidates the session.
- `GET /auth/session` returns the current API session.
- `PATCH /auth/user` updates user settings.

`packages/web` calls these endpoints through generated Orval client functions with credentials included. Server session access is cached through `packages/web/src/shared/lib/api-session.ts`, which forwards the API session cookie to the backend session endpoint.

Telegram redirects are navigated in the browser with explicit API URLs because the API endpoints intentionally issue
cross-site redirects. Telegram identities are stored in `AuthIdentity`; the returned session user includes nullable
email plus Telegram link status for UI display and settings.

Workspace authorization is handled in the API by `WorkspaceAccessGuard` and `WorkspaceRoles`:

- Owners have the highest effective role.
- Members are resolved through `WorkspaceMember`.
- Optional role requirements compare role rank.

## Client Data And Cache

TanStack Query keys are centralized in `packages/web/src/shared/lib/query-keys.ts`.

Server pages prefetch data and dehydrate it. Client components consume the same keys to avoid duplicate loading and keep cache behavior predictable.

Optimistic updates are centralized in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`. Use these helpers when changing account, category, debt, transaction, workspace, or user references in client cache.

## UI System

Reusable UI primitives live in `packages/web/src/shared/ui`.

Reusable composed components live in `packages/web/src/shared/components`.

Prefer existing primitives for dialogs, sheets, selects, popovers, buttons, cards, tables, forms, and date controls. Feature-specific components should stay inside the relevant `packages/web/src/modules/*/components` directory.

## Invalidation

Client mutations use TanStack Query invalidation and optimistic workspace cache helpers. Keep invalidation domain-based through `invalidateWorkspaceDomains()` and the centralized query keys instead of scattering raw query keys through components.
