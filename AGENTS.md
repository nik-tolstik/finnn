# Finnn Agent Guide

## Project And Sources Of Truth

Finnn is a personal and shared finance tracker in a `pnpm` monorepo.

- `packages/web` is the Vite React SPA.
- `packages/api` is the NestJS API backed by Prisma and PostgreSQL.
- `packages/postgres-backup` is the isolated encrypted PostgreSQL backup service.

Read only the documentation relevant to the task:

- `docs/development.md` for local setup, scripts, environment conventions, and toolchain details.
- `docs/architecture.md` for package boundaries, request/data flow, and frontend structure.
- `docs/domain-model.md` for finance and persistence invariants.
- `docs/design-system.md`, `docs/account-icons.md`, and `docs/category-icons.md` for UI and asset conventions.
- `docs/operations/README.md` and `docs/postgresql-backups.md` for safe operational procedures and ways to discover current infrastructure state.
- `docs/ai-contributor-guide.md` for detailed task checklists.

Code, configuration, schemas, generated contracts, and provider state are authoritative for facts that can change independently of documentation.

## Required Workflow

- Use `pnpm`. Do not use `npm` or `yarn` unless the repository itself requires it.
- Inspect the current branch, working tree, and narrow task scope before editing. Preserve unrelated user changes and never revert them without an explicit request.
- Work in the current checkout and branch by default. Do not create a worktree or pull request unless the user asks, except for the delegated Linear workflow below. If repository protections or an unusually risky operation require a pull request, explain why and obtain confirmation first.
- Do not edit on `main` unless the user explicitly requests it. If the current branch is `main`, first confirm the working tree is clean and `develop` is the intended target; otherwise ask before switching branches.
- When the user requests a worktree, copy `packages/web/.env` and `packages/api/.env` as opaque files without reading or printing their contents.
- Prefer existing project patterns over new abstractions.
- Use Context7 for current library or framework behavior when it is available; otherwise use authoritative upstream documentation.
- Use available subagents only for bounded, independent work where parallel execution materially reduces risk or latency.
- For a user request that will result in a committed code or repository-documentation change, create or update the
  corresponding Product Change issue in the Finnn Linear project and follow the Linear task workflow in
  `docs/ai-contributor-guide.md`. Read-only questions, repository exploration, tiny edits that will not be committed,
  and an explicit request to work without Linear do not require an issue.
- Explicit delegation of a Finnn Linear issue authorizes the agent to create or use its issue branch and open or update its draft pull request. It does not authorize a worktree, production change, destructive action, or infrastructure mutation. An agent may merge only when the user explicitly authorizes that exact merge separately.
- Keep code comments and documentation in English.
- Do not run screenshot or browser-automation QA unless the user explicitly requests it.
- When browser QA is explicitly requested, use the project Playwright workflow in `docs/browser-testing.md`.

## External Review

- Follow the active global `AGENTS.md` for the external reviewer, model, invocation, read-only restrictions, and finding-classification procedure. Do not duplicate those details here.
- Run external review only when the user explicitly requests it or immediately before an agent-performed merge into `develop` or `main`. The pre-merge case is repository-level authorization to run the globally configured reviewer.
- Do not run external review for ordinary implementation, local validation, or Draft PR updates that are not being merged.
- Verify every external finding against the source code and tests. Classify it as confirmed, rejected, or uncertain, and explain disagreements before applying fixes.
- After confirmed fixes, repeat only the focused review needed to validate them. Repeat a full review only when fixes materially change architecture, API contracts, persistence, security, concurrency, or state/data flow.

## Scope-Appropriate Verification

Start with the smallest relevant checks and broaden only when the changed boundary requires it.

- Presentation-only frontend: inspect the diff and UI source, run relevant targeted tests when they exist, then run `pnpm --filter web typecheck` and `pnpm --filter web check`.
- Isolated frontend logic: run targeted web tests, `pnpm --filter web typecheck`, `pnpm --filter web check`, and `pnpm --filter web build`.
- Isolated API behavior: run targeted API tests, `pnpm --filter api typecheck`, and `pnpm --filter api check`. Add `pnpm --filter api build` when module wiring or production compilation may be affected.
- API contract changes: run `pnpm api:generate` and `pnpm api:check-generated`, then verify affected API and web consumers.
- Prisma schema changes: run `pnpm db:generate`, create and review the required migration, and run affected API checks. Never use `db push` for shared environments.
- Backup-service changes: run `pnpm --filter postgres-backup check` and `pnpm --filter postgres-backup test`.
- Cross-package, dependency, shared configuration, migration, or similarly broad changes: run affected targeted checks first, then one final root-level suite with the relevant commands from `pnpm typecheck`, `pnpm check`, `pnpm test`, and `pnpm build`.

