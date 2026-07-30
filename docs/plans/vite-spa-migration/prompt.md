# Vite SPA Migration Prompt

## Goal

Migrate the Finnn web frontend from Next.js App Router to a React 19 single-page application built with Vite and routed with React Router.

## Explicit Requirements

- Write the implementation plan under `docs/plans` before starting implementation.
- Perform all work in a dedicated Git worktree.
- Use React Router for client-side routing.
- Include an explicit, durable verification for residual Next.js artifacts.
- After the plan is written, proceed directly with implementation.
- Complete all work that can be done autonomously; request user input only for a genuine authority or external-choice blocker.

## Constraints

- Preserve the current UI, route URLs, authentication behavior, workspace query parameters, Telegram Mini App behavior, PWA behavior, and NestJS API contract.
- Keep the protected application CSR-first. The NestJS API remains the authentication, authorization, and financial-data security boundary.
- Use `pnpm`.
- Do not create a pull request unless separately requested.
- Do not run browser screenshot QA unless the user explicitly requests it.
- Do not read environment file contents. Transfer worktree environment files only as opaque files.
- Do not mutate Vercel project settings or environment variables without separate authorization; document required deployment changes instead.

## Implementation Location

- Branch: `codex/vite-spa-migration`
- Worktree: `/home/vibegame/projects/finnn-vite-spa`

## Baseline Commands

```bash
pnpm install
pnpm --filter web build
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web check
pnpm check:no-next-artifacts
```
