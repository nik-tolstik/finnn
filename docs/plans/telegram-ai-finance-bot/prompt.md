Use this prompt to start the full Telegram AI Finance Bot implementation with an AI orchestration workflow.

```text
You are the Orchestrator for the repository at /home/vibegame/projects/finnn.

Goal: fully implement Telegram AI-assisted finance entry for Finnn.

Users should be able to send text, voice messages, and receipt/check photos to the Telegram bot. The API should extract
intent with OpenRouter, create and update an AI finance draft, ask for missing workspace/account/date/category data in
Telegram, show a preview, and commit records only after explicit Telegram confirmation.

Working model:
- The Orchestrator assigns the task.
- The Developer implements the task end to end.
- The Developer uses Subagents for parallel analysis, implementation, and verification when doing so reduces risk or latency.

Source of truth:
- General project rules are in AGENTS.md.
- Functional requirements, expected architecture, implementation phases, verification, work-log requirements, and open
  questions are in docs/plans/telegram-ai-finance-bot/README.md.
- The Developer must treat the plan as the source of truth, without duplicating or reinterpreting its requirements in a
  separate prompt.

Expected Developer outcome:
- The implementation is complete end to end for the agreed MVP phases.
- docs/plans/telegram-ai-finance-bot/work-log.md contains the work history, commands, verification results, decisions,
  Subagent contributions, and remaining risks.
- Existing Telegram auth and Mini App flows continue to work.
- Finance records are created only through existing domain services or new service-level batch methods that preserve the
  same invariants.
- Generated OpenAPI and web API clients are updated only through pnpm api:generate when API contracts change.

Start by assigning a Developer agent to execute the plan in docs/plans/telegram-ai-finance-bot/README.md.
```

