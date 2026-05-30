# Telegram Authentication Plan

## Goal

Add Telegram authentication to Finnn and make user email optional across the project.

The desired agent workflow is:

```text
Orchestrator -> Developer -> Subagents
```

- The Orchestrator gives one complete task prompt.
- The Developer implements the feature end to end.
- Subagents help with bounded investigation, implementation, and verification.
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

If a subagent contributes analysis or a patch, the Developer must summarize that contribution in the work log before finishing.

## Product Requirements

- Add "Продолжить с Telegram" to login and registration pages.
- Existing registered users can link their Telegram account from account settings.
- Existing users can unlink Telegram unless it would leave them with no viable sign-in method.
- Telegram-authenticated users can sign in through the same HTTP-only session cookie flow as password users.
- Email becomes optional across the project.
- A first-time Telegram login can create a valid user without email.
- Password login remains available for users with an email and password.
- Email verification remains available for email/password registrations and for users who later add an email.
- Workspace invites must continue to work for users with email. The no-email behavior must be explicit and safe.

## UI Requirements

- The "Продолжить с Telegram" button must be an outlined ghost-style button.
- The button must include the Telegram logo and the text "Продолжить с Telegram".
- The button must be visually consistent across login, registration, and account-linking surfaces.

## Current Architecture Summary

Backend:

- Auth endpoints live in `packages/api/src/auth/auth.controller.ts`.
- Auth logic lives in `packages/api/src/auth/auth.service.ts`.
- Sessions are stored in `AuthSession` and exposed as the HTTP-only `finnn_session` cookie.
- Guards use `AuthGuard` and `WorkspaceAccessGuard`.
- Prisma schema is `packages/api/prisma/schema.prisma`.
- API tests include `packages/api/test/auth.e2e.test.ts` and `packages/api/test/workspace.e2e.test.ts`.

Frontend:

- Login page uses `packages/web/src/modules/auth/components/login-form/LoginForm.tsx`.
- Registration page uses `packages/web/src/modules/auth/components/register-form/RegisterForm.tsx`.
- Session context uses `packages/web/src/shared/lib/api-session-client.tsx`.
- Account settings use `packages/web/src/modules/auth/components/account-settings/AccountSettings.tsx`.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Telegram Approach

Use the current Telegram Login / OpenID Connect flow, not the legacy iframe widget as the primary implementation.

Official docs:

- <https://core.telegram.org/bots/telegram-login>
- Legacy fallback reference: <https://core.telegram.org/widgets/login-legacy>

Recommended flow:

1. User clicks "Продолжить с Telegram".
2. Frontend navigates to an API start endpoint.
3. Backend generates `state`, `nonce`, PKCE verifier/challenge, and a return URL.
4. Backend stores short-lived OAuth state server-side or in a signed, HTTP-only temporary cookie.
5. Backend redirects to `https://oauth.telegram.org/auth`.
6. Telegram redirects to the backend callback with `code` and `state`.
7. Backend validates `state`, exchanges code for tokens, validates `id_token` using Telegram JWKS, and checks `iss`, `aud`, `exp`, and `nonce`.
8. Backend finds or creates the local user flow result. If this is a first-time Telegram login, create a user without email and link the Telegram identity.
9. Backend creates the existing Finnn `AuthSession` and sets `finnn_session`.
10. Backend redirects back to the web app.

## Environment Variables

Add backend variables:

```env
TELEGRAM_CLIENT_ID=""
TELEGRAM_CLIENT_SECRET=""
TELEGRAM_REDIRECT_URI=""
TELEGRAM_AUTH_STATE_SECRET=""
```

Consider:

```env
TELEGRAM_AUTH_STATE_TTL_SECONDS="600"
```

Document BotFather setup in `docs/development.md` and `docs/operations.md`:

- Create/select a bot.
- Open Bot Settings > Web Login.
- Register local/public allowed URLs.
- Store Client ID and Client Secret in `packages/api/.env`.

## Data Model Plan

Prefer a provider identity model instead of Telegram-specific fields on `User`.

```prisma
model AuthIdentity {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  userId         String   @db.ObjectId
  provider       String
  providerUserId String
  username       String?
  displayName    String?
  photoUrl       String?
  linkedAt       DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("auth_identities")
}
```

Update `User`:

- Make `email` optional.
- Keep `emailVerified` optional.
- Add `authIdentities AuthIdentity[]`.
- Treat `User.id` plus provider identities as the durable account identifiers. Email is no longer the primary identifier for every user.

Important MongoDB note:

- Validate the generated unique index for optional `email`.
- Multiple users without email must be allowed.
- If Prisma/MongoDB creates a non-partial unique index that only allows one missing/null email, add an explicit operational step to replace it with a partial unique index.
- Existing mongo import/export tests already preserve `partialFilterExpression`; keep that behavior intact.

## API Design

Add DTOs and endpoints under `packages/api/src/auth`.

Suggested endpoints:

- `GET /auth/telegram/start?mode=login&returnTo=/dashboard`
- `GET /auth/telegram/callback`
- `GET /auth/telegram/link/start`
- `DELETE /auth/telegram/link`
- Optional: `GET /auth/telegram/status`

Alternative:

- Put link status into `GET /auth/session` by extending `AuthUserDto`.

Suggested user session shape:

```ts
type AuthUserDto = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  telegram?: {
    linked: boolean;
    username: string | null;
    displayName: string | null;
    photoUrl: string | null;
  };
};
```

Do not create ad hoc frontend types that drift from OpenAPI. Update DTOs, regenerate OpenAPI, and regenerate Orval clients.

## Optional Email Migration Plan

Backend:

