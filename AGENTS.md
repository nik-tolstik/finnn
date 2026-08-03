# Finnn Agent Guide

## Project Snapshot

Finnn is a personal and shared finance tracker in a `pnpm` monorepo.

- `packages/web` is a Vite-powered React SPA routed with React Router and built with TypeScript, TanStack Query, Tailwind CSS, and Orval-generated API clients. Exchange-rate UI is shared across transaction and debt forms rather than owned by a standalone frontend module.
- `packages/api` is the NestJS backend built with TypeScript, Prisma, PostgreSQL, OpenAPI, and Vitest.
- `packages/postgres-backup` is the isolated Railway cron service that streams `pg_dump` through `age` and verifies
  encrypted S3-compatible uploads.

The app manages workspaces, members, accounts, categories, payment transactions, transfers, debts, analytics, exchange rates, PostgreSQL persistence, and PWA static asset caching.

## Required Workflow

- Use `pnpm` as the package manager. Do not use `npm` or `yarn` unless the repository explicitly requires them.
- Use Context7 for library and framework documentation when it is relevant.
- Use subagents for parallel code analysis, implementation, or verification when they can reduce risk or latency.
- Work in the current checkout and branch by default. Do not create a Git worktree or GitHub pull request unless the
  user explicitly requests one.
- A pull request may be created without an explicit request only when it is materially necessary to complete unusually
  risky work safely, such as a production data migration, or when repository protections require it. Explain the need
  to the user before creating the pull request. There is no equivalent exception for worktrees.
- When creating a worktree, transfer the `packages/web/.env` and `packages/api/.env` files as opaque files without reading their contents.
- Do not revert user changes unless the user explicitly requests it.
- Do not work directly on `main` unless the user explicitly asks for it. If the current branch is `main`, switch to `develop` before making changes.
- Agents may inspect Railway and, when the user has authorized the infrastructure change, manage services, variables,
  deployments, resource limits, cron schedules, buckets, and environment configuration through the authenticated
  Railway CLI or API. Resolve the exact project, environment, and service before every mutation.
- Treat Railway variable and bucket-credential output as secret-bearing. Never print raw values, database URLs, access
  keys, or private encryption identities; capture and filter them locally when verification is required.
- Agents may inspect Vercel and, when the user has authorized the frontend infrastructure change, manage project
  settings, environment variables, deployments, aliases, and domains through an authenticated Vercel connector, CLI,
  or API. Resolve the exact team, project, environment, Git branch, and deployment before every mutation; use explicit
  scopes or resource IDs and follow the branch-owned Git deployment flow documented in `docs/operations.md`.
- Treat Vercel environment values, access tokens, deployment-protection bypass tokens, and temporary share URLs as
  secret-bearing. Never print raw values or tokens; filter API output to the required metadata. Use `vercel curl` for
  protected Preview/DEV checks instead of weakening deployment protection. Do not run `vercel link`, `vercel pull`, or
  `vercel env pull` in an existing checkout unless the task requires local linking or environment synchronization,
  because those commands create local project state or can overwrite local environment files.
- Prefer existing project patterns over introducing new abstractions.
- Keep comments in English.
- Do not run Browser screenshot QA with Playwright, `agent-browser`, or similar browser automation unless the user explicitly asks for screenshot/browser QA.

## Formal Plan Tracking

- Create or use formal implementation plans, `docs/plans/...` directories, work logs, or plan-tracking tools only when
  the user explicitly asks to create or use a plan, or explicitly says the current task continues a named existing plan.
- Task complexity, multi-agent work, a branch, worktree, PR, or an existing plan file do not authorize formal plan
  tracking.
- When a user supplies a plan in chat, follow it without persisting it to repository documentation unless the user
  explicitly requests that persistence.
- Without explicit opt-in, execute directly with normal internal reasoning and concise commentary.
- Update a plan work log only when the current user request explicitly invokes that plan and asks for logging, or the
  invoked plan explicitly requires it.

## Efficient Iteration And Verification

- These defaults are overridden by explicit user instructions, including explicit use of a formal plan.
- Treat consecutive follow-ups on an existing Draft PR as one iteration batch until the final handoff or the user
  changes scope.

- Select validation from this matrix:
  - Presentation-only frontend: inspect the changed diff and UI source, then run relevant targeted tests when they
    exist plus web typecheck and web check. Do not require a production build or Storybook by default.
  - Isolated frontend logic: run targeted feature tests plus web typecheck, web check, and web production build.
    Run Storybook only when stories or a component API/rendering contract changes.
  - Cross-package, API, schema, configuration, or dependency changes: run affected package checks. Run one full
    root-level or broad suite during final validation, or whenever the explicit task scope requires it. Include
    generated-client, migration, infrastructure, or backup checks when the changed boundary requires them.

