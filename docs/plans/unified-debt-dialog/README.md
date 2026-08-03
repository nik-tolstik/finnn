# Unified debt dialog

## Goals

- Open one debt dialog directly from both the active list and closed-debt history.
- Keep all debt operations for an open debt in that dialog: repay, add to the debt, and create a repayment transaction.
- Preserve the existing validation, exchange-rate synchronization, selectors, optimistic updates, and standalone transaction-history flows.
- Keep a closed debt read-only, except for deletion.

## Non-goals

- No backend, Prisma, OpenAPI, generated-client, or query-key changes.
- No change to debt creation or editing a debt transaction from the transaction history.
- No browser or screenshot QA is included in this plan.

## UX: current and proposed

Before this change, selecting a debt opened an action picker and then moved through separate modals with delayed transitions. The active list and closed-debt history used different modal paths.

Now, selecting any debt opens `DebtDialog` immediately. An open debt starts on `Погасить` and shows a full-width segmented control with `Погасить`, `Дать ещё` or `Взять ещё`, and `Транзакция`. Edit and delete are header icon actions that replace the dialog body. A closed debt shows its read-only summary with deletion available in the header; it does not mount edit or operation panels.

## Implementation

- `DebtDialog` owns `operations`, `edit`, and `delete` views plus the selected operation and submission lock.
- Extracted panels keep the existing business logic while their standalone dialog wrappers remain available to transaction-history call sites.
- Visited open-debt operation panels stay mounted behind `hidden` and `display: contents`, preserving drafts while retaining the dialog's direct flex layout, scrolling, and footer behavior.
- `DebtsList` and `ClosedDebtsHistoryDialog` each use one `useDialogState<DebtWithRelations>` and open `DebtDialog` directly.
- The obsolete `DebtActionsDialog` and delayed hand-offs are removed.

## Test strategy

- Unit tests cover the operation configuration for lent, borrowed, and closed debts.
- Source-level regression tests cover direct entry points, removal of the old action picker, and the capability guard around operation-panel mounting.
- Storybook contains open-lent, open-borrowed, and closed-debt stories.
- Run the targeted debt tests, web typecheck/check/build, and Storybook build. The shared Vite configuration requires `VITE_API_URL` for production and Storybook builds, for example `VITE_API_URL=http://localhost:4000 pnpm --filter web build:storybook`.

## Risks and assumptions

- A debt's status and type are authoritative API data; the UI only exposes operation panels for `open` status.
- A successful mutation closes the whole dialog. A failed mutation leaves the active panel and its draft open.
- The visible segment is the only interactive panel. Previously visited panels are retained only to preserve their form drafts.

## Verification

Run the targeted debt tests, web typecheck/check/build, and Storybook build from the repository root as documented in the work log.
