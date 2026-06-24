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
- `scheduled-payments` - planned payment adapters, status/amount helpers, create and mark-paid UI.
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

`packages/api/src/scheduled-payments` owns planned payment obligations. It exposes workspace-scoped CRUD, pay, skip, snooze, hard delete, and history endpoints plus `GET /cron/scheduled-payment-reminders`. Reminder delivery reuses `EmailService`, `TelegramBotClient`, and the existing `CRON_SECRET` bearer pattern.

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
- `GET /auth/google/start` starts Google OIDC login with PKCE.
- `GET /auth/google/callback` validates Google state, nonce, and ID token before issuing the same session cookie.
- `GET /auth/google/link/start` starts Google account linking for an authenticated user.
- `DELETE /auth/google/link` unlinks Google when another viable sign-in method remains.
- `GET /auth/telegram/start` starts Telegram OIDC login with PKCE.
- `GET /auth/telegram/callback` validates Telegram state, nonce, and ID token before issuing the same session cookie.
- `POST /auth/telegram-mini/session` validates Telegram Mini App `initData` and issues the same session cookie.
- `GET /auth/telegram/link/start` starts Telegram account linking for an authenticated user.
- `DELETE /auth/telegram/link` unlinks Telegram when another viable sign-in method remains.
- `POST /auth/logout` clears and invalidates the session.
- `GET /auth/session` returns the current API session.
- `PATCH /auth/user` updates user settings.
- `POST /auth/email` sends a verification email for a signed-in user adding or changing email.
- `POST /auth/password-reset/request` sends a short-lived reset code when the requested email belongs to a verified user.
- `POST /auth/password-reset/confirm` validates the reset code, updates the password, and revokes active sessions.

`packages/web` calls these endpoints through generated Orval client functions with credentials included. Server session access is cached through `packages/web/src/shared/lib/api-session.ts`, which forwards the API session cookie to the backend session endpoint.

Protected app pages (`/dashboard`, `/analytics`, `/debts`, and `/payments`) use a CSR-first shell. The client `DashboardAuthGate`
confirms the real API session through `GET /auth/session`, shows a global loading screen while the check is pending,
redirects unauthenticated users to `/login`, and redirects authenticated users without verified email to
`/email-required`. API auth guards remain the security boundary for private data and workspace access. Workspace,
account, category, transaction, debt, scheduled-payment, analytics, and invite-acceptance endpoints run `EmailVerifiedGuard` after
`AuthGuard` and return `EMAIL_VERIFICATION_REQUIRED` when the service precondition is not met.

Telegram Mini Apps reuse the same protected routes and UI. `packages/web/src/modules/telegram-mini` runs globally under
the API session provider, calls `Telegram.WebApp.ready()` and `expand()`, sends only raw `Telegram.WebApp.initData` to
the API, refreshes the existing session query after success, and lets `DashboardAuthGate` wait while Mini App bootstrap
is pending.

Telegram redirects are navigated in the browser with explicit API URLs because the API endpoints intentionally issue
cross-site redirects. Telegram identities are stored in `AuthIdentity`; the returned session user includes nullable
email plus Telegram link status for UI display and settings.

Telegram bot finance entry is handled by `packages/api/src/telegram-bot` and `packages/api/src/ai-finance`.
`POST /telegram/webhook` is authenticated with Telegram's `x-telegram-bot-api-secret-token` header and does not use
cookie guards. Bot updates resolve users by `AuthIdentity(provider = "telegram", providerUserId = from.id)`, where
`from.id` is the Telegram sender id rather than the chat id. Linked users can send text, receipt photos, or voice
messages; the API creates an `AiFinanceDraft`, asks for missing workspace/account/date data in Telegram, renders a
preview, and commits only after an explicit callback confirmation. Draft payloads are intermediate JSON and expire by
`TELEGRAM_BOT_DRAFT_TTL_SECONDS`; committed financial records are still created through domain services such as
`TransactionsService`.

Scheduled payment reminder callbacks also enter through the same Telegram webhook. Callback payloads use short
`sp:*` values and update the scheduled payment directly for paid, snooze, and skip actions.

Google uses the same backend-owned redirect model. Existing verified email/password users are auto-linked only when
Google returns a verified email that matches the already verified Finnn email. Google access and refresh tokens are not
stored.

Workspace authorization is handled in the API by `WorkspaceAccessGuard` and `WorkspaceRoles`:

- Owners have the highest effective role.
- Members are resolved through `WorkspaceMember`.
- Optional role requirements compare role rank.

## Client Data And Cache

TanStack Query keys are centralized in `packages/web/src/shared/lib/query-keys.ts`.

Protected app data is loaded through TanStack Query in client components. Cached data should render immediately while
stale data refetches in the background; avoid adding server-side page data dependencies to protected app routes unless a
feature explicitly needs SSR again.

Optimistic updates are centralized in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`. Use these helpers when changing account, category, debt, transaction, workspace, or user references in client cache.

## UI System

Reusable UI primitives live in `packages/web/src/shared/ui`.

Reusable composed components live in `packages/web/src/shared/components`.

Prefer existing primitives for dialogs, sheets, selects, popovers, buttons, cards, tables, forms, and date controls. Feature-specific components should stay inside the relevant `packages/web/src/modules/*/components` directory.

App-facing forms should use the shared form controls instead of native browser controls: `shared/ui/select` for dropdowns, `DatePicker` or `DateTimePicker` for dates, `AccountSelector`/`SelectAccountDialog` for account selection, `UserDisplay`/`UserAvatar` for user choices, and `CURRENCY_OPTIONS` for currency choices.

## Invalidation

Client mutations use TanStack Query invalidation and optimistic workspace cache helpers. Keep invalidation domain-based through `invalidateWorkspaceDomains()` and the centralized query keys instead of scattering raw query keys through components.
