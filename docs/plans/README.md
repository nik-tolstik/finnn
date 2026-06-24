# Feature Plans

Use `docs/plans` for larger feature work, architecture changes, or multi-step tasks that need a durable trail for humans and AI agents. A plan should make the intended behavior, implementation scope, verification, and decisions easy to recover later.

## When To Create A Plan

Create a plan when a change:

- touches multiple modules or packages;
- changes domain behavior, data models, setup, deployment, or integrations;
- needs parallel investigation or subagent work;
- will likely take more than one focused coding session;
- benefits from explicit test scenarios and open questions.

For small bug fixes or narrow copy/style changes, update the relevant docs or code directly instead of creating a plan folder.

## Folder Layout

Create one folder per feature:

```text
docs/plans/<feature-slug>/
  prompt.md
  README.md
  work-log.md
```

Use a short kebab-case slug, for example `telegram-ai-finance-bot` or `user-avatar-upload`.

## `prompt.md`

Store the original user or product prompt here. Keep it close to the source request, with only light cleanup for readability.

Include:

- the goal;
- explicit requirements;
- non-goals or constraints;
- the dedicated implementation branch to create or use for the task;
- any known commands, links, screenshots, or environment details.

Do not turn `prompt.md` into the implementation plan. It should remain the stable input that the plan was based on.

## `README.md`

Use this as the main implementation plan. It should be detailed enough that another developer or agent can continue the work without reading the whole chat.

Recommended sections:

- Summary
- Goals
- Non-Goals
- Current State
- Proposed UX / API / Data Model Changes
- Implementation Plan
- Test Plan
- Documentation / Operations Updates
- Rollout Notes
- Risks
- Open Questions

Keep paths, commands, invariants, and failure modes concrete. Prefer specific files and services over generic descriptions.

## `work-log.md`

Use this as an append-only implementation journal. Add an entry after each meaningful pass, especially after subagent work, behavior changes, test runs, or debugging sessions.

Recommended entry format:

````markdown
## YYYY-MM-DD HH:mm +TZ - Author / Role

### Scope

- What changed in this pass.

### Files Changed

- `path/to/file.ts`

### Commands Run

```bash
pnpm --filter api test test/example.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed or failed results with useful details.

### Decisions

- Important tradeoffs or behavior choices.

### Subagent Contributions

- Who did what, if subagents were used.

### Blockers / Follow-ups

- Anything still unresolved.
````

Do not rewrite old log entries except to fix obvious typos. Add a new entry when the understanding changes.

## Planning Checklist

Before implementing from a plan, confirm:

- the branch is correct;
- the prompt names a dedicated implementation branch;
- the plan describes the expected user-facing behavior;
- non-goals are clear;
- data model and API changes are called out;
- verification commands are listed;
- documentation and environment variable updates are included when needed.

Before finishing plan-driven work:

- update `work-log.md`;
- run the narrow relevant tests;
- broaden to `pnpm typecheck`, `pnpm check`, or package-specific equivalents when the blast radius warrants it;
- update `docs/`, `.env.example`, OpenAPI/generated clients, or operations notes if contracts or setup changed.
