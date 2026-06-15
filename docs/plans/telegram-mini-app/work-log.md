# Telegram Mini App Work Log

This file is the required execution history for the Telegram Mini App project.

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

## 2026-06-15 16:53 +03 - Codex / Planning

### Scope

- Created the initial implementation plan for Telegram Mini App support.
- Captured the product decision to reuse the existing Finnn web UI and routes as the Mini App experience.
- Captured the technical decision to add global Telegram Mini App bootstrap through `window.Telegram.WebApp.initData`
  instead of making `/mini` the primary route.
- Created this work log so future Developer agents can leave execution history.
- Created a short orchestration prompt that points future agents to the plan as the source of truth.

### Files Changed

- `docs/plans/telegram-mini-app/README.md`
- `docs/plans/telegram-mini-app/work-log.md`
- `docs/plans/telegram-mini-app/prompt.md`

### Commands Run

```bash
sed -n '1,420p' docs/plans/telegram-auth/README.md
sed -n '1,220p' docs/plans/telegram-auth/prompt.md
sed -n '1,140p' docs/plans/telegram-auth/work-log.md
find docs/plans -maxdepth 2 -type f | sort
mkdir -p docs/plans/telegram-mini-app
date '+%Y-%m-%d %H:%M %z %Z'
sed -n '1,260p' docs/plans/telegram-mini-app/README.md
sed -n '260,620p' docs/plans/telegram-mini-app/README.md
sed -n '1,220p' docs/plans/telegram-mini-app/work-log.md
sed -n '1,180p' docs/plans/telegram-mini-app/prompt.md
git status --short
```

### Results

- Planning documents were created.
- No code implementation was started.

### Decisions

- Use existing Finnn routes as the Mini App entry surface.
- Add Mini App-specific authentication through validated Telegram WebApp `initData`.
- Preserve the existing HTTP-only `finnn_session` model unless real Telegram WebView testing proves cookies do not work.
- Treat `/mini` as an optional future route, not the MVP route.

### Subagent Contributions

- Backend explorer confirmed current auth uses HTTP-only cookie sessions, Telegram OIDC identities already live in
  `AuthIdentity`, finance APIs are reusable, and Mini App auth still needs an `initData` validation endpoint.
- Frontend explorer confirmed the existing dashboard is client-session-driven, mobile-aware, and can be reused if
  `DashboardAuthGate` waits for Telegram bootstrap before redirecting.

### Blockers / Follow-ups

- Implementation not started.
- Real Telegram client testing will be required during implementation.

## 2026-06-15 17:00 +03 - Codex / Developer

### Scope

- Completed Phase 1 preparation for Telegram Mini App implementation.
- Read the full Mini App plan, prompt, work log, and root `AGENTS.md`.
- Inspected git branch/remotes and created `codex/telegram-mini-app` from `develop` to avoid checkpoint pushes directly to
  `develop`.
- Inspected existing Telegram OIDC auth, nullable-email user support, HTTP-only session cookies, API session client,
  dashboard auth gate, providers, generated API layout, Prisma identity schema, and auth e2e test harness.
- Checked current Telegram Mini App official docs for `initData`, `ready()`, `expand()`, and validation rules.
- Used Context7 for TanStack Query v5 cache refresh guidance after login/session mutations.

### Files Changed

- `docs/plans/telegram-mini-app/work-log.md`

### Commands Run

```bash
sed -n '1,260p' docs/plans/telegram-mini-app/prompt.md
sed -n '1,320p' docs/plans/telegram-mini-app/README.md
sed -n '321,760p' docs/plans/telegram-mini-app/README.md
sed -n '1,260p' docs/plans/telegram-mini-app/work-log.md
sed -n '1,260p' AGENTS.md
git status --short --branch
git remote -v
git branch --show-current
git ls-remote --heads origin codex/telegram-mini-app
git switch -c codex/telegram-mini-app
sed -n '1,260p' packages/api/src/auth/auth.controller.ts
sed -n '1,980p' packages/api/src/auth/auth.service.ts
sed -n '1,360p' packages/api/src/auth/auth.dto.ts
sed -n '1,90p' packages/api/prisma/schema.prisma
sed -n '1,260p' packages/web/src/app/providers.tsx
sed -n '1,260p' packages/web/src/app/'(dashboard)'/components/DashboardAuthGate.tsx
sed -n '1,280p' packages/web/src/shared/lib/api-session-client.tsx
sed -n '1,180p' packages/web/src/shared/api/http-client.ts
grep -RIn "telegram\|AuthIdentity\|auth/session\|register\|login" packages/api/test packages/api/src --include='*test.ts' --include='*.spec.ts' | head -240
date '+%Y-%m-%d %H:%M %z %Z'
```