1. Change `User.email` to optional in Prisma and generated Prisma usage.
2. Update auth DTOs so email/password registration and login still require email.
3. Add profile/email DTOs for users who need to add or verify email later.
4. Update `toAuthUser`, `AuthenticatedUser`, account/workspace/transaction DTOs, and service `select` projections to allow `email: string | null`.
5. Audit all workspace invite logic:
   - Creating an invite still requires target email.
   - Accepting an email invite requires current user to have matching verified email.
   - A Telegram-only user without email should receive a clear API error explaining that email must be added before accepting an email invite.
6. Update seed scripts and tests.
7. Remove business-logic assumptions that a user must have email to create transactions, transfers, accounts, debts, or workspace-owned records.

Frontend:

1. Update generated types after API changes.
2. Replace assumptions that `session.user.email` is always a string.
3. Use display fallback order: `name -> email -> Telegram username/displayName -> "User"`.
4. Update account/member/workspace/transaction owner types to allow nullable email.
5. Update invite acceptance page to handle no-email users.
6. Update account settings:
   - Show current email if present.
   - Show an "add email" path if missing.
   - Keep Telegram linking in a separate settings block.
7. Update transaction/transfer mappers and domain types so users without email are not silently dropped from UI-created payloads or optimistic cache data.

## Implementation Phases

### Phase 1 - Preparation

- Create/update work-log entry.
- Read `AGENTS.md`.
- Run `git status --short --branch`.
- Inspect current auth and invite flows.
- Use Context7 for relevant Next.js, NestJS, Prisma, or React Query documentation when needed.
- Use official Telegram docs for OIDC details.
- Commit and push the current branch after completing this phase.

### Phase 2 - Backend Data Model

- Update Prisma schema with optional email and `AuthIdentity`.
- Generate Prisma client with `pnpm db:generate`.
- Evaluate MongoDB unique index behavior for optional email.
- Update seed scripts and schema-dependent tests.
- Commit and push the current branch after completing this phase.

### Phase 3 - Backend Auth

- Extract reusable `createSessionForUser(userId)` logic from password login.
- Add Telegram OIDC state/PKCE helpers.
- Add Telegram token exchange and ID-token validation.
- Add Telegram login callback handling.
- Add Telegram link/unlink handling.
- Ensure unlink cannot remove the last login method.
- Add DTOs and Swagger metadata.
- Add e2e tests for:
  - Telegram login with existing linked identity.
  - Telegram link for authenticated user.
  - Conflict when Telegram identity is already linked elsewhere.
  - Unlink success.
  - Unlink blocked when no email/password or other identity remains.
  - Invalid state/nonce/token rejected.
  - Optional email user can maintain a valid session.
- Commit and push the current branch after completing this phase.

### Phase 4 - Invite And Workspace Safety

- Update workspace invite acceptance for nullable email.
- Preserve email invite behavior.
- Add clear errors for Telegram-only users trying to accept an email invite without adding matching verified email.
- Update workspace/account/member DTOs and tests for nullable email.
- Commit and push the current branch after completing this phase.

### Phase 5 - OpenAPI And Generated Client

- Run `pnpm api:generate`.
- Run `pnpm api:check-generated`.
- Do not hand-edit generated files.
- If generated model names are awkward, adjust backend DTO names and regenerate.
- Commit and push the current branch after completing this phase.

### Phase 6 - Frontend Auth UI

- Add a reusable Telegram auth button/component if it avoids duplication.
- Add "Продолжить с Telegram" to login and registration pages.
- Preserve `inviteToken` or equivalent return behavior.
- Add callback/error handling route or page if backend redirects back with status query params.
- Refresh session after Telegram login if the frontend handles final redirect.
- Ensure the Telegram button is outlined ghost-style and includes the Telegram logo plus "Продолжить с Telegram" text.
- Commit and push the current branch after completing this phase.

### Phase 7 - Frontend Settings UI

- Add Telegram connection block in account settings.
- Show linked username/display name.
- Add connect and disconnect actions.
- Refresh session after link/unlink.
- Add no-email display fallbacks throughout UI.
- Commit and push the current branch after completing this phase.

### Phase 8 - Documentation

- Update:
  - `docs/development.md`
  - `docs/operations.md`
  - `docs/domain-model.md`
  - `docs/architecture.md` if architecture materially changes
  - `AGENTS.md` only if agent-facing conventions change
- Document required env vars and BotFather setup.
- Commit and push the current branch after completing this phase.

### Phase 9 - Verification

Run focused checks first:

```bash
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api test test/workspace.e2e.test.ts
pnpm --filter web test src/shared/lib/api-session.test.ts
```

Then broaden:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

If a command cannot be run because external services are missing, record the reason in `work-log.md` and run the nearest useful subset.
- Commit and push the current branch after completing this step.

## Risk Register

- Telegram docs changed from legacy widget to OIDC; avoid implementing against old examples unless intentionally choosing fallback.
- Optional email affects many DTOs and UI assumptions.
- MongoDB unique index behavior for nullable email must be verified.
- Workspace invites are email-based and need explicit no-email handling.
- Current frontend transaction and transfer helpers have guards that reject users without email; these must be fixed.
- `AuthUserDto` changes will ripple through generated frontend types.
- Cross-origin cookie settings must still work after Telegram redirects.
- Do not cache auth callback, dashboard, financial documents, or API data in the service worker.

## Done Criteria

- Telegram login works for linked users.
- Existing users can link and unlink Telegram.
- Email can be null for users where appropriate.
- Email/password login and registration still work.
- Workspace invites remain safe and tested.
- OpenAPI and generated client are in sync.
- Documentation is updated.
- Work log contains implementation history and verification results.
- Required verification commands are run or explicitly documented as blocked.
