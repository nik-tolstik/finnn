# Analytics Calendar View Implementation Prompt

Use this prompt to start the analytics calendar view implementation.

You are the Developer for the repository at `/home/vibegame/projects/finnn`.

Goal: add a calendar view to the analytics page so users can scan each day of a month and see how much money they
received or spent, then open a day to inspect the exact transactions for that date.

Source of truth:

- Follow `docs/plans/analytics-calendar-view/README.md`.
- Keep `docs/plans/analytics-calendar-view/work-log.md` updated after every substantial phase.
- Follow root `AGENTS.md`.

Important constraints:

- Use `pnpm`.
- Do not work directly on `main`; branch from `develop`.
- Do not hand-edit generated OpenAPI or Orval files; run `pnpm api:generate` after API contract changes.
- Do not revert user changes.
- Do not run Browser screenshot QA with Playwright, `agent-browser`, or similar tools unless explicitly requested.
- Use Context7 for relevant library/framework documentation.
- Use subagents for parallel code analysis, implementation, or verification when they reduce risk or latency.
- Keep code comments in English.

Required product behavior:

- Analytics gets a calendar-oriented view for day-by-day income, expenses, and net flow.
- Calendar cells must be useful on mobile screens, not just compressed desktop UI.
- Users can click or tap a day to open a day details surface.
- The day details surface shows the day summary and the list of transactions for that date.
- Desktop may use a popover or side panel; mobile should use a bottom sheet or near full-screen sheet.
- Existing analytics filters and period controls should continue to apply consistently.

Expected outcome:

- The analytics page exposes the new calendar experience end to end.
- Backend analytics data, generated API client, frontend types, and tests are updated as needed.
- Mobile ergonomics are verified with responsive layout checks, without browser screenshot automation unless requested.
- Work log records files changed, commands run, results, decisions, and subagent contributions.
