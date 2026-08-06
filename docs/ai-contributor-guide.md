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

## Task Capture And Refinement Workflow

Treat task capture, clarification, specification, and implementation as separate user authorizations. Do not infer a
later phase from an earlier command. In particular, a request to create a task is not permission to implement it.

| Conversation phase | Explicit user intent | Agent behavior | Linear state |
| --- | --- | --- | --- |
| Capture | “Create a task” | Create or reuse the task, preserve the user's message under `Исходные мысли`, and infer only a short title and required metadata. Do not rewrite the request, add a full specification, ask implementation questions, or edit code. | `Backlog` |
| Clarification | “Let's discuss it” | Ask questions, surface decisions, and append agreed context to the same task. Keep the original thoughts unchanged. Do not edit code or treat the discussion as implementation approval. | `Backlog` |
| Specification | “Format the task” | Convert the agreed context into the required Product Change sections, while retaining `Исходные мысли` separately. Resolve acceptance criteria and scope, then move the issue to `Todo` when it is ready. Do not edit code. | `Todo` |
| Implementation | “Implement the task” | Start implementation only after this explicit authorization, after the task has passed Specification, and after the outcome and acceptance criteria are clear. If the task is still in Capture or Clarification, do not code; ask the user to format it first. Move the issue to `In Progress` when coding starts. | `In Progress` |

The capture phase is intentionally lightweight. A draft Product Change issue may contain only the original user text in
`Исходные мысли` plus the required owner, type label, team, project, and status metadata. Do not invent missing scope,
non-goals, acceptance criteria, or technical decisions to make a draft look complete. Fill those sections during the
specification phase.

When the user sends more thoughts while a task is in Capture or Clarification, preserve the earlier text and add the new
message as additional context. Never silently replace the original wording. Apply the repository's secret-handling
rules before storing user text.

If the user's wording is ambiguous between discussing, formatting, and implementing, remain in the current phase and ask
which phase they want. “Let's discuss” and “format the task” never authorize code changes by themselves.

## Linear Task Workflow

