# Telegram Authentication Work Log

This file is the required execution history for the Telegram authentication project.

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

## 2026-05-30 - Codex / Planning

### Scope

- Created the initial implementation plan for Telegram authentication and optional email migration.
- Created this work log so future Developer agents can leave execution history.
- Updated the orchestration prompt to point to the plan as the source of truth instead of duplicating implementation requirements.
- Moved common orchestration instructions out of the prompt and into `AGENTS.md` or the implementation plan.
- Rewrote the Orchestrator prompt in English.
- Added the UI requirement for an outlined ghost-style Telegram button with the Telegram logo and text.
- Added a required commit-and-push checkpoint after every implementation step/phase.

### Files Changed

- `docs/plans/telegram-auth/README.md`
- `docs/plans/telegram-auth/work-log.md`
- `docs/plans/telegram-auth/orchestrator-prompt.md`
- `AGENTS.md`

### Commands Run

```bash
git status --short --branch
git switch -c codex/telegram-auth-plan
mkdir -p docs/plans/telegram-auth
```

### Results

- Branch `codex/telegram-auth-plan` created from `develop`.
- Worktree was clean before planning files were added.

### Decisions

- Recommended Telegram OpenID Connect as the primary auth flow.
- Recommended a provider identity model instead of Telegram-specific fields on `User`.
- Required future agents to update this work log after each substantial phase.

### Subagent Contributions

- Backend auth explorer summarized current API auth/session flow and Telegram insertion points.
- Frontend auth explorer summarized login/register/settings integration points.
- Optional-email explorer confirmed high impact across auth, workspace invites, DTOs, generated clients, UI domain types, and transaction/transfer helpers.

### Blockers / Follow-ups

- Implementation not started in this planning branch.

## 2026-05-30 18:38 +03 - Codex / Developer

### Scope

- Phase 1 preparation for Telegram authentication implementation.
- Read the project instructions and Telegram auth implementation plan.
- Checked current branch/worktree state and inspected existing backend auth/session, workspace invite, Prisma schema, frontend auth/settings, and nullable-email surfaces.
- Consulted Telegram's current OIDC login documentation and legacy-widget reference.

### Files Changed

- `docs/plans/telegram-auth/work-log.md`

### Commands Run

```bash
git status --short --branch
find . -name AGENTS.md -print
sed -n '1,240p' AGENTS.md
sed -n '1,620p' docs/plans/telegram-auth/README.md
sed -n '1,260p' packages/api/prisma/schema.prisma
sed -n '1,280p' packages/api/src/auth/auth.service.ts
sed -n '1,260p' packages/api/src/auth/auth.controller.ts
sed -n '1,540p' packages/api/src/workspace/workspace.service.ts
rg -n "email|AuthUserDto|AuthenticatedUser|invite|session|User" packages/api/src packages/api/test packages/api/scripts -g '*.ts'
rg -n "session\\.user|user\\.email|email" packages/web/src -g '*.ts' -g '*.tsx'
```

### Results

- Worktree started clean on `codex/telegram-auth-plan` tracking `origin/codex/telegram-auth-plan`.
- Confirmed current auth sessions use the `finnn_session` HTTP-only cookie and auth users currently require `email: string`.
- Confirmed workspace invite creation remains email-based and invite acceptance currently rejects missing user email with a generic unauthorized error.
- Confirmed generated API clients must be regenerated after DTO/OpenAPI changes.
- Context7 was requested through available tool discovery but no Context7 tool was exposed in this session.

### Decisions

- Use Telegram OIDC authorization-code flow with PKCE per Telegram docs, not the legacy iframe widget.
- Keep email/password DTOs requiring email while allowing persisted `User.email` and session user email to be nullable.
- Add provider identities through a separate Prisma model to avoid Telegram-specific columns on `User`.

### Subagent Contributions

- Backend explorer subagent started inspecting API auth/session, invite, DTO, and test surfaces.
- Frontend explorer subagent started inspecting login/register/settings, invite UI, generated API usage, and nullable-email assumptions.

### Blockers / Follow-ups

- None for Phase 1.

## 2026-05-30 18:57 +03 - Codex / Developer

### Scope

- Phase 2 backend data model updates.
- Made `User.email` nullable in Prisma and added the provider-based `AuthIdentity` model.
- Regenerated the Prisma client.
- Updated schema-dependent email lookups and DTOs to allow nullable user email where user summaries are returned.
- Added an explicit MongoDB maintenance script to replace old users email indexes with a partial unique email index for string emails only.
- Updated seed-script tests and Mongo script tests for the new lookup/index behavior.

### Files Changed

