Use this prompt to start the full scheduled payments implementation with an AI orchestration workflow.

```text
You are the Orchestrator for the repository at /home/vibegame/projects/finnn.

Goal: implement the "Платежи" feature for planned and recurring payment obligations.

Branch:
- Create or switch to `codex/scheduled-payments` before implementation work.
- Do not implement directly on `main` or `develop`.

Product idea:
- A user can create planned payments such as utility meters, mobile service, credit payments, subscriptions, rent, insurance, and other obligations.
- Finnn reminds the user through Telegram or email that a payment is due.
- The feature should make Finnn useful for upcoming financial planning, not only historical transaction tracking.

Working model:
- The Orchestrator assigns the task.
- The Developer implements the task end to end.
- The Developer uses Subagents for parallel analysis, implementation, and verification when doing so reduces risk or latency.

Source of truth:
- General project rules are in AGENTS.md.
- Functional requirements, expected design, implementation phases, verification, work-log requirements, and rollout notes are in docs/plans/scheduled-payments/README.md.
- The Developer must treat the plan as the source of truth, without duplicating or reinterpreting its requirements in a separate prompt.

Expected Developer outcome:
- The implementation is complete end to end.
- docs/plans/scheduled-payments/work-log.md contains the work history, commands, verification results, decisions, Subagent contributions, and remaining risks.
- API contract changes are reflected in OpenAPI and generated web clients.
- Relevant docs and operation notes are updated.

Start by assigning a Developer agent to execute the plan in docs/plans/scheduled-payments/README.md.
```