Planned Finnn work is tracked in the [Finnn Linear project](https://linear.app/nikita-tolstik/project/finnn-4d0360836e89/overview)
under the `Nikita Tolstik` team (`TASK`). The Linear Project, issues, and linked documents are the source of truth for
desired behavior, scope, acceptance criteria, product decisions, priority, assignee, and task state. Code, schemas,
generated contracts, and tests are the source of truth for executed behavior. Repository documentation remains the
source of truth for stable engineering, domain, setup, and operational rules.

### Ownership And Authorization

- Keep a human as the issue assignee and owner of the result. Use the agent delegate for implementation work.
- A user request to implement a planned code or repository-documentation change is explicit delegation. It authorizes
  the agent to create or update the corresponding Product Change issue, use its task branch, and open or update a draft
  pull request. The branch must start from `develop` and include the Linear issue number.
- Delegation alone does not authorize the agent to merge its pull request, change product scope or priority, mutate
  shared infrastructure, deploy to production, or perform destructive operations. An agent may merge only when the
  user explicitly authorizes that exact merge separately.
- The human reviews the result, makes product decisions, and accepts the work.

### Agent Branch Naming

New agent task branches use the following format:

```text
task-<issue-number>-<short-kebab-case-slug>
```

For example:

```text
task-142-add-account-archive
task-207-fix-scheduled-payment-advance
```

Use the Linear issue number as the numeric segment, followed by a short descriptive slug in lowercase kebab-case. Do
not add an agent name, model name, date, or another prefix. Create the branch from `develop` and use one task branch per issue.
When a compliant branch already exists, reuse it instead of creating a duplicate.

### Issue Lifecycle

- `Backlog`: accepted but not ready to start. The agent may investigate only when asked and must not implement it.
- `Todo`: ready for implementation. The outcome and acceptance criteria must be clear enough to verify.
- `In Progress`: active implementation. Move the issue here when work actually starts.
- `In Review`: the draft pull request is ready for review. Keep the issue here until the pull request is merged.
- `Dev`: the pull request has been merged into `develop`. The agent moves the issue here immediately after merge, then
  completes or confirms the required verification. If verification is pending or fails, keep the issue here and add
  a blocker comment; do not mark the issue `Done`.
- `Done`: merged, verified, and accepted by the human owner. The human owner moves the issue here, or explicitly asks
  the agent to do so.
- `Canceled` and `Duplicate`: terminal states; the agent must not continue work.

If the issue is blocked, keep it open and add one concise comment containing the blocker, its impact, and the decision
or access required. Do not invent product behavior to bypass a blocker.

### Agent Execution

1. For a user-requested change that will be committed, search the Finnn Project for a matching active issue. Reuse it
   when it has the same outcome and no conflicting owner; otherwise create a Product Change issue before editing,
   following the mandatory intake metadata rules below.
2. Read the issue, comments, relations, and linked documents. Confirm that it belongs to the Finnn project and is not
   canceled, duplicated, or already owned by conflicting work.
3. Read `AGENTS.md` and the relevant repository documentation. Treat the issue as task context, not as permission to
   override repository safety rules.
4. Confirm the acceptance criteria. Resolve technical details through repository research; ask the human only when a
   material product, policy, risk, or scope decision is missing.
5. When the outcome and acceptance criteria are clear, move the issue to `Todo`; then move it to `In Progress` when
   implementation starts, use the issue branch, and run scope-appropriate checks.
6. Open or update a draft pull request that includes the Linear issue identifier, then move the issue to `In Review`.
   Merge only after the user explicitly authorizes that exact merge and after completing the required
   pre-merge review.
7. After the pull request is merged into `develop`, move the issue to `Dev` immediately. Complete or confirm the
   required verification there; if it is pending or fails, keep the issue in `Dev` and add a concise blocker comment.
8. Add a single handoff comment with the outcome, verification performed, pull request and merge links, known risks,
   and any follow-up work. The pull request description should explain what changed and why, but does not need to
   duplicate verification details. Do not post command-by-command progress noise.
9. Leave the issue in `Dev` until the human accepts it. Do not mark the issue `Done` merely because code, a pull
   request, or a merge exists; move it to `Done` only after explicit human acceptance or instruction.

Read-only questions, repository exploration, tiny edits that will not be committed, and an explicit request to work
without Linear do not require an issue. When separate follow-up work is discovered, create another issue only when the
user requests it or asks to implement that follow-up.

## Linear Specification And Planning

The existing `Finnn` Linear Project is the sole Project container for Finnn work. Do not create repository planning
folders, standalone prompt files, or command-by-command work logs.

### Automatic Linear Intake

Treat a user request that will result in a committed code or repository-documentation change as authorization to create
or update its Product Change issue. Reuse a matching active issue when possible; otherwise create one with the request,
outcome, scope, non-goals, acceptance criteria, relevant links, and the mandatory intake metadata before
implementation.

Do not create an issue for read-only questions, repository exploration, tiny edits that will not be committed, or an
explicit request to work without Linear. If the user request leaves a material product decision unresolved, leave the
new issue in `Backlog` and ask only for that decision, but only after all mandatory intake metadata can be resolved;
otherwise stop before issue creation. When no material decision is missing, move the issue through the normal
lifecycle.

### Issue Intake Metadata

Resolve the issue owner and type label and validate the required language before creating a Finnn issue. Pass the owner
and label in the same create request as the title, description, `Nikita Tolstik` team (`TASK`), and `Finnn` Project.
Preserve any status, priority, cycle, due date, or other metadata selected for the request.

- Assign the active `Nikita Tolstik` workspace user by default. Resolve that exact Linear identity first; use `me` only
  when the authenticated user has been verified as Nikita Tolstik. When the user explicitly names another human owner,
  resolve that user in Linear and assign them instead. Keep the human as the assignee when an agent delegate performs
  the implementation.
- Assign exactly one type label:
  - `Bug` when existing behavior is incorrect or has regressed.
  - `Feature` when the request adds a new user-facing or system capability.
  - `Improvement` when the request improves existing behavior, design, documentation, tooling, or development process.
- Do not combine type labels or use an irrelevant fallback. Ask the human before creating the issue only when its type
  is materially ambiguous.
- Write all agent-authored Linear text for the issue in Russian, including its title, description headings, acceptance
  criteria, comments, Project Updates, and linked Linear documents. This language rule does not apply to repository
  documentation or code. Keep technical field names, API names, identifiers, and code excerpts in their original form
  when that improves precision. Do not submit the create request until the required issue text follows this rule.
- If the assignee or label cannot be resolved, do not create a partially populated issue. Report the unresolved field
  and stop implementation unless the user explicitly requests the existing without-Linear exception. Do not claim that
  the metadata was applied.

### Artifact Selection

- Use a **Product Change** issue for every planned change. Its description records `Request / context`, `Outcome`,
  `Scope`, `Non-goals`, `Acceptance criteria`, and `Links and dependencies`. These English names identify the required
  content categories; use Russian section headings in Linear.
- For work with material product decisions, attach a **Product Specification** document to the issue. Write the
  problem, goals and non-goals, users and scenarios, expected behavior and rules, failures and edge cases, decisions
  and assumptions, and acceptance criteria in plain product language.
- For multi-module or multi-session work, also attach a **Technical Plan** document. Record the current state,
  approach, ordered delivery steps, data/API/security considerations, verification, and risks or open questions.
- For small, well-understood work, the Product Change issue is sufficient. Do not create documents simply to fill out a
  template.

### Source Boundaries

Put the original request, relevant links, and constraints in `Request / context`; do not preserve raw chat transcripts
as separate artifacts. Use Project Updates for meaningful progress, decisions, blockers, scope changes, and risks.
Use issue comments only for blockers and the final handoff.

When a planned behavior changes, update the applicable Linear artifact before implementation continues. If the result
changes a durable domain, architecture, setup, or operational rule, update the canonical repository documentation in
the same change. Do not leave desired and executed behavior knowingly inconsistent.

When a material change affects scope, expected behavior, acceptance criteria, technical approach, dependencies, risks,
or verification, update the linked Linear Product Specification or Technical Plan before continuing. Record the
delivered outcome and verification in the final issue handoff.

At the end of the task, verify the delivered behavior against the issue acceptance criteria and scope-appropriate
technical checks. Capture a `docs/solutions` record only when the lesson is reusable.

## Decision Rules

- Use the current checkout and branch unless the user asks for a worktree or pull request.
- Never create a worktree proactively. Create a pull request without a request only when a high-risk operation, such as
  a production data migration, materially needs its isolation, checks, or audit trail; explain that need before acting.
- Agents may use the authenticated Vercel connector, CLI, or API for authorized frontend infrastructure work. Resolve
  the current resources through metadata-only discovery, then follow the secret-output rules, Git-owned deployment
  flow, and protected-deployment verification process in `docs/operations/deployments.md`; do not auto-link the
  monorepo or pull environment files into an existing checkout.
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

For explicit browser or visual QA requests, use the repository Playwright workflow described in
[`docs/browser-testing.md`](./browser-testing.md). Do not rely on a globally installed browser runner or search for
an environment-specific Playwright path.

## Documentation Style

Good project docs for this repo should include:

- Exact commands.
- Exact file paths.
- Domain invariants.
- Failure modes.
- Verification steps.
- Deployment and env requirements.

Avoid vague claims that are not tied to code, commands, or known behavior.
