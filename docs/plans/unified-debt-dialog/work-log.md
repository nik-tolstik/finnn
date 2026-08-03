# Work log

## 2026-08-03 — Terra contribution

- Created `agent/unified-debt-dialog` from `origin/develop` after confirming a clean `develop` checkout.
- Implementing the unified web-only debt dialog, extracted form panels, regression coverage, and Storybook states.

## 2026-08-03 — Terra review and verification

- Reviewed the uncommitted unified-dialog implementation without reverting existing work.
- Fixed the missing `DebtType` import and reset the dialog view, selected segment, visited segments, and submit lock on every new opening.
- Kept visited segment panels mounted with `display: contents` wrappers so drafts persist without breaking `DialogWindow`'s direct flex layout, scrolling, or footer placement.
- Ran the required targeted and monorepo checks successfully. Storybook requires `VITE_API_URL` through the shared Vite configuration, so the unparameterized command fails before story compilation; the build completed successfully with `VITE_API_URL=http://localhost:4000`.

## 2026-08-03 — Terra closed-debt regression fix

- Confirmed that the initial visited `close` operation could mount `CloseDebtPanel` for a closed debt even though the read-only summary was shown.
- Moved all operation-panel mounting into `DebtDialogOperations`, which is rendered only when `capabilities.hasOperations` is true. The edit panel is also guarded by `capabilities.canEdit`.
- Added a source-level regression assertion for the capability guard and expanded the plan README with durable goals, boundaries, UX, implementation, test strategy, and assumptions.
- `pnpm --filter web test -- src/modules/debts` — passed: 57 test files, 243 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 656 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `git diff --check` — passed.

## 2026-08-03 — Copilot accessibility follow-up

- Copilot classification: one P3 accessibility finding was confirmed and fixed; the remaining findings were rejected after source and test review because they did not require a change to this diff.
- Fixed focus hand-off inside `DebtDialog`: when the dialog opens or changes between operations, edit, and delete views, focus moves to the programmatically focusable dialog title after the animated window mounts. The `debt.id:view` focus key and effect dependencies prevent ordinary re-renders from stealing focus.
- Updated the shared `DialogTitle` primitive to forward an `HTMLHeadingElement` ref and added a source-level regression assertion for the ref, focus key, title focus call, and `tabIndex={-1}`.
- `pnpm --filter web test -- src/modules/debts` — passed: 57 test files, 244 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 656 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed.
- `git diff --check` — passed.

## 2026-08-03 — Final publish verification

- Focused Copilot classification: two P2 findings were rejected, one P3 finding is uncertain because the current coverage is source-level only, and no findings were confirmed in this final review pass.
- `pnpm typecheck` — passed: API and web `tsc --noEmit`.
- `pnpm check` — passed: generated API/client drift check, API Biome (124 files), web Biome (656 files), and backup Biome (15 files).
- `pnpm test` — passed: API 276 passed / 12 skipped, web 244 passed, and backup 11 passed.
- `VITE_API_URL=http://localhost:4000 pnpm build` — passed: API Nest build and web Vite production build.
- `git diff --check` — passed with a clean task diff before this documentation-only record.
- No browser or screenshot QA was run.
