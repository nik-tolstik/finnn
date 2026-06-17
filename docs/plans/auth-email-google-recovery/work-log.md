# Auth Email, Google, And Recovery Work Log

This file is the required execution history for the auth email, Google, and recovery project.

Developer agents must append entries here while implementing the plan in this folder.

## Entry Template

````md
## YYYY-MM-DD HH:mm TZ - Agent Name / Role

### Scope

- What this entry covers.

### Files Changed

- `path/to/file`

### Commands Run

```bash
pnpm ...
```

### Results

- Pass/fail output summary.

### Decisions

- Decision and reason.

### Subagent Contributions

- Agent name: summary of analysis or patch.

### Blockers / Follow-ups

- None, or concrete next action.
````

## 2026-06-17 - Codex / Planning

### Scope

- Created the initial implementation plan for mandatory verified email, Google authentication, and password reset.
- Captured the product decision to return `403 Forbidden` for authenticated users who lack verified email when they access service APIs.
- Captured the product decision to allow Google auto-linking for existing email/password accounts only when Google returns a verified email matching an already verified local email.
- Created the orchestration prompt and work log for future implementation agents.

### Files Changed

- `docs/plans/auth-email-google-recovery/README.md`
- `docs/plans/auth-email-google-recovery/prompt.md`
- `docs/plans/auth-email-google-recovery/work-log.md`

### Commands Run

```bash
find docs/plans -maxdepth 2 -type f | sort
sed -n '1,220p' docs/plans/telegram-auth/README.md
sed -n '1,180p' docs/plans/telegram-auth/prompt.md
sed -n '1,140p' docs/plans/telegram-auth/work-log.md
mkdir -p docs/plans/auth-email-google-recovery
```

### Results

- Planning files were created.
- Implementation was not started.

### Decisions

- Use verified email as a product precondition, not a sign-in precondition.
- Use a dedicated `EmailVerifiedGuard` for financial/domain APIs.
- Return `403 Forbidden` with a stable `EMAIL_VERIFICATION_REQUIRED` code for unverified users.
- Add Google through the existing backend-owned HTTP-only session model.
- Use Google `sub` as the provider identity key.
- Add password reset through short-lived email codes stored only as hashes.

### Subagent Contributions

- Backend explorer confirmed that `AuthIdentity`, `AuthSession`, and Telegram OIDC provide the right backend template for Google.
- Frontend explorer confirmed login, registration, invite, account-settings, session, and generated-client insertion points.

### Blockers / Follow-ups

- Implementation not started.

## 2026-06-18 00:28 +03 - Codex / Developer

### Scope

- Implemented mandatory verified email as a service precondition for workspace and financial domain APIs.
- Added Google OIDC sign-in, safe verified-email auto-linking, explicit Google link/unlink, and generated API contracts.
- Added password reset by short-lived email code with non-disclosing request behavior and session revocation on success.
- Added frontend email-required, Google, account-settings, invite-return, forgot-password, and reset-password flows.
- Updated docs, environment examples, generated OpenAPI/Orval clients, and API/web tests.

### Files Changed

- Plan docs: `docs/plans/auth-email-google-recovery/README.md`, `docs/plans/auth-email-google-recovery/prompt.md`, `docs/plans/auth-email-google-recovery/work-log.md`.
- Project docs and env: `docs/architecture.md`, `docs/development.md`, `docs/domain-model.md`, `docs/operations.md`, `packages/api/.env.example`.
- API schema/generated contract: `packages/api/prisma/schema.prisma`, `packages/api/openapi.json`, `packages/web/src/shared/api/generated/**`.
- API auth and errors: `packages/api/src/auth/auth.controller.ts`, `packages/api/src/auth/auth.dto.ts`, `packages/api/src/auth/auth.module.ts`, `packages/api/src/auth/auth.service.ts`, `packages/api/src/auth/auth.types.ts`, `packages/api/src/auth/email-verified.guard.ts`, `packages/api/src/auth/google-oidc.client.ts`, `packages/api/src/auth/google-state-cookie.ts`, `packages/api/src/common/api-error.dto.ts`, `packages/api/src/http-exception.filter.ts`, `packages/api/src/email/email.service.ts`.
- API guarded domains: `packages/api/src/accounts/accounts.controller.ts`, `packages/api/src/analytics/analytics.controller.ts`, `packages/api/src/categories/categories.controller.ts`, `packages/api/src/debts/debts.controller.ts`, `packages/api/src/transactions/transactions.controller.ts`, `packages/api/src/workspace/workspace.controller.ts`.
- API tests: `packages/api/test/accounts.e2e.test.ts`, `packages/api/test/analytics.e2e.test.ts`, `packages/api/test/auth.e2e.test.ts`, `packages/api/test/categories.e2e.test.ts`, `packages/api/test/debts.e2e.test.ts`, `packages/api/test/transactions.e2e.test.ts`, `packages/api/test/workspace.e2e.test.ts`.
- Web auth routes/components: `packages/web/src/app/(auth)/email-required/**`, `packages/web/src/app/(auth)/forgot-password/**`, `packages/web/src/app/(auth)/reset-password/**`, `packages/web/src/app/(auth)/invite/[token]/page.tsx`, `packages/web/src/app/(auth)/register/page.tsx`, `packages/web/src/modules/auth/**`.
- Web shared/gates: `packages/web/src/app/(dashboard)/components/DashboardAuthGate.tsx`, `packages/web/src/app/(dashboard)/layout.tsx`, `packages/web/src/app/providers.tsx`, `packages/web/src/shared/api/http-client.ts`, `packages/web/src/shared/lib/api-session-client.tsx`.

