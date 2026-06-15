# Telegram Mini App Plan

## Goal

Add Telegram Mini App support to Finnn while preserving the existing web application experience.

The Mini App should open the same Finnn routes and UI that users already see in the browser. Telegram should only add
automatic authentication and small WebView compatibility behavior where needed. Do not build a separate Mini App-only
product surface for the first implementation.

The desired agent workflow is:

```text
Orchestrator -> Developer -> Subagents
```

- The Orchestrator gives one complete task prompt.
- The Developer implements the feature end to end.
- Subagents help with bounded investigation, implementation, and verification when they reduce risk or latency.
- The Developer must leave an execution history in this folder as the work progresses.
- After every implementation step/phase, the Developer must commit and push the current branch before moving on.

## Required Work Log

The Developer must update [work-log.md](./work-log.md) after every substantial phase.

Each entry must include:

- Date/time.
- Agent role/name.
- Files changed.
- Commands run.
- Tests/checks result.
- Decisions made.
- Blockers or follow-ups.

If a subagent contributes analysis or a patch, the Developer must summarize that contribution in the work log before
finishing.

## Product Requirements

- Users should be able to open Finnn as a Telegram Mini App and land in the existing authenticated app flow.
- New Telegram users should be automatically signed in or created from validated Telegram Mini App launch data.
- Existing Telegram-linked users should be signed in to the same Finnn account they use through Telegram auth.
- Existing Finnn users who already linked Telegram through account settings should keep the same identity.
- If the user has no workspace, show the existing create-workspace flow.
- If the user has workspaces, show the existing dashboard/workspace routing behavior.
- Keep the current dashboard, analytics, debts, settings, accounts, transaction, transfer, and workspace UI as the first
  Mini App experience.
- Opening Finnn in a normal browser must keep working exactly as before.
- Telegram-only users may still have no email; email-based workspace invite rules from the Telegram auth project remain
  unchanged.

## Non-Goals For MVP

- Do not build a separate `/mini` application shell unless implementation proves the existing route shell cannot work.
- Do not redesign dashboard, analytics, debts, or transaction forms specifically for Telegram in the first pass.
- Do not replace the existing HTTP-only session cookie model with a bearer-token auth model unless Telegram WebView
  cookie behavior blocks the cookie flow in real testing.
- Do not duplicate finance business logic in Mini App-specific API endpoints.
- Do not hand-edit generated OpenAPI or Orval client files.

## Current Architecture Summary

Backend:

- Auth endpoints live in `packages/api/src/auth/auth.controller.ts`.
- Auth logic lives in `packages/api/src/auth/auth.service.ts`.
- Sessions are stored in `AuthSession` and exposed as the HTTP-only `finnn_session` cookie.
- Current Telegram auth uses Telegram OpenID Connect through `GET /auth/telegram/start`,
  `GET /auth/telegram/callback`, `GET /auth/telegram/link/start`, and `DELETE /auth/telegram/link`.
- Telegram identities are stored in `AuthIdentity` with `provider = "telegram"`.
- Guards use `AuthGuard` and `WorkspaceAccessGuard`.
- Finance modules already expose reusable account, category, transaction, transfer, debt, analytics, workspace, and
  currency endpoints.
- Prisma schema is `packages/api/prisma/schema.prisma`.

Frontend:

- Root providers live in `packages/web/src/app/providers.tsx`.
- Session state lives in `packages/web/src/shared/lib/api-session-client.tsx`.
- API calls use `credentials: "include"` in `packages/web/src/shared/api/http-client.ts`.
- Protected app routes use `DashboardAuthGate` in `packages/web/src/app/(dashboard)/components/DashboardAuthGate.tsx`.
- Workspace routing uses `packages/web/src/modules/workspace/useWorkspaceRoute.ts`.
- Main protected UI lives under `packages/web/src/app/(dashboard)`.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Telegram Mini App Approach

Use Telegram Mini App launch data, not the existing Telegram OIDC redirect flow, for automatic Mini App login.

Official docs:

- <https://core.telegram.org/bots/webapps>
- <https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app>
- Optional SDK reference: <https://github.com/Telegram-Mini-Apps/tma.js>

