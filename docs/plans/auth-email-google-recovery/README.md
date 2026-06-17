# Auth Email, Google, And Recovery Plan

## Goal

Harden Finnn authentication by making verified email mandatory for service use, adding Google sign-in with safe auto-linking, and adding password reset through email codes.

This plan intentionally changes the direction introduced by Telegram authentication: users may still enter through Telegram, but they must add and verify email before using financial product features.

The desired agent workflow is:

```text
Orchestrator -> Developer -> Subagents
```

- The Orchestrator gives one complete task prompt.
- The Developer implements the feature end to end.
- Subagents help with bounded investigation, implementation, and verification.
- The Developer must leave an execution history in this folder as the work progresses.
- After every substantial implementation phase, the Developer must commit and push the current branch before moving on.

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

- Every active Finnn user must have a verified email before using financial service features.
- Users without a verified email can sign in, see a blocking onboarding screen, add email, request verification, verify it, and sign out.
- Domain API requests from authenticated users without a verified email must fail with `403 Forbidden`.
- Google sign-in must be available on login and registration pages.
- Existing email/password users can sign in with Google when the Google account email matches their verified Finnn email.
- Google auto-linking is allowed only when Google returns `email_verified = true` and the local Finnn email is already verified.
- Existing users can link and unlink Google from account settings.
- Users can reset their password by receiving a short-lived code at their verified email and setting a new password.
- Password reset must not disclose whether an email exists in Finnn.
- Existing Telegram-only users must be guided to add and verify email before using service features.
- Workspace invites remain email-based and continue to require matching verified email.

## Current Architecture Summary

Backend:

- Auth endpoints live in `packages/api/src/auth/auth.controller.ts`.
- Auth logic lives in `packages/api/src/auth/auth.service.ts`.
- Sessions are stored in `AuthSession` and exposed as the HTTP-only `finnn_session` cookie.
- External identities are stored in `AuthIdentity` with unique `(provider, providerUserId)`.
- Telegram OIDC already uses signed temporary state, PKCE, nonce validation, ID token validation, link, unlink, and session creation.
- Guards use `AuthGuard` and `WorkspaceAccessGuard`.
- Prisma schema is `packages/api/prisma/schema.prisma`.
- API tests include `packages/api/test/auth.e2e.test.ts` and `packages/api/test/workspace.e2e.test.ts`.

Frontend:

- Login page uses `packages/web/src/modules/auth/components/login-form/LoginForm.tsx`.
- Registration page uses `packages/web/src/modules/auth/components/register-form/RegisterForm.tsx`.
- Account settings use `packages/web/src/modules/auth/components/account-settings/AccountSettings.tsx`.
- Session context uses `packages/web/src/shared/lib/api-session-client.tsx`.
- Protected app routes use a CSR-first auth gate and TanStack Query session state.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Verified Email Policy

Verified email becomes a service precondition, not a sign-in precondition.

Allowed without verified email:

- `GET /auth/session`
- `POST /auth/logout`
- `PATCH /auth/user`
- `POST /auth/email`
- `POST /auth/verify-email/:token`
- Google and Telegram auth start/callback/link endpoints
- avatar/profile basics if needed by the email-required screen
- password reset request/confirm endpoints

Blocked without verified email:

- workspace reads and mutations
- account reads and mutations
- category reads and mutations
- transaction and transfer reads and mutations
- debt reads and mutations
- analytics reads
- workspace invite acceptance
- any future financial document or workspace-owned API

Recommended backend design:

- Add `EmailVerifiedGuard` in `packages/api/src/auth`.
- Run it after `AuthGuard` on domain controllers.
- Keep `AuthGuard` responsible only for authentication.
- Return `403 Forbidden` with a stable machine-readable code.

Suggested error shape:

```json
{
  "statusCode": 403,
  "message": "Подтвердите email, чтобы продолжить",
  "error": "Forbidden",
  "code": "EMAIL_VERIFICATION_REQUIRED"
}
```

If the existing exception filter does not support `code`, extend the common API error DTO and filter in a backward-compatible way.

## Google Authentication Approach

Use server-side OpenID Connect authorization code flow.

Reference docs:

- <https://developers.google.com/identity/openid-connect/openid-connect>
- <https://developers.google.com/identity/protocols/oauth2/web-server>

Recommended flow:

