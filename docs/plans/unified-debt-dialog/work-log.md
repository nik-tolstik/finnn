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