Recommended flow:

1. User opens the Finnn Mini App from Telegram.
2. Telegram loads an existing Finnn URL such as `https://finnn.xyz/dashboard`.
3. The frontend detects `window.Telegram?.WebApp?.initData` on the client.
4. If a valid Finnn session already exists, the app continues normally.
5. If no Finnn session exists and `initData` is present, the frontend sends the raw `initData` string to the API.
6. The API validates the `initData` signature and freshness on the server.
7. The API extracts the Telegram user, finds or creates a local user, and stores or updates the `AuthIdentity`.
8. The API creates the existing Finnn `AuthSession` and sets the same `finnn_session` cookie.
9. The frontend refreshes the session query and lets existing protected app routing continue.

Do not trust `window.Telegram.WebApp.initDataUnsafe` for authentication. It may be used for non-sensitive client display
only after server authentication has succeeded.

## Route Strategy

Use existing routes for the first implementation.

Recommended BotFather Mini App URL:

```text
https://finnn.xyz/dashboard
```

Recommended DEV Mini App URL:

```text
https://dev.finnn.xyz/dashboard
```

Local testing may require an HTTPS tunnel because Telegram Mini Apps must load a public HTTPS URL.

Do not add `/mini` as the primary route. A dedicated `/mini` route is only acceptable later if:

- Telegram WebView needs route-specific bootstrapping that cannot be safely applied globally.
- A future product decision creates a separate lightweight Mini App experience.
- Browser and Telegram behavior become too divergent to keep in one route shell.

## API Design

Add DTOs and endpoints under `packages/api/src/auth`.

Suggested endpoint:

- `POST /auth/telegram-mini/session`

Suggested request:

```ts
type TelegramMiniAppSessionDto = {
  initData: string;
};
```

Suggested response:

```ts
type AuthUserResponseDto = {
  user: AuthUserDto;
};
```

Behavior:

- Validate that `initData` is present and within a configured maximum age.
- Parse the query string fields after validation.
- Extract `user.id` as the durable Telegram provider user id.
- Use the same `provider = "telegram"` identity namespace as the Telegram auth feature.
- Find an existing `AuthIdentity` by `(provider, providerUserId)`.
- If found, update username/display name/photo metadata when changed and create a session for the linked user.
- If not found, create a new user without email and create the Telegram identity.
- Return the auth user and set `finnn_session` with `createSessionCookie`.

Implementation notes:

- Reuse `AuthService.createSessionForUser(userId)`.
- Refactor existing private Telegram OIDC identity helpers if needed so Mini App and OIDC login share identity
  find/create/update logic.
- Add explicit tests for both existing linked users and first-time Telegram Mini App users.
- Keep the OpenAPI schema and generated web client in sync with `pnpm api:generate`.

## Telegram Init Data Validation

Backend validation must follow Telegram Web Apps rules:

- Receive the raw `initData` query string from the frontend.
- Parse it as URL search params.
- Require `hash`.
- Build the Telegram data-check string from all fields except `hash`, sorted alphabetically and joined with newline
  characters.
- Build the secret key as HMAC-SHA-256 of the bot token using `WebAppData` as the key.
- Compare the calculated HMAC-SHA-256 hex digest with the received `hash` using a timing-safe comparison.
- Require `auth_date` and reject stale data.
- Require a Telegram `user` object with a stable numeric `id`.

Consider a default `auth_date` maximum age of 24 hours for production. Use a shorter TTL only if real Telegram client
behavior confirms it is safe for user experience.

## Environment Variables

