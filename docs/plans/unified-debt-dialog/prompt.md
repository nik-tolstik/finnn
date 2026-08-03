# Unified debt dialog

Replace the debt action picker with one dialog. Open debts start on the repayment segment and expose repayment, adding money, and transaction repayment. Edit and delete live in the header; closed debts remain read-only except for deletion.

The implementation must preserve existing debt mutations, validation, exchange-rate synchronization, selectors, and optimistic cache updates. No API, Prisma, or generated-client changes are required.