### Results

- Branch state was `develop...origin/develop` with `docs/plans/telegram-mini-app/` untracked.
- No remote `codex/telegram-mini-app` branch existed; local feature branch was created.
- Existing Telegram auth and nullable-email work is present:
  - `AuthIdentity` uses `provider = "telegram"` plus `providerUserId`.
  - Telegram OIDC login already creates nullable-email users.
  - Sessions are still HTTP-only `finnn_session` cookies.
- `rg` was unavailable in this environment, so `grep`/`find` were used.

### Decisions

- Keep the implementation additive on the existing auth/session architecture.
- Reuse existing Telegram identity helpers where possible so OIDC and Mini App auth stay aligned.
- Use the existing auth e2e file for Mini App cases because it already mocks Prisma and Telegram identity/session flows.
- Use a small global web bootstrap inside current providers and keep existing routes/UI unchanged.

### Subagent Contributions

- None. A dedicated subagent tool is not exposed in this session; parallel command execution was used for bounded
  investigation instead.

### Blockers / Follow-ups

- Real Telegram client testing remains blocked until deployed URLs and PROD/DEV bot configuration are available.
- Phase 2 should add backend validation, endpoint, and e2e coverage.

## 2026-06-15 17:05 +03 - Codex / Developer

### Scope

- Completed Phase 2 backend Telegram Mini App authentication.
- Added `POST /auth/telegram-mini/session` with Swagger metadata and the existing HTTP-only `finnn_session` cookie.
- Added `TelegramMiniAppSessionDto`.
- Added server-side Telegram Mini App `initData` validation using raw query-string data, sorted data-check string,
  HMAC-SHA-256 signature comparison, `auth_date` freshness, and required Telegram user id parsing.
- Reused existing Telegram identity lookup/create/update logic and `AuthService.createSessionForUser`.
- Added e2e coverage for missing init data, invalid hash, stale `auth_date`, missing user, existing identity sign-in,
  first-time nullable-email user creation, and Telegram profile metadata updates.

### Files Changed

- `packages/api/src/auth/auth.controller.ts`
- `packages/api/src/auth/auth.dto.ts`
- `packages/api/src/auth/auth.service.ts`
- `packages/api/src/auth/telegram-mini-app.ts`
- `packages/api/test/auth.e2e.test.ts`
- `docs/plans/telegram-mini-app/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
pnpm --filter api exec biome check . --write
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
git status --short --branch
git diff --stat
```

### Results

- `pnpm --filter api test test/auth.e2e.test.ts`: passed, 31 tests.
- `pnpm --filter api typecheck`: passed.
- Initial `pnpm --filter api check`: failed on formatting/import ordering only.
- `pnpm --filter api exec biome check . --write`: fixed three API files.
- Final `pnpm --filter api check`: passed.

### Decisions

- Keep Telegram Mini App identities in the existing `provider = "telegram"` namespace so OIDC login/linking and Mini App
  login resolve to the same Finnn account.
- Use `TELEGRAM_BOT_TOKEN` for Mini App `initData` validation and keep OIDC `TELEGRAM_CLIENT_*` variables unchanged.
- Default `TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS` to 24 hours to match the MVP plan and avoid over-tightening launch UX.
- Commit generated OpenAPI/Orval artifacts in Phase 3 after explicitly running `pnpm api:generate`.

### Subagent Contributions

- None. No dedicated subagent tool is exposed in this session.

### Blockers / Follow-ups

- Generated API artifacts are expected to be handled in Phase 3.
- Real Telegram client cookie/WebView testing remains pending external bot/deployment access.
