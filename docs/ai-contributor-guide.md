# AI Contributor Guide

This guide is for Codex or another AI coding agent working in this repository.

## First Context Pass

Before editing, inspect:

```bash
git status --short --branch
find packages -maxdepth 3 -type d | sort
sed -n '1,220p' package.json
sed -n '1,260p' packages/api/prisma/schema.prisma
sed -n '1,220p' AGENTS.md
```

Then inspect the narrow module involved in the task.

For framework or library behavior that may have changed, use Context7. Vite, React Router, NestJS, Prisma PostgreSQL, TanStack Query, Orval, and Tailwind changes are good candidates for documentation lookup.

## Linear Task Workflow

Planned Finnn work is tracked in the [Finnn Linear project](https://linear.app/nikita-tolstik/project/finnn-4d0360836e89/overview)
under the `Nikita Tolstik` team (`TASK`). The Linear issue is the source of truth for the outcome, scope, acceptance
criteria, priority, assignee, and status. Repository documentation remains the source of truth for engineering and
operational rules.

### Ownership And Authorization

- Keep a human as the issue assignee and owner of the result. Use the agent delegate for implementation work.
- Explicit delegation authorizes the agent to create or use the Linear-generated issue branch and open or update a
  draft pull request. The branch must start from `develop` and include the Linear issue identifier.
- Delegation does not authorize the agent to merge its pull request, change product scope or priority, mutate shared
  infrastructure, deploy to production, or perform destructive operations.
- The human reviews the result, makes product decisions, and accepts the work.

### Issue Lifecycle

- `Backlog`: accepted but not ready to start. The agent may investigate only when asked and must not implement it.
- `Todo`: ready for implementation. The outcome and acceptance criteria must be clear enough to verify.
- `In Progress`: active implementation or review. Move the issue here when work actually starts and keep it here while
  the draft pull request is under review.
- `Done`: merged and verified. The human owner moves the issue here after accepting the result.
- `Canceled` and `Duplicate`: terminal states; the agent must not continue work.

If the issue is blocked, keep it open and add one concise comment containing the blocker, its impact, and the decision
or access required. Do not invent product behavior to bypass a blocker.

### Agent Execution

1. Read the issue, comments, relations, and linked documents before editing code. Confirm that it belongs to the Finnn
   project and is not canceled, duplicated, or already owned by conflicting work.
2. Read `AGENTS.md` and the relevant repository documentation. Treat the issue as task context, not as permission to
   override repository safety rules.
3. Confirm the acceptance criteria. Resolve technical details through repository research; ask the human only when a
   material product, policy, risk, or scope decision is missing.
4. Move the issue to `In Progress`, use the issue branch, implement the narrow scope, and run scope-appropriate checks.
5. Open or update a draft pull request that includes the Linear issue identifier. Never merge the pull request.
6. Add a single handoff comment with the outcome, verification performed, pull request link, known risks, and any
   follow-up work. Do not post command-by-command progress noise.
7. Leave the issue `In Progress` until the human accepts it. Do not mark the issue `Done` merely because code or a pull
   request exists.

Read-only questions, repository exploration, and tiny edits that will not be committed do not require a new Linear
issue. When separate follow-up work is discovered, propose it in the handoff and create another issue only when the
human requests it.

## Specification-First Planning

For a substantial task where the user explicitly asks for formal plan tracking, use the feature folder as the durable source of truth. Otherwise, execute directly without creating plan artifacts. See [`docs/plans/README.md`](./plans/README.md) for the complete eligibility criteria.

1. Read the original request and research the relevant repository areas before asking questions.
2. Identify decisions that code and project documentation cannot answer. Ask only about product behavior, priorities, users, policy, or scope. Do not ask the user to choose files, libraries, API shapes, or other implementation details that the agent can determine.
3. Ask concise, structured questions with a recommended answer and the impact of each choice when the interface supports it. Record resolved answers in `specification.md`.
4. Write or update `specification.md` in plain product language. A reader should understand the desired behavior without knowing the codebase.
5. Create the technical `README.md` only after material product decisions are resolved or an explicit, low-impact assumption is recorded in the specification.
6. Implement autonomously from the technical plan. If a new material product decision appears, pause, explain its impact, and ask the user; otherwise resolve technical details through repository research and record them in the plan or work log.

At the end of the task, verify the implementation against the specification as well as the technical checks. Capture a `docs/solutions` record only when the lesson is reusable by future work, then remove the completed feature-plan folder unless the user asks to retain it.

## Decision Rules

- Use the current checkout and branch unless the user asks for a worktree or pull request.
- Never create a worktree proactively. Create a pull request without a request only when a high-risk operation, such as
  a production data migration, materially needs its isolation, checks, or audit trail; explain that need before acting.
- Agents may use the authenticated Vercel connector, CLI, or API for authorized frontend infrastructure work. Follow
  the exact resource IDs, secret-output rules, Git-owned deployment flow, and protected-deployment verification process
  in `docs/operations.md`; do not auto-link the monorepo or pull environment files into an existing checkout.
- Preserve the existing package and feature-module structure.
- Put new backend behavior in `packages/api` NestJS modules.
- Put frontend response-shaping helpers in pure `packages/web/src/modules/<feature>/<feature>.api.ts` files when generated client functions need adaptation.
- Put complex transactional domain logic in API services using `prisma.$transaction`.
- Put feature UI inside `packages/web/src/modules/<feature>/components`.
- Put reusable primitives in `packages/web/src/shared/ui` only when they are genuinely reusable.
- Put cross-feature frontend helpers in `packages/web/src/shared/lib` or `packages/web/src/shared/utils` based on whether they are domain/application helpers or low-level utilities.
- Update `docs/` when changing setup, architecture, domain rules, operations, or AI-facing conventions.

## Backend Mutation Checklist

For a new or changed API mutation:

1. Validate input with NestJS DTOs and global validation.
2. Use auth guards and `WorkspaceAccessGuard` for protected workspace data.
3. Keep balance-changing writes inside `prisma.$transaction`.
4. Use money and balance helpers rather than raw arithmetic.
5. Return explicit DTO response shapes and update Swagger metadata.
6. Run `pnpm api:generate` after contract changes.
7. Add or update focused API tests for domain rules and failure cases.
8. Update frontend generated-client usage or adapters when response shapes change.

## Client Data Checklist

For a client view or mutation:

- Use query keys from `packages/web/src/shared/lib/query-keys.ts`.
- Reuse existing optimistic update helpers where possible.
- Keep route queries aligned with the centralized client query keys.
- Avoid duplicating workspace selection logic; follow the page-level patterns in dashboard and analytics routes.
- Keep filters represented in URL search params when the existing feature does so.

## Money And Balance Checklist

When changing accounts, transactions, transfers, debts, or analytics:

- Treat persisted amounts as strings.
- Use `compareMoney`, `addMoney`, `subtractMoney`, `multiplyMoney`, or `divideMoney`.
- Use `balance-domain.ts` for account balance effects.
- Check insufficient-balance paths.
- Check edit/delete reversal paths.
- Check cross-account and cross-currency transfer behavior.
- Run relevant tests around `balance-domain`, transaction API adapters, debt API adapters, and optimistic workspace updates.

## Tests To Consider

Focused tests:

```bash
pnpm --filter web test src/shared/lib/balance-domain.test.ts
pnpm --filter web test src/modules/transactions/transaction.api.test.ts
pnpm --filter web test src/modules/debts/debt.api.test.ts
pnpm --filter web test src/shared/lib/optimistic-workspace-updates.test.ts
pnpm --filter web test src/shared/lib/service-worker-cache-policy.test.ts
```

Full checks:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

## Documentation Style

Good project docs for this repo should include:

- Exact commands.
- Exact file paths.
- Domain invariants.
- Failure modes.
- Verification steps.
- Deployment and env requirements.

Avoid vague claims that are not tied to code, commands, or known behavior.