### Commands Run

```bash
pnpm --filter api db:generate
pnpm api:generate
pnpm api:check-generated
pnpm --filter api typecheck
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api test test/workspace.e2e.test.ts
pnpm --filter api test test/auth.e2e.test.ts test/workspace.e2e.test.ts
pnpm --filter web typecheck
pnpm --filter web test src/shared/lib/api-session.test.ts src/shared/api/http-client.test.ts
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

### Results

- `pnpm --filter api db:generate`: passed.
- `pnpm api:generate`: passed.
- `pnpm api:check-generated`: passed.
- `pnpm --filter api typecheck`: passed.
- `pnpm --filter api test test/auth.e2e.test.ts`: passed, 60 tests.
- `pnpm --filter api test test/workspace.e2e.test.ts`: passed, 18 tests.
- `pnpm --filter api test test/auth.e2e.test.ts test/workspace.e2e.test.ts`: passed, 78 tests.
- `pnpm --filter web typecheck`: passed.
- `pnpm --filter web test src/shared/lib/api-session.test.ts src/shared/api/http-client.test.ts`: passed, 10 tests.
- `pnpm typecheck`: passed.
- `pnpm check`: passed and verified generated API output.
- `pnpm test`: passed, 11 API test files / 155 tests and 28 web test files / 108 tests.
- `pnpm build`: passed after rerunning with network access for Google Fonts and adding the missing Suspense boundary around the dashboard auth gate.
- Initial sandboxed `pnpm test` failed with `listen EPERM 0.0.0.0`; rerunning with approved escalation passed.
- Initial sandboxed `pnpm build` failed fetching the configured Onest Google Font; rerunning with approved network access exposed and then confirmed the real Next.js build result.

### Decisions

- Kept verified email as an API service precondition instead of blocking sign-in.
- Added `EmailVerifiedGuard` after `AuthGuard` on domain controllers and preserved auth/profile/email verification endpoints for unverified users.
- Extended the API error DTO and exception filter with optional `code` for stable frontend handling of `EMAIL_VERIFICATION_REQUIRED`.
- Added Google beside Telegram without a broad OAuth abstraction; shared only the state-cookie pattern where useful.
- Used Google `sub` as the external identity key and did not store Google access or refresh tokens.
- Allowed Google auto-linking only when Google returns a verified email and the matching local user already has `emailVerified`.
- Implemented password reset as a 6-digit hashed code with per-user replacement/cooldown, max attempts, and active session revocation after password change.
- Wrapped the dashboard auth gate in `Suspense` to satisfy App Router CSR bailout requirements introduced by `useSearchParams`.

### Subagent Contributions

- Kant / backend implementer: implemented the backend foundation for auth DTOs, error shape, verified-email guard, Google OIDC/linking, password reset, and API e2e coverage.
- Gauss / frontend explorer: identified the login, registration, invite, account-settings, session provider, dashboard auth gate, and generated-client integration points for the frontend work.

### Blockers / Follow-ups

- No blocking follow-ups remain.
- Operational follow-up: configure Google OAuth credentials and redirect URIs plus password reset/SMTP variables in local, DEV, and PROD environments before exercising live Google and email flows.
