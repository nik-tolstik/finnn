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

## 2026-08-03 — Terra debt summary and mobile-sheet follow-up

- Extracted `DebtSummaryCard` and the pure `getDebtSummaryProgress` helper from the transaction write-off panel. The helper keeps money-string arithmetic for settled and pending amounts, caps the pending visual segment at the outstanding balance, and never previews a negative remaining amount.
- Reused the card in all Segmented operation panels. The close panel supplies its current close amount as a pending payment; the add panel deliberately supplies no pending amount and therefore shows authoritative debt values only; the transaction panel preserves its existing transaction-aware preview calculation while supplying the pending payment for the progress segment.
- Made the unified dialog a content-height mobile bottom sheet with a one-rem viewport allowance, and made the Segmented `DialogContent` non-growing so the active panel remains the scrollable region and its footer stays reachable.
- Added pure helper coverage for initial progress, capped pending progress, and no-pending authoritative values. Added a source regression for all three card consumers and the bottom-sheet/flex layout contract.
- React self-review: the presentational card is an extracted component rather than inline duplicated JSX; its pure helper is inexpensive and runs during render without unnecessary memoization; form subscriptions, form-state reset effects, and mutation locks remain in their original panels.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 248 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed (existing chunk-size warning only).

## 2026-08-03 — External review precision follow-up

- Confirmed Copilot P2: the summary progress helper converted arbitrary-length money strings to JavaScript numbers before calculating the ratio, allowing precision loss to change the rounded percentage.
- Replaced those conversions with `big.js` parsing, division, multiplication by 100, and positive half-up rounding. Only the final bounded integer percentage is converted to a JavaScript number; invalid and non-positive values still produce zero progress.
- Added the reported regression case (`10000000000000001` total and `8750000000000001` remaining), which now produces 12% settled and 12% total progress.
- Kept the independent rounding of settled and pending segments, and their additive total, unchanged. That preserves the existing product semantics; this focused change corrects only numeric precision of each segment.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 249 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