- `package.json`
- `packages/api/package.json`
- `packages/api/prisma/schema.prisma`
- `packages/api/scripts/db-seed.ts`
- `packages/api/scripts/ensure-indexes.ts`
- `packages/api/src/accounts/accounts.dto.ts`
- `packages/api/src/auth/auth.dto.ts`
- `packages/api/src/auth/auth.service.ts`
- `packages/api/src/auth/auth.types.ts`
- `packages/api/src/debts/debts.dto.ts`
- `packages/api/src/transactions/transactions.dto.ts`
- `packages/api/src/workspace/workspace.dto.ts`
- `packages/api/src/workspace/workspace.service.ts`
- `packages/api/test/db-seed.test.ts`
- `packages/api/test/mongo-scripts.test.ts`
- `docs/plans/telegram-auth/work-log.md`

### Commands Run

```bash
pnpm db:generate
pnpm --filter api typecheck
pnpm --filter api test test/db-seed.test.ts test/mongo-scripts.test.ts
pnpm --filter api check
```

### Results

- `pnpm db:generate`: passed.
- `pnpm --filter api typecheck`: passed after updating test imports.
- `pnpm --filter api test test/db-seed.test.ts test/mongo-scripts.test.ts`: first run failed because the seed test mock still exposed `user.upsert`; passed after updating the mock to `findFirst`/`create`/`update`.
- `pnpm --filter api check`: first run failed on Biome import ordering; passed after sorting imports.

### Decisions

- Removed Prisma's `@unique` from nullable `User.email` to avoid MongoDB's single-null unique-index behavior.
- Added `pnpm db:ensure-indexes` so deployments can explicitly create `users_email_unique_partial` with `partialFilterExpression: { email: { $type: "string" } }`.
- Switched app-level email lookups to `findFirst` while keeping registration/login/invite DTOs email-required.

### Subagent Contributions

- Backend explorer identified the nullable-email Prisma unique-index risk, the needed auth DTO/type changes, invite safety follow-up, and test surfaces.
- Frontend explorer identified generated-client and UI places that will need nullable-email handling after OpenAPI regeneration.

### Blockers / Follow-ups

- Document `pnpm db:ensure-indexes` in operations/development docs during the documentation phase.

## 2026-05-30 19:19 +03 - Codex / Developer

### Scope

- Phase 3 backend auth implementation.
- Added Telegram OIDC authorization-code flow with PKCE, nonce/state validation, token exchange, and JWKS-backed ID-token validation through an injectable Telegram client.
- Added HTTP-only temporary Telegram state cookie helpers.
- Extracted reusable session creation for password and Telegram sign-in.
- Added Telegram login, link start, callback, and unlink endpoints.
- Added Telegram identity linking/unlinking with conflict handling and last-sign-in-method protection.
- Extended session users with Telegram link status.
- Added e2e coverage for Telegram start, existing linked login, first-time nullable-email login, link success, link conflict, unlink success, unlink blocked, invalid state, and nullable-email sessions.

### Files Changed

- `packages/api/package.json`
- `packages/api/src/auth/auth.controller.ts`
- `packages/api/src/auth/auth.dto.ts`
- `packages/api/src/auth/auth.module.ts`
- `packages/api/src/auth/auth.service.ts`
- `packages/api/src/auth/telegram-oidc.client.ts`
- `packages/api/src/auth/telegram-state-cookie.ts`
- `packages/api/test/auth.e2e.test.ts`
- `pnpm-lock.yaml`
- `docs/plans/telegram-auth/work-log.md`

### Commands Run

```bash
pnpm --filter api add jose
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
pnpm --filter api check:fix
```

### Results

- `pnpm --filter api test test/auth.e2e.test.ts`: first run failed due to DTO class order; passed after moving `TelegramAuthStatusDto` before `AuthUserDto`. Final result: 21 tests passed.
- `pnpm --filter api typecheck`: passed.
- `pnpm --filter api check`: first run reported formatting/import ordering; passed after `pnpm --filter api check:fix`.

### Decisions

- Added `jose` for production-grade JWT/JWKS validation.
- Kept Telegram network/token validation in `TelegramOidcClient` so e2e tests can override it without calling Telegram.
- Stored PKCE verifier/nonce in a signed HTTP-only temporary cookie while sending only the random `state` value through Telegram.
- Redirected callback results to the configured `WEB_APP_URL` with relative `returnTo` paths sanitized to same-origin web routes.

### Subagent Contributions

- Backend explorer guidance shaped the session extraction, identity conflict, unlink protection, and invalid-state test coverage.

### Blockers / Follow-ups

- Workspace invite acceptance still needs explicit no-email and email-verification safety updates in Phase 4.
