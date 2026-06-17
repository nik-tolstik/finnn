Use this prompt to start the full auth email, Google, and recovery implementation with an AI orchestration workflow.

```text
You are the Orchestrator for the repository at /home/vibegame/projects/finnn.

Goal: fully implement mandatory verified email for service use, Google sign-in/linking with safe verified-email auto-linking, and password reset through email codes.

Working model:
- The Orchestrator assigns the task.
- The Developer implements the task end to end.
- The Developer uses Subagents for parallel analysis, implementation, and verification when doing so reduces risk or latency.

Source of truth:
- General project rules are in AGENTS.md.
- Functional requirements, expected design, implementation phases, verification, work-log requirements, and commit/push checkpoints are in docs/plans/auth-email-google-recovery/README.md.
- The Developer must treat the plan as the source of truth, without duplicating or reinterpreting its requirements in a separate prompt.

Expected Developer outcome:
- The implementation is complete end to end.
- docs/plans/auth-email-google-recovery/work-log.md contains the work history, commands, verification results, decisions, Subagent contributions, and remaining risks.
- Changes are committed and pushed according to the plan's checkpoint rules.

Start by assigning a Developer agent to execute the plan in docs/plans/auth-email-google-recovery/README.md.
```

