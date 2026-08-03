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

## 2026-08-03 — External review exact-rounding follow-up

- Confirmed the second Copilot P2: `Big.div` uses the constructor's default decimal precision, so the prior ratio-based implementation could still cross a large half-percent rounding boundary.
- Replaced division-based percentage rounding with exact `big.js` arithmetic: scale the amount by 100, derive the exact quotient and remainder with `mod`, add one only when twice the remainder reaches the total, then clamp and convert the resulting integer percentage.
- Validated `Big.mod` for both the reported integer case and a decimal case; each produced the expected exact remainder and integral quotient. Added the reported 1e21 boundary regression while retaining the first large-money regression.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 250 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.

## 2026-08-03 — Final-final verifier

- PASS on `dfd07ed`: the final verifier completed after both confirmed progress-precision fixes.
- `pnpm typecheck` — passed.
- `pnpm check` — passed.
- `pnpm test` — passed: API 276 passed / 12 skipped, web 58 test files / 250 tests, and backup 11 tests.
- `VITE_API_URL=http://localhost:4000 pnpm build` — passed.
- `git diff --check` — passed.
- Focused strict no-tool Copilot CLI review with `grok-4.5` of `0670129...HEAD` reported exactly: `No actionable findings`. Final-review classifications: none confirmed, rejected, or uncertain.
- No browser or screenshot QA was run, in accordance with `AGENTS.md`.

## 2026-08-03 — Compact neutral debt summary follow-up

- Simplified the shared `DebtSummaryCard` used by all three debt operation segments: removed the avatar, reduced card spacing and typography, and retained the existing Russian labels, amounts, progress arithmetic, and live pending-payment preview.
- Made the direction neutral muted text for both debt types. The settled progress segment and its amount label now use the high-contrast neutral foreground color, while the pending preview remains primary for a clear non-danger distinction.
- Added a focused source regression ensuring the card contains no `UserRound`, Lucide import, destructive styling, or success-direction styling, and retains the neutral/primary progress contract.
- React review: the component remains presentational, with no added state, effects, subscriptions, or unnecessary memoization.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 251 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `pnpm --filter web build:storybook` requires `VITE_API_URL` under the existing production Vite configuration; `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed (existing chunk-size warning only).
- No browser or screenshot QA was run.

## 2026-08-03 — Approved compact summary final verification

- Independent approval completed on `b1d0d7f`.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 251 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed.
- `pnpm typecheck` — passed.
- `pnpm check` — passed.
- `pnpm test` — passed: API 276 passed / 12 skipped, web 251 tests, and backup 11 tests.
- `VITE_API_URL=http://localhost:4000 pnpm build` — passed.
- `git diff --check` — passed.
- Strict no-tool Copilot CLI review with `grok-4.5` of `bd76a8c...b1d0d7f` reported exactly: `No actionable findings.` No findings were classified in this final review.
- No browser or screenshot QA was run.

## 2026-08-03 — Add-to-debt summary preview follow-up

- Added the pure `getAddToDebtSummaryPreview` helper and memoized its result in `AddToDebtPanel`. A complete positive amount previews post-addition total and remaining debt values in the shared summary card without using a pending-payment segment.
- The helper validates complete decimal money strings and uses `normalizeMoneyString`, `compareMoney`, and `addMoney` only. Empty, zero, invalid, and partial input returns the authoritative debt values without performing arithmetic or throwing.
- Added focused coverage for a positive preview, fallback values, decimal arithmetic, and large money-string precision. The existing summary-card progress calculation keeps the already-repaid absolute amount unchanged while recomputing its percentage from previewed values.
- React review: the preview is a pure derived value memoized from the watched amount and debt amount strings; no state or effects were added.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 260 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed (existing chunk-size warning only).
- No browser or screenshot QA was run.

## 2026-08-03 — Add-to-debt interim decimal preview fix

- Confirmed verifier finding: the preview grammar treated a trailing decimal separator as incomplete even though the existing NumberInput/Zod flow accepts it, causing the summary to flicker back to authoritative values for `1.`.
- Normalized `digits.` to `digits` after whitespace and comma normalization, so `1.` and `1,` retain the same preview as `1`; `.` alone still falls back, and `.5` remains valid. The fix uses exact money-string operations only.
- Added focused coverage for trailing dot, trailing comma, leading decimal, and normalized comma/space input.
- The prior focused Copilot no-finding conclusion missed this specific interim-input grammar issue; that conclusion is rejected for this finding.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 263 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed: 660 files checked, no fixes applied.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed (existing chunk-size warning only).
- No browser or screenshot QA was run.

## 2026-08-03 — Approved add-preview final verification

- Approval completed on `516334d`; the prior P2 interim-decimal grammar finding is confirmed fixed.
- `pnpm --filter web test -- src/modules/debts` — passed: 58 test files, 263 tests.
- `pnpm --filter web typecheck` — passed.
- `pnpm --filter web check` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build` — passed.
- `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook` — passed.
- `pnpm typecheck` — passed.
- `pnpm check` — passed.
- `pnpm test` — passed: API 276 passed / 12 skipped, web 263 tests, and backup 11 tests.
- `VITE_API_URL=http://localhost:4000 pnpm build` — passed.
- `git diff --check` — passed.
- Full strict no-tool Copilot CLI review with `grok-4.5` of `f5d1b83...HEAD` reported exactly: `No actionable findings.` No findings are classified in the current review; the historical no-finding conclusion that missed the interim-input P2 remains rejected for that issue.
- No browser or screenshot QA was run.

## 2026-08-03 — Mandatory account for debt additions

- Made the account selector mandatory and always visible for both add-to-debt directions, with account-backed
  frontend validation and currency synchronization; removed the optional-account checkbox flow while preserving
  balance previews and cross-currency amounts.
