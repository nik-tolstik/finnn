# Unified debt dialog

## Scope

The web debt list and closed-debt history now use `DebtDialog`. Open debts use a segmented operations view; closed debts use a read-only view. Existing standalone dialogs remain available for transaction-history call sites.

## Verification

Run the targeted debt tests, web typecheck/check/build, and Storybook build from the repository root as documented in the work log.