1. User clicks "Продолжить с Google".
2. Frontend navigates to an API start endpoint.
3. Backend generates `state`, `nonce`, PKCE verifier/challenge, and sanitized `returnTo`.
4. Backend stores the short-lived OAuth state in a signed, HTTP-only temporary cookie scoped to `/auth/google/callback`.
5. Backend redirects to Google's authorization endpoint.
6. Google redirects to the backend callback with `code` and `state`.
7. Backend validates state, exchanges code for tokens, validates `id_token`, and checks `iss`, `aud`, `exp`, `nonce`, and `sub`.
8. Backend resolves or creates the Finnn user and `AuthIdentity`.
9. Backend creates the existing Finnn `AuthSession`, sets `finnn_session`, and redirects back to the web app.

Provider identity rules:

- Use `provider = "google"`.
- Use Google `sub` as `AuthIdentity.providerUserId`.
- Do not use email as the provider identity key.
- Store display metadata from verified claims:
  - `username`: `email`
  - `displayName`: `name`
  - `photoUrl`: `picture`

First Google login resolution:

1. If `AuthIdentity(provider = "google", providerUserId = sub)` exists, sign in that user.
2. If no identity exists and Google has `email_verified = true`, find a Finnn user with the same email and non-null `emailVerified`.
3. If a verified local user exists, create the Google identity for that user and sign them in.
4. If no local user exists, create a user with Google email, `emailVerified = now`, name, image, and Google identity.
5. If Google email is missing or not verified, create or sign in only if a safe provider identity exists; otherwise require the user to add and verify email.
6. If the Google identity is linked to another user, return conflict.

Important security constraints:

- Auto-link only for Google, not for arbitrary future providers.
- Auto-link only with Google `email_verified = true`.
- Auto-link only to local users whose email is already verified.
- Perform create/link operations inside a transaction.
- Handle unique conflicts on `(provider, providerUserId)` safely.
- Do not store Google access or refresh tokens unless a future feature explicitly needs Google API access.

## API Design

Add or update DTOs under `packages/api/src/auth`.

Suggested endpoints:

- `GET /auth/google/start?returnTo=/dashboard`
- `GET /auth/google/link/start?returnTo=/dashboard`
- `GET /auth/google/callback`
- `DELETE /auth/google/link`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`

Extend `AuthUserDto`:

```ts
type AuthUserDto = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  emailVerified: string | null;
  telegram: {
    linked: boolean;
    username: string | null;
    displayName: string | null;
    photoUrl: string | null;
  };
  google: {
    linked: boolean;
    email: string | null;
    displayName: string | null;
    photoUrl: string | null;
  };
};
```

Do not create ad hoc frontend types that drift from OpenAPI. Update DTOs, regenerate OpenAPI, and regenerate Orval clients.

## Environment Variables

Add backend variables:

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""
GOOGLE_AUTH_STATE_SECRET=""
GOOGLE_AUTH_STATE_TTL_SECONDS="600"
PASSWORD_RESET_CODE_TTL_SECONDS="900"
PASSWORD_RESET_MAX_ATTEMPTS="5"
```

Existing shared variables still matter:

```env
WEB_APP_URL=""
API_COOKIE_SECURE=""
API_COOKIE_SAME_SITE=""
API_COOKIE_DOMAIN=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_SECURE=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""
```

Document local, DEV, and PROD Google redirect URIs in `docs/development.md` and `docs/operations.md`.

## Password Reset Plan

Add a password reset model:

```prisma
model PasswordResetCode {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  email     String
  codeHash  String
  expiresAt DateTime
  attempts  Int      @default(0)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId])
  @@index([email])
  @@index([expiresAt])
  @@map("password_reset_codes")
}
```

Add relation to `User`:

```prisma
passwordResetCodes PasswordResetCode[]
```

Request endpoint:

- `POST /auth/password-reset/request`
- Body: `{ email: string }`
- Always returns `{ success: true }`.
- If a user exists with matching verified email, create or replace a reset code and send email.
- If no such user exists, do not send email and do not reveal that fact.

Confirm endpoint:

- `POST /auth/password-reset/confirm`
- Body: `{ email: string; code: string; password: string }`
- Validate code hash, expiry, and attempt count.
- Hash the new password with bcrypt.
- Update `User.password`.
- Delete the reset code.
- Revoke all active sessions for the user.
- Return `{ success: true }`.

Code policy:

- Use a 6-digit numeric code for UX.
- Store only a hash of the code.
- Default TTL: 15 minutes.
- Default max attempts: 5.
- Increment attempts on wrong code.
- Delete or invalidate after success.

Abuse controls:

- Rate-limit requests by email and IP if a reusable project pattern exists.
- At minimum, enforce resend cooldown per user/email in the database.
- Keep response timing and content as uniform as practical.

## Frontend Plan

Email-required flow:

- Add a blocking screen for authenticated users without verified email.
- The screen should allow entering email, requesting verification, and signing out.
- Protected app gates should route authenticated unverified users to this screen instead of `/login`.
- When domain APIs return `EMAIL_VERIFICATION_REQUIRED`, redirect/show the same screen.
- Do not cache financial data while the user is unverified.

Google UI:

- Add a reusable `GoogleAuthButton`.
- Add `packages/web/src/modules/auth/google-auth-url.ts` mirroring Telegram URL helpers.
- Place Google button on login and registration pages.
- Add Google link/unlink block in account settings.
- Preserve invite behavior by using `returnTo=/invite/<token>` from login social buttons.

Password reset UI:

- Add "Forgot password?" link on login.
- Add request-code page/form.
- Add confirm-code/new-password page/form.
- After successful reset, route to login and show a success toast.

Account settings:

- Show email verified state.
- Let users request email verification when email is missing, changed, or unverified.
- Show Telegram and Google as separate linked account blocks.
- Prevent confusing unlink actions when the backend rejects removing the last viable sign-in method.

## Backend Implementation Phases

### Phase 1 - Auth DTO And Error Shape

- Extend API error support with stable `code` if needed.
- Add `emailVerified` and `google` to auth user DTOs.
- Update `toAuthUser` and selects.
- Regenerate OpenAPI and web client.
- Update existing auth/session tests and fixtures.

### Phase 2 - Verified Email Guard

- Add `EmailVerifiedGuard`.
- Apply it to domain controllers.
- Keep allowed auth/profile endpoints reachable without verified email.
- Add API tests for blocked domain requests and allowed email-verification endpoints.

### Phase 3 - Frontend Email-Required Gate

- Add the blocking email verification UI.
- Update protected route gates.
- Update API error handling for `EMAIL_VERIFICATION_REQUIRED`.
- Add targeted tests for session helpers or pure routing helpers.

### Phase 4 - Google OIDC Backend

- Add Google OIDC client.
- Add Google state cookie helpers or provider-generic OAuth state helpers.
- Add start, link start, callback, and unlink endpoints.
- Add Google identity resolution and auto-link policy.
- Add e2e coverage for login, auto-link, first-user create, link, conflict, unlink, invalid state, and callback error.

### Phase 5 - Google Frontend

- Add Google URL helpers and button.
- Add login, registration, invite-return, and account-settings integration.
- Update generated client usage for unlink.
- Add targeted web tests where project tooling supports it.

### Phase 6 - Password Reset Backend

- Add `PasswordResetCode` Prisma model.
- Run `pnpm db:generate`.
- Add request and confirm endpoints.
- Add email service method for reset codes.
- Add e2e tests for no-disclosure request behavior, success, invalid code, expired code, max attempts, and session revocation.

### Phase 7 - Password Reset Frontend

- Add forgot-password and reset-confirm pages/forms.
- Add validation and user feedback.
- Ensure reset flow does not require an existing session.

### Phase 8 - Docs And Operations

- Update `docs/development.md`.
- Update `docs/operations.md`.
- Update `docs/domain-model.md`.
- Update `docs/architecture.md`.
- Update `packages/api/.env.example`.
- Update `packages/web/.env.example` only if a browser-safe variable is added.

## Verification

Run targeted checks during implementation:

```bash
pnpm api:generate
pnpm api:check-generated
pnpm --filter api db:generate
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api test test/workspace.e2e.test.ts
pnpm --filter web test src/shared/lib/api-session.test.ts
pnpm typecheck
pnpm check
```

Run broader checks before final handoff:

```bash
pnpm test
pnpm build
```

Do not run browser screenshot QA unless the user explicitly asks for screenshot/browser QA.

## Open Decisions

- Whether to add a generic OAuth provider abstraction now or keep Google additive beside Telegram. Prefer small shared helpers for state cookies and identity summaries, not a broad abstraction unless duplication becomes hard to control.
- Whether to use `openid-client` for Google or keep the existing `fetch` + `jose` style. `openid-client` is safer for OAuth correctness; `fetch` + `jose` minimizes dependencies and matches Telegram.
- Whether `PATCH /auth/user` should be allowed for unverified users only for profile basics or fully allowed.
- Whether password reset confirmation should create a session automatically. Default recommendation: do not auto-login; route to login.

