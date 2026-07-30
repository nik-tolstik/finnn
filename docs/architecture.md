# Architecture

## High-Level Shape

Finnn is a `pnpm` monorepo with a Vite-powered React SPA in `packages/web` and a NestJS API in `packages/api`.

```text
packages/web/src/app       SPA composition root and React Router route tree
packages/web/src/routes    Route layouts and route entry components
packages/web/src/providers Application-wide client providers
packages/web/src/styles    Global styles
packages/web/src/modules   Feature UI, frontend hooks, and API-backed adapters
packages/web/src/shared    Cross-cutting UI, generated API client, lib helpers, utilities
packages/web/public        PWA assets and service worker
packages/api/src           NestJS controllers, services, guards, and modules
packages/api/prisma        Prisma schema and generated client source
packages/api/scripts       Seed, import, and export scripts
docs                       Project documentation
```

## Web SPA And Routing

`packages/web/src/main.tsx` mounts the application. `packages/web/src/app/App.tsx` declares the React Router tree and
lazy-loads each route entry behind a shared suspense fallback.

- `packages/web/src/routes/auth` contains login, registration, invite acceptance, password reset, and email verification routes.
- `packages/web/src/routes/dashboard` contains authenticated routes and the dashboard shell.
- `packages/web/src/shared/lib/api-session.tsx` provides SPA session state from the generated API client.
- Exchange-rate reads and cron persistence are owned by `packages/api/src/currency`.

Nested route layouts render child routes through React Router's `Outlet`. The dashboard auth gate resolves the API
session in the browser, while route components use TanStack Query for workspace and financial data. A wildcard route
redirects unknown client-side URLs to `/`, and `packages/web/vercel.json` serves `index.html` for direct SPA navigation.

Examples:

- `packages/web/src/routes/dashboard/DashboardRoute.tsx`
- `packages/web/src/routes/dashboard/AnalyticsRoute.tsx`
- `packages/web/src/routes/dashboard/DebtsRoute.tsx`

## Feature Modules

Frontend feature modules live under `packages/web/src/modules`.

- `accounts` - account CRUD, archive/delete behavior, ownership visibility, personal dashboard hiding, cards, ordering, settings.
- `analytics` - analytics aggregation, date range helpers, chart data.
- `auth` - registration, verification, user settings.
- `categories` - income/expense category CRUD and ordering.
- `debts` - debt creation, closing, additions, edits, debt transactions, debt UI.
- `scheduled-payments` - planned payment adapters, status/amount helpers, create and mark-paid UI.
- `transactions` - payment transactions, transfers, combined transaction feed, filtering.
- `workspace` - workspace CRUD, members, roles, invites, workspace selection.

Exchange-rate UI is cross-cutting rather than a standalone frontend feature module. The shared amount synchronization hook lives in
`packages/web/src/shared/hooks/useCurrencyAmountSync.ts`, dashboard presentation lives under
`packages/web/src/routes/dashboard/components`, and the Orval client lives under
`packages/web/src/shared/api/generated/currency`.

The typical frontend module shape is:

```text
module/
  module.api.ts           Pure generated-client adapter when response shaping is needed
  module.types.ts         Shared module types
  module.constants.ts     Domain constants
  components/             Browser UI for the feature
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
- `packages/web/src/shared/lib/api-session.tsx`
- `packages/web/src/shared/lib/query-invalidation.ts`
- `packages/web/src/shared/lib/validations`

Backend mutation flow:

1. Authenticate with API auth guards.
2. Check workspace access with `WorkspaceAccessGuard` and role metadata when needed.
3. Validate inputs with NestJS DTOs.
4. Execute Prisma reads/writes in API services.
5. Keep balance-changing and other read-modify-write invariants inside `runSerializableTransaction`.
6. Return explicit DTO response shapes documented in OpenAPI.

## Transactional Application Layer

Balance-sensitive persisted logic lives in API services:

- `packages/api/src/transactions/transactions.service.ts`
- `packages/api/src/debts/debts.service.ts`

These files use `runSerializableTransaction` to keep domain writes consistent and retry PostgreSQL serialization or
deadlock failures reported as Prisma `P2034`. Composed mutations accept the active `Prisma.TransactionClient`; they do
not open nested transactions. They also centralize important checks such as:

- Account belongs to the workspace.
- A transaction date is not earlier than the account creation date.
- Expense or transfer amount does not exceed the source account balance.
- Transfer source and destination accounts are different.
- Debt changes keep balances and remaining amounts coherent.

The same boundary applies to scheduled-payment occurrence processing, AI-draft commits, email-token consumption,
workspace-invite acceptance, and unlinking the last external login methods. Network calls remain outside database
transactions. Reminder delivery uses a unique `pending` claim before calling email or Telegram, then records `sent` or
`failed` after the provider returns.

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

`packages/web` calls these endpoints through generated Orval client functions with credentials included. The client
session provider caches `GET /auth/session` through TanStack Query; the browser sends the HTTP-only session cookie to
the API without exposing it to application code.

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

Protected app data is loaded through TanStack Query in browser components. Cached data should render immediately while
stale data refetches in the background. Keep authentication and financial data access on the API boundary rather than
adding route loaders that duplicate the query cache.

Optimistic updates are centralized in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`. Use these helpers when changing account, category, debt, transaction, workspace, or user references in client cache.

## UI System

Reusable UI primitives live in `packages/web/src/shared/ui`.

Reusable composed components live in `packages/web/src/shared/components`.

Color architecture and shared control styling follow the palette, semantic token, and component token contracts documented in [Web Design System](./design-system.md).

Account icon rendering is cross-cutting. `packages/web/src/shared/utils/account-icons.tsx` owns the icon registry and color-mode metadata, while `packages/web/src/shared/utils/account-icon-colors.ts` derives theme-safe colors for adaptive icons. Follow [Account Icons](./account-icons.md) when adding or changing account marks.

Prefer existing primitives for dialogs, sheets, selects, popovers, buttons, cards, tables, forms, and date controls. Feature-specific components should stay inside the relevant `packages/web/src/modules/*/components` directory.

App-facing forms should use the shared form controls instead of native browser controls: `shared/ui/select` for dropdowns, `DatePicker` or `DateTimePicker` for dates, `AccountSelector`/`SelectAccountDialog` for account selection, `UserDisplay`/`UserAvatar` for user choices, and `CURRENCY_OPTIONS` for currency choices.

## Invalidation

Client mutations use TanStack Query invalidation and optimistic workspace cache helpers. Keep invalidation domain-based through `invalidateWorkspaceDomains()` and the centralized query keys instead of scattering raw query keys through components.