- Do not run unrelated API, database, or backup tests for an isolated frontend change.
- Run one full root-level or broad suite only during final validation for cross-package changes or when the task
  explicitly requires it.
- Executors run targeted checks while implementing. An independent verifier runs the final scope-appropriate broad
  validation; do not duplicate the same full suite in both roles.
- Use this order: implementation, targeted validation, external review, confirmed fixes, one final broad validation,
  then push and update the PR.
- Run external review once for each cohesive diff. After confirmed findings, rerun a focused review of the fixes;
  repeat the full review only for architecture, API, persistence, security, concurrency, or significant state/data-flow
  changes.
- Style, copy, documentation, and test-only changes are not substantial changes for deciding whether to repeat broad
  validation or a full external review.
- Consolidate explicitly requested plan work-log and PR-body updates for an iteration batch instead of creating
  process-only follow-up commits or PR edits.
- For an already validated Draft PR, do not wait for remote CI before publishing a follow-up unless the user or
  repository policy requires it.
- If an isolated frontend follow-up exceeds 15 minutes, report the cause before running more broad checks.

## Key Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm check
pnpm test
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm backup:test
```

Use `pnpm check`, `pnpm typecheck`, and targeted `pnpm test` runs before finishing non-trivial changes.

The package-local `tsc` commands use TypeScript 7 through the `@typescript/native` alias. The `typescript` dependency intentionally aliases `@typescript/typescript6` for tools that still require the legacy compiler API; keep both aliases unless all Nest, Vite, Storybook, and Orval tooling has moved to the TypeScript 7 API.

## Architecture Map

- `packages/web/src/app` contains the SPA composition root and React Router route tree.
- `packages/web/src/routes` contains route layouts and route entry components.
- `packages/web/src/providers` contains application-wide client providers.
- `packages/web/src/styles` contains global styles.
- `packages/web/src/modules` contains frontend feature modules: accounts, analytics, auth, categories, debts, scheduled payments, transactions, and workspace. Account dashboard visibility is personal to the authenticated user; do not use it to filter account choices in financial forms.
- `packages/web/src/shared/hooks/useCurrencyAmountSync.ts` and `packages/web/src/routes/dashboard/components/dashboard-exchange-rates.tsx` contain the cross-cutting frontend exchange-rate behavior.
- `packages/web/src/shared/api/generated` contains Orval-generated API client functions and types. Do not edit generated files manually.
- `packages/web/src/shared/lib` contains frontend session, query keys, cache invalidation, optimistic updates, balance helpers, and domain types.
- `packages/web/src/shared/ui` contains reusable primitive UI components.
- `packages/web/src/shared/components` contains reusable composed components.
- `packages/web/src/shared/utils` contains low-level utilities such as money formatting and arithmetic.
- `packages/web/public/sw.js` controls the PWA service worker cache policy.
- `packages/api/src` contains NestJS modules, controllers, DTOs, guards, services, auth/session ownership, cron, email, and finance domain logic.
- `packages/api/prisma/schema.prisma` and `packages/api/prisma/migrations` are the source of truth for database tables,
  relations, indexes, enums, and reviewed SQL migrations.
- `packages/api/scripts` contains seed, operational helpers, and OpenAPI generation scripts.
- `packages/postgres-backup` contains the PostgreSQL 18 backup image, streaming age encryption, verified object-storage
  upload, restore helper, tests, and Railway cron configuration.
- `biome.json` is the workspace root configuration anchor. Package-level `biome.json` files must extend it with `"extends": "//"` so CLI and VS Code resolve the same nested configuration.
- `docs` contains human and AI-facing project documentation.
- `docs/plans` is reserved for user-requested feature implementation plans and their work logs.

## Implementation Rules

- New backend behavior should live in `packages/api` NestJS modules, not in `packages/web`.
- Backend endpoints should use DTO validation, guards, explicit Swagger metadata, and API tests.
- Complex transactional business logic should live in API services. Use
  `packages/api/src/prisma/serializable-transaction.ts` for read-modify-write invariants and pass the active
  `Prisma.TransactionClient` into composed service methods instead of opening nested transactions.
- Keep database transactions short and never hold them across email, Telegram, object-storage, or other network I/O.
  Use an atomic database claim/outbox or an explicit compensating workflow for those boundaries.
- A scheduled-payment occurrence is unique by `(scheduledPaymentId, dueAt)`. Paying or skipping an occurrence must
  atomically create its history row, apply any financial transaction, and advance `nextDueAt`.
- Check authentication and workspace authorization in the API with auth guards and `WorkspaceAccessGuard`.
- Keep money values as strings. Use backend money helpers in `packages/api/src/common/money.ts` for persisted logic and frontend helpers in `packages/web/src/shared/utils/money.ts` and `packages/web/src/shared/lib/balance-domain.ts` for UI/cache projections.
- `Account.hidden` is the current user's personal dashboard-card preference. It must not change account access or remove the account from transaction, transfer, debt, scheduled-payment, or analytics data.
- `Account.balance` is the current materialized balance and `Account.initialBalance` is the opening balance. When changing the opening balance, keep the invariant `balance = initialBalance + transaction deltas`.
- Regenerate OpenAPI and the web client after API contract changes with `pnpm api:generate`; verify drift with `pnpm api:check-generated`.
- Use TanStack Query keys from `packages/web/src/shared/lib/query-keys.ts`; do not invent ad hoc key shapes.
- When client mutations need immediate UI feedback, prefer the existing optimistic update helpers in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`.
- For app-facing web forms, use the shared UI controls instead of native browser controls: `shared/ui/select` for option dropdowns, `DatePicker` or `DateTimePicker` for dates, `AccountSelector`/`SelectAccountDialog` for account selection, `UserDisplay`/`UserAvatar` for user choices, and `CURRENCY_OPTIONS` for currency choices.
- Keep protected app routes (`/dashboard`, `/analytics`, `/debts`, `/payments`) client-rendered: avoid route-loader session/data dependencies, and use TanStack Query for cached server state.
- Use the client auth gate for protected app routes; API auth guards remain the security boundary.
- Do not cache financial documents, API responses, dashboard routes, or data responses in the service worker.
- Do not use Tailwind's `tabular-nums` class. Use proportional typography for money and numeric UI, and solve alignment with layout instead.
- For company/product brand logos, use `svgl.app` as the preferred source. Copy only the specific SVGs needed into local assets or small React SVG components; do not add an icon-pack dependency or runtime SVGL fetch for a handful of logos. If a brand has stricter sign-in/button guidelines, such as Google Sign-In, prefer the official approved sign-in mark over a heavier generic SVGL logo.

