# Feature Plans

Use `docs/plans` only when the user explicitly asks for formal plan tracking **and** the task is substantial enough to need multiple modules, meaningful product decisions, or more than one focused coding session. The workflow keeps three different questions separate:

- **What and why?** `specification.md` records the product contract in plain language.
- **How?** `README.md` records the technical route, decisions, and verification.
- **What happened?** `work-log.md` is the append-only evidence trail.

This separation lets a product reader review the requested behavior without implementation details, while an agent can still resume a task without reconstructing the conversation.

## When To Create A Plan

Create a formal plan only when all of the following are true:

- the user explicitly asks to create or use a plan, or invokes a named existing plan;
- the task is substantial: it touches multiple modules or packages, has meaningful product decisions, **or** will likely take more than one focused coding session;
- benefits from explicit product decisions, a durable handoff, or a work log.

For small bug fixes or narrow copy/style changes, update the relevant docs or code directly instead of creating a plan folder. If the user asks for a concise plan for such a task, provide it in chat without persisting it under `docs/plans`.

## Workflow

1. **Discover.** After confirming the task qualifies for formal plan tracking, read the request, inspect the relevant code and project documentation, and identify unknown product decisions.
2. **Interview.** Ask the user only questions whose answer would change behavior, user experience, policy, priority, or scope. Do not ask them to select implementation details that repository research can establish. Use concise structured choices with a recommended option when the interface supports them.
3. **Specify.** Record the resolved decisions and expected behavior in `specification.md`. Keep it understandable without knowledge of the codebase.
4. **Plan.** Translate the specification into the technical `README.md`: architecture, concrete paths, sequencing, risks, and verification.
5. **Work and review.** Implement autonomously, update the execution state and work log, and verify against both the specification and technical checks. Return to the user only when a new material product decision appears.
6. **Compound.** When a lesson is reusable, write a concise record in [`docs/solutions`](../solutions/README.md) and update agent guidance only when the new rule is broadly applicable and testable. Remove the completed feature-plan folder unless the user asks to retain it.

### Material Decision Threshold

A decision is material when it changes promised behavior, the affected users, policy, money or data handling, first-release scope, or acceptance criteria. Ask the user before proceeding when such a decision is unknown or changes. Record an explicit assumption only when its impact is low and reversible; otherwise, resolve the decision through the interview.

## Folder Layout

Create one active feature folder with a short kebab-case slug, for example `telegram-ai-finance-bot` or `user-avatar-upload`:

```text
docs/plans/<feature-slug>/
  prompt.md
  specification.md
  README.md
  work-log.md
```

This four-file layout applies to new formal plans. Keep the folder while the work needs a durable handoff; after completion, retain reusable knowledge in `docs/solutions` and remove the feature folder unless the user asks to keep it.

## `prompt.md`

Store the original user or product request here. Keep it close to the source request, with only light cleanup for readability.

Include the goal, explicit requirements, stated constraints, known links or environment details, and the requested branch or pull-request outcome. Do not rewrite it into a specification or technical plan; it is the stable input those documents were based on.

## `specification.md`

Use this as the user-facing product contract. It must not depend on the reader knowing source files, frameworks, schemas, or implementation terminology.

Use these sections as appropriate:

- Summary and problem
- Goals and non-goals
- Users and affected scenarios
- Expected behavior and business rules
- Edge cases and failure behavior
- Decisions from the discovery interview
- Acceptance criteria written as observable outcomes
- Explicit low-impact assumptions, if any

Do not leave a material product question unresolved when starting implementation. If one is discovered later, return to the interview, update the specification, and then continue the technical work.

## `README.md`

Use this as the technical implementation plan. It should be detailed enough that another developer or agent can continue the work without reading the chat history.

Start with a current, rewriteable execution-state block:

```markdown
## Execution State

- Status: `planned` | `in progress` | `blocked` | `completed`
- Current step: the exact active or next numbered step
- Last verified: command and result, or `not yet run`
- Resume from: the next concrete action and the files or evidence to inspect
```

Then include the sections that apply:

- Link to the product specification
- Current technical state
- Technical approach and affected paths
- Ordered implementation steps
- Data, API, migration, security, or rollout considerations
- Verification plan with exact commands
- Documentation and operations updates
- Technical risks and follow-ups

Keep paths, commands, invariants, and failure modes concrete. Do not fill the plan with code snippets or diff-shaped instructions unless a short pseudocode fragment is necessary to preserve a risky algorithm or invariant.

Update the execution state whenever the active step, verification result, or resumption point changes. The plan may evolve as implementation reveals technical facts, but it must not silently override the approved product specification.

## `work-log.md`

Use this as an append-only implementation journal. Add an entry after each meaningful pass, especially after subagent work, behavior changes, test runs, debugging sessions, or a user decision.

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

- the user explicitly requested formal plan tracking and the scope is substantial enough to justify it;
- the branch is correct;
- `prompt.md` records the original request;
- the discovery interview resolved material product decisions;
- `specification.md` describes expected user-facing behavior and non-goals without implementation details;
- the technical plan links to the specification and has a current execution state;
- data model and API changes are called out when applicable;
- verification commands are listed;
- documentation and environment variable updates are included when needed.

Before finishing plan-driven work:

- update the execution state and `work-log.md`;
- verify the delivered behavior against `specification.md`;
- run the narrow relevant tests;
- broaden to `pnpm typecheck`, `pnpm check`, or package-specific equivalents when the blast radius warrants it;
- update `docs/`, `.env.example`, OpenAPI/generated clients, or operations notes if contracts or setup changed;
- add a `docs/solutions` record only if the completed task created reusable knowledge.
- remove the completed feature-plan folder unless the user asks to retain it.