Do not run unrelated API, database, or backup tests for an isolated frontend change. Run Storybook only when stories or a component rendering/API contract changes. When external review is triggered, use this order: implementation, targeted validation, external review, confirmed fixes, one final scope-appropriate validation, then merge or handoff.

## Critical Implementation Rules

- Put new backend behavior in `packages/api` NestJS modules. Use DTO validation, auth and workspace guards, explicit Swagger metadata, and focused API tests for endpoints.
- Keep complex read-modify-write logic in API services using `packages/api/src/prisma/serializable-transaction.ts`. Pass the active `Prisma.TransactionClient` into composed methods instead of opening nested transactions.
- Keep database transactions short. Never hold them across email, Telegram, object-storage, or other network I/O; use an atomic claim/outbox or an explicit compensating workflow.
- A scheduled-payment occurrence is unique by `(scheduledPaymentId, dueAt)`. Paying or skipping it must atomically create history, apply any financial transaction, and advance `nextDueAt`.
- Enforce authentication and workspace authorization in the API with auth guards and `WorkspaceAccessGuard`.
- Keep money values as strings. Use `packages/api/src/common/money.ts` for persisted logic and the frontend money and balance helpers for UI/cache projections.
- `Account.hidden` is the authenticated user's personal dashboard-card preference. It must not affect account access or financial-form and analytics data.
- Preserve `Account.balance = Account.initialBalance + transaction deltas` when changing the opening balance.
- Do not edit `packages/web/src/shared/api/generated` manually. Regenerate the OpenAPI contract and web client after API contract changes.
- Use TanStack Query keys from `packages/web/src/shared/lib/query-keys.ts` and existing optimistic update helpers instead of ad hoc cache shapes.
- Follow `docs/design-system.md` and reuse existing shared app controls instead of native browser controls for app-facing forms.
- Keep protected app routes client-rendered behind the client auth gate; API guards remain the security boundary.
- Do not cache financial documents, API responses, protected routes, or data responses in the service worker.
- Package-level `biome.json` files must extend the workspace root with `"extends": "//"`.

## Infrastructure Safety

- Perform infrastructure mutations only when the user has authorized that scope. Before every mutation, resolve the exact provider, project/team, environment, service/project, branch, and deployment or resource ID.
- Follow `docs/operations/README.md` for Railway and Vercel procedures. Prefer commands that query current provider state over copied identifiers or topology snapshots.
- Treat environment values, database URLs, access keys, encryption identities, tokens, bucket credentials, and protected share URLs as secrets. Never print raw values; capture and filter output to the required metadata.
- Do not run `vercel link`, `vercel pull`, or `vercel env pull` in an existing checkout unless the task explicitly requires local linking or environment synchronization.
- Use committed Prisma migrations and `DIRECT_URL` for migration/administrative access. Use `DATABASE_URL` for API runtime access and recalculate the connection budget before adding replicas.
- Restore backups only into a separate database during rehearsals or verification.

## Documentation And Agent-Rule Quality

- Update the narrow canonical document that owns the changed behavior. Update `AGENTS.md` only for durable, cross-task agent instructions.
- Write stable documentation: describe intent, invariants, boundaries, procedures, exact commands, verification, and failure modes.
- Do not record fast-changing snapshots such as current deployment state, temporary URLs, resource IDs, quotas, package-version inventories, or exhaustive file/module lists. Point to configuration, code, schemas, package manifests, provider state, or a command that discovers the current value.
- Keep one canonical source for each rule or fact and link to it instead of copying paragraphs across `AGENTS.md`, README files, plans, and operational guides.
- Prefer rules that are actionable and verifiable. Avoid vague advice, historical narration, speculative future requirements, and absolute wording without a defined scope or exception.
- Use mandatory language only for correctness, security, data integrity, or an explicit project policy. Express conventions and heuristics as defaults or preferences.
- Keep each rule focused on one concern. Include the scope, required action, and exception only when each is necessary to make the rule unambiguous.
- Before adding an `AGENTS.md` rule, confirm that it is broadly reusable, likely to remain valid, not already enforced by code or tooling, and not owned by the global `AGENTS.md` or a canonical project document.
- When a change makes documentation or an agent rule stale, update or remove it in the same change. Do not preserve obsolete guidance for historical context; use Git history when that context is needed.
- Keep README files concise and navigational. Put detailed guidance in the canonical topic document without duplicating it elsewhere.