## Data And Infrastructure Notes

- The database is PostgreSQL through Prisma with `provider = "postgresql"`.
- Local PostgreSQL runs through `docker-compose.yml` on port `5432`.
- Run `pnpm db:generate` after schema changes.
- Run `pnpm db:migrate:dev` to create and apply a reviewed local SQL migration. Railway applies committed migrations
  with `pnpm db:migrate:deploy` in `preDeployCommand` for DEV and PROD; do not use `db push` for shared environments.
- Use `DATABASE_URL` for API runtime connections and `DIRECT_URL` for migration and administrative connections. They
  may be identical locally; in hosted environments `DATABASE_URL` may be pooled while `DIRECT_URL` must bypass the pool.
- Railway API runtimes connect as the least-privilege `finnn_app` role with `connection_limit=5`, `pool_timeout=10`,
  and `connect_timeout=5`. `DIRECT_URL` retains the administrative role for Prisma Migrate. Recalculate the total pool
  budget before adding API replicas.
- Shared Railway PostgreSQL instances use `max_connections=50`, `effective_cache_size=512MB`, and
  `idle_in_transaction_session_timeout=60s`; `pg_stat_statements` is enabled for evidence-based query tuning.
- Back up PostgreSQL with `pg_dump` and restore with `pg_restore`; rehearse restores against a separate database.
- Railway project and service IDs, branch mappings, safe CLI usage, and the current deployment topology are documented
  in `docs/operations.md`. The main local checkout may be linked to Production, so pass explicit project, environment,
  and service identifiers for infrastructure mutations.
- Vercel team/project IDs, branch and domain mappings, safe authenticated CLI/API usage, and deployment verification
  commands are documented in `docs/operations.md`.
- `packages/api/.env` owns backend secrets such as `DATABASE_URL`, `DIRECT_URL`, `API_AUTH_SECRET`, `API_COOKIE_SECRET`,
  email variables, and `CRON_SECRET`.
- `packages/web/.env` owns browser-safe variables such as `VITE_API_URL`.
- Vercel web domains: PROD `https://finnn.xyz`, DEV `https://dev.finnn.xyz`.
- Railway API domains: PROD `https://api.finnn.xyz`, DEV `https://api-dev.finnn.xyz`.
- Telegram uses two bots: one PROD bot for production domains and one DEV bot for DEV plus localhost/ngrok testing.
- `RESEND_API_KEY` and `EMAIL_FROM` are required for email delivery in all environments.
- Backend scheduling should call the API endpoint `/cron/update-exchange-rates` with `Authorization: Bearer <CRON_SECRET>`.

## Documentation Expectations

- Update `AGENTS.md` and `docs/` when changing architecture, setup, data model, workflows, deployment, or agent-facing conventions.
- When the user explicitly invokes `docs/plans/<feature>`, follow that plan and update its work log only when the
  request or plan explicitly requires logging.
- Keep README concise and link to detailed docs instead of duplicating large sections.
- Prefer concrete file paths, commands, invariants, and failure modes over generic descriptions.