Add backend variables:

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS="86400"
```

Document PROD and DEV bot behavior:

- PROD Mini App uses the PROD Telegram bot and production domains.
- DEV Mini App uses the DEV Telegram bot and development domains.
- Local testing should use the DEV bot and a stable HTTPS tunnel when needed.

Keep existing Telegram OIDC variables for browser login and account linking:

```env
TELEGRAM_CLIENT_ID=""
TELEGRAM_CLIENT_SECRET=""
TELEGRAM_REDIRECT_URI=""
TELEGRAM_AUTH_STATE_SECRET=""
```

## Frontend Design

Add a global client bootstrap instead of a separate route shell.

Suggested files:

- `packages/web/src/modules/telegram-mini/telegram-mini.types.ts`
- `packages/web/src/modules/telegram-mini/telegram-mini.api.ts`
- `packages/web/src/modules/telegram-mini/TelegramMiniAppBootstrap.tsx`
- `packages/web/src/modules/telegram-mini/useTelegramMiniApp.ts`

Integration points:

- Render `TelegramMiniAppBootstrap` inside `packages/web/src/app/providers.tsx` after `ApiSessionProvider` is available.
- Expose a small state that tells protected-route code whether Telegram bootstrap is still pending.
- Update `DashboardAuthGate` so it does not redirect to `/login` while Telegram Mini App auth is pending.
- Refresh the existing `api-session` query after Mini App session creation.

Bootstrap behavior:

1. Run only on the client.
2. Detect `window.Telegram?.WebApp`.
3. Call `Telegram.WebApp.ready()` once the bootstrap component mounts.
4. Optionally call `Telegram.WebApp.expand()` for a browser-like full-height experience.
5. Read only the raw `Telegram.WebApp.initData` for authentication.
6. If `initData` is missing, do nothing and allow normal browser auth behavior.
7. If a Finnn session is already authenticated, do nothing.
8. If unauthenticated and `initData` exists, call `POST /auth/telegram-mini/session`.
9. On success, refresh session and continue existing routing.
10. On failure, show a clear auth error and allow the existing login page flow as fallback.

## UI Requirements

- Preserve the current Finnn UI for the first Mini App release.
- The dashboard, analytics, debts, workspace settings, account settings, and transaction dialogs should render from the
  existing components.
- Keep existing mobile layouts and responsive behavior.
- Do not add an in-app "Mini App mode" label or explanatory UI.
- Use Telegram-specific theme, viewport, safe area, BackButton, or MainButton integration only if real testing shows
  the existing UI needs it.
- If Telegram theme integration is added, keep Finnn's visual identity intact and use Telegram theme params only for
  compatibility-level colors such as background and safe area.
- If Telegram BackButton integration is added, it should follow the existing Next.js navigation stack and never bypass
  unsaved form state.

## Cookie And WebView Strategy

The preferred strategy is to keep using the existing HTTP-only `finnn_session` cookie.

Verify in real Telegram clients:

- iOS Telegram.
- Android Telegram.
- Telegram Desktop.
- Web open fallback if relevant.

If cookies work:

- Keep `AuthGuard` cookie-only.
- Keep API clients using `credentials: "include"`.
- Do not add bearer session support.

If cookies fail in a real Telegram client:

- Document the exact client/platform failure in `work-log.md`.
- Consider a deliberate fallback design, such as a first-party same-site deployment adjustment before introducing bearer
  tokens.
- Add bearer/session-token auth only as a last resort and only with explicit security review.

## Implementation Phases

### Phase 1 - Preparation

- Create/update work-log entry.
- Read `AGENTS.md`.
- Run `git status --short --branch`.
- Inspect current Telegram auth, session, providers, dashboard gate, and API client behavior.
- Use Context7 or official docs for Telegram Mini App, Next.js, NestJS, or React Query details when relevant.
- Confirm whether the current branch includes the Telegram auth and nullable-email work.
- Commit and push the current branch after completing this phase.

### Phase 2 - Backend Mini App Auth

- Add Telegram Mini App DTOs.
- Add `POST /auth/telegram-mini/session`.
- Add server-side `initData` validation helper with timing-safe hash comparison.
- Add Telegram Mini App identity find/create/update logic.
- Reuse the existing `AuthSession` and `finnn_session` cookie.
- Add Swagger metadata.
- Add e2e tests for:
  - Missing `initData` rejected.
  - Invalid hash rejected.
  - Stale `auth_date` rejected.
  - Missing user rejected.
  - Existing linked Telegram identity signs in.
  - First-time Telegram Mini App user is created without email.
  - Telegram profile metadata updates for an existing identity.
- Commit and push the current branch after completing this phase.

### Phase 3 - OpenAPI And Generated Client

- Run `pnpm api:generate`.
- Run `pnpm api:check-generated`.
- Do not hand-edit generated files.
- If generated names are awkward, adjust backend DTO names and regenerate.
- Commit and push the current branch after completing this phase.

### Phase 4 - Frontend Bootstrap

- Add a Telegram Mini App bootstrap module.
- Detect Telegram WebApp launch data on the client.
- Send raw `initData` to the generated Mini App auth client.
- Refresh the existing API session query after success.
- Ensure normal browser users are unaffected.
- Ensure failed Mini App auth does not create a redirect loop.
- Commit and push the current branch after completing this phase.

### Phase 5 - Protected Route Integration

- Update `DashboardAuthGate` or its session flow so Telegram auth bootstrap can complete before login redirects.
- Preserve the existing unauthenticated browser redirect to `/login`.
- Confirm new Telegram-only users see the existing create-workspace prompt.
- Confirm existing Telegram users land on the existing dashboard.
- Commit and push the current branch after completing this phase.

### Phase 6 - Telegram WebView Compatibility

- Add only the minimal Telegram WebApp calls needed for stable UX:
  - `ready()`.
  - `expand()` if it improves first load.
  - Viewport or safe-area CSS handling only if required after testing.
- Test existing dialogs, sheets, selects, date pickers, and keyboard behavior inside Telegram.
- Avoid redesigning the app in this phase.
- Commit and push the current branch after completing this phase.

### Phase 7 - Documentation

- Update:
  - `docs/development.md`
  - `docs/operations.md`
  - `docs/architecture.md` if architecture materially changes
  - `docs/domain-model.md` if identity behavior changes beyond existing Telegram auth docs
  - `AGENTS.md` only if agent-facing conventions change
- Document BotFather Mini App setup and domain configuration.
- Document required env vars.
- Document local HTTPS tunnel testing.
- Commit and push the current branch after completing this phase.

### Phase 8 - Verification

Run focused checks first:

```bash
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter web test src/shared/lib/api-session.test.ts
pnpm api:check-generated
```

Then broaden:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

Manual verification must include:

- Open the Mini App from the PROD or DEV Telegram bot in a real Telegram client.
- First-time Telegram user gets a Finnn account and reaches the existing workspace flow.
- Existing linked Telegram user reaches their existing workspace.
- Normal browser login still works.
- Normal Telegram OIDC login/link/unlink still works.
- Existing dashboard transaction creation works inside Telegram.
- Existing workspace creation works inside Telegram.

If a command or manual check cannot be run because external services are missing, record the reason in `work-log.md` and
run the nearest useful subset.

- Commit and push the current branch after completing this step.

## Risk Register

- Telegram Mini Apps use signed `initData`, not the existing OIDC callback flow.
- `initDataUnsafe` is not trusted and must not be used for authentication.
- Telegram WebView cookie behavior must be verified on real clients.
- `DashboardAuthGate` may redirect too early unless it waits for Telegram bootstrap.
- Current protected APIs are cookie-only; adding bearer auth would expand the security surface and should be avoided
  unless necessary.
- First-time Telegram users may have no email, so email invite behavior must remain explicit and safe.
- Existing forms may have keyboard, viewport, or nested-dialog friction inside Telegram WebView.
- BotFather PROD and DEV bot/domain configuration can easily drift.
- Do not cache auth, dashboard, financial documents, API responses, or data responses in the service worker.

## Done Criteria

- Telegram Mini App launch auto-authenticates with validated `initData`.
- Existing Telegram-linked users sign in to the correct Finnn account.
- First-time Telegram users get a valid nullable-email Finnn account.
- Existing Finnn routes and UI are reused as the Mini App experience.
- Browser login, registration, Telegram OIDC login, Telegram linking, and logout still work.
- Protected routes do not redirect to `/login` before Mini App bootstrap completes.
- OpenAPI and generated clients are in sync.
- Documentation is updated.
- Real Telegram client verification is completed or explicitly documented as blocked.
- Work log contains implementation history and verification results.
- Required verification commands are run or explicitly documented as blocked.
