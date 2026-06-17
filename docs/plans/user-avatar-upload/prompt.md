# User Avatar Upload Implementation Prompt

Use this prompt to start the full user avatar upload implementation with an AI orchestration workflow.

You are the Developer for the repository at `/home/vibegame/projects/finnn`.

Goal: fully implement custom user avatar uploads backed by the Railway Bucket while preserving existing preset avatars,
default initial avatars, and current profile/settings behavior.

Source of truth:

- Follow `docs/plans/user-avatar-upload/README.md`.
- Keep `docs/plans/user-avatar-upload/work-log.md` updated after every substantial phase.
- Follow root `AGENTS.md`.

Important constraints:

- Use `pnpm`.
- Do not hand-edit generated OpenAPI or Orval files; run `pnpm api:generate`.
- Do not revert user changes.
- Do not run Browser screenshot QA with Playwright, `agent-browser`, or similar tools unless explicitly requested.
- Use Context7 for relevant library/framework documentation.
- Use subagents for parallel code analysis, implementation, or verification when they reduce risk or latency.
- Keep code comments in English.

Required product behavior:

- Users can upload PNG, JPEG, or WebP avatars from profile settings.
- Users can still choose existing preset avatars or clear back to the default initial avatar.
- Uploaded avatars are stored in the Railway Bucket through the API.
- The bucket stays private.
- `User.image` remains the display avatar field used by existing UI and DTOs.
- Add reliable cleanup for replaced or cleared uploaded avatars.
- Telegram may copy its photo into `User.image` only when `User.image === null`.
- Telegram must not overwrite preset or uploaded avatars.
- `AuthIdentity.photoUrl` should continue to update from Telegram metadata.

Expected outcome:

- Implementation is complete end to end.
- Tests and generated API artifacts are updated.
- Documentation and env examples are updated.
- Work log records files changed, commands run, results, decisions, and subagent contributions.
