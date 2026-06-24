# Scheduled Payments Work Log

This file is the required execution history for the scheduled payments project.

Developer agents must append entries here while implementing the plan in this folder.

## Entry Template

````md
## YYYY-MM-DD HH:mm TZ - Agent Name / Role

### Scope

- What this entry covers.

### Files Changed

- `path/to/file`

### Commands Run

```bash
pnpm ...
```

### Results

- Pass/fail output summary.

### Decisions

- Decision and reason.

### Subagent Contributions

- Agent name: summary of analysis or patch.

### Blockers / Follow-ups

- None, or concrete next action.
````

## 2026-06-19 - Codex / Planning

### Scope

- Created the initial implementation plan for the "Платежи" scheduled payment obligations feature.
- Captured backend, frontend, notification, cron, data model, test, documentation, rollout, risk, and open-question scope.
- Captured the product decision to use "Платежи" as the UI label and `scheduled-payments` as the implementation slug.

### Files Changed

- `docs/plans/scheduled-payments/README.md`
- `docs/plans/scheduled-payments/prompt.md`
- `docs/plans/scheduled-payments/work-log.md`

### Commands Run

```bash
git branch --show-current
git status --short
git branch --list develop
git switch develop
rg --files docs/plans AGENTS.md docs
ls -la docs/plans
sed -n '1,220p' docs/plans/README.md
sed -n '1,220p' docs/plans/telegram-ai-finance-bot/README.md
sed -n '1,160p' docs/plans/auth-email-google-recovery/work-log.md
sed -n '1,120p' docs/plans/auth-email-google-recovery/prompt.md
rg -n "Telegram|telegram|Email|email|cron|schedule|notification|workspace" packages/api/src packages/api/prisma/schema.prisma packages/web/src/shared/lib/query-keys.ts docs/domain-model.md docs/architecture.md docs/operations.md
find packages/api/src -maxdepth 2 -type f | sort
find packages/web/src/modules packages/web/src/app -maxdepth 3 -type f | sort
sed -n '1,460p' packages/api/prisma/schema.prisma
sed -n '1,220p' packages/api/src/app.module.ts
sed -n '1,260p' packages/api/src/email/email.service.ts
sed -n '1,220p' packages/api/src/telegram-bot/telegram-bot.client.ts
sed -n '1,180p' packages/api/src/currency/currency.controller.ts
sed -n '1,180p' packages/web/src/shared/lib/query-keys.ts
mkdir -p docs/plans/scheduled-payments
```

### Results

- Planning files were created.
- Implementation was not started.
- No test commands were run because this pass only created documentation.

### Decisions

- Use `scheduled-payments` for module/path naming to avoid ambiguity with existing `PaymentTransaction`.
- Use "Платежи" as the primary UI label.
- Reuse existing email, Telegram bot, workspace auth, and cron-secret patterns instead of introducing a new notification infrastructure.
- Keep scheduled payments as an expense-obligation MVP, with expected income left as an open future question.

### Subagent Contributions

- None.

### Blockers / Follow-ups

- Implementation not started.
- Product questions in `README.md` should be resolved before or during implementation.

## 2026-06-19 16:04 +03 - Codex / Planning

### Scope

- Added a project planning rule that each implementation prompt should name a dedicated working branch.
- Added the scheduled payments implementation branch to this plan's prompt.

### Files Changed

- `docs/plans/README.md`
- `docs/plans/scheduled-payments/prompt.md`
- `docs/plans/scheduled-payments/work-log.md`

### Commands Run

```bash
sed -n '1,180p' docs/plans/README.md
sed -n '1,120p' docs/plans/scheduled-payments/prompt.md
git status --short
date '+%Y-%m-%d %H:%M %z'
```

### Results

- Planning documentation was updated.
- Implementation was not started.
- No test commands were run because this pass only updated documentation.

### Decisions

- Use `codex/scheduled-payments` as the dedicated implementation branch for this feature.

### Subagent Contributions

- None.

### Blockers / Follow-ups

- Implementation not started.

## 2026-06-20 18:31 +0300 - Codex / Planning

### Scope

- Removed the dashboard upcoming payments widget from the scheduled payments MVP scope.

### Files Changed

- `docs/plans/scheduled-payments/README.md`
- `docs/plans/scheduled-payments/work-log.md`

### Commands Run

```bash
rg -n "dashboard|Dashboard|nearest|ближай" docs/plans/scheduled-payments
date '+%Y-%m-%d %H:%M %z'
git status --short --branch
sed -n '32,50p' docs/plans/scheduled-payments/README.md
sed -n '372,386p' docs/plans/scheduled-payments/README.md
sed -n '426,438p' docs/plans/scheduled-payments/README.md
```

### Results

- Documentation updated.
- Tests were not run because this was a documentation-only scope change.

### Decisions

- Keep the dedicated `/payments` page and `Платежи` navigation item.
- Do not include a dashboard widget for nearest upcoming payments in the MVP.

### Subagent Contributions

- None.

### Blockers / Follow-ups

- None.

## 2026-06-20 18:49 +0300 - Codex / Developer Backend/API

### Scope

- Implemented the backend scheduled payments slice: Prisma models, NestJS module/controllers/DTOs/services, recurrence helpers, mark-paid/skip/snooze/pause/archive flows, reminder cron, email reminder delivery, and Telegram inline callbacks.
- Added focused backend tests for recurrence, list display filtering, mark-paid transaction integration, skip advancement, and reminder idempotency.
- Regenerated Prisma Client and backend OpenAPI after API/schema changes.

### Files Changed

- `packages/api/prisma/schema.prisma`
- `packages/api/src/app.module.ts`
- `packages/api/src/email/email.service.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.controller.ts`
- `packages/api/src/scheduled-payments/scheduled-payments-cron.controller.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.dto.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.module.ts`
- `packages/api/src/scheduled-payments/scheduled-payments-notification.service.ts`
- `packages/api/src/scheduled-payments/scheduled-payments-schedule.service.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.service.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.types.ts`
- `packages/api/src/telegram-bot/telegram-bot.module.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/src/telegram-bot/telegram-callback-data.ts`
- `packages/api/test/scheduled-payments.service.test.ts`
- `packages/api/openapi.json`
- `docs/plans/scheduled-payments/work-log.md`

### Commands Run

```bash
pnpm --filter api db:generate
pnpm --filter api typecheck
pnpm --filter api check
pnpm --filter api exec biome check src/scheduled-payments src/telegram-bot/telegram-bot.service.ts --write
pnpm --filter api test test/scheduled-payments.service.test.ts
pnpm --filter api exec biome check test/scheduled-payments.service.test.ts --write
pnpm --filter api test
pnpm --filter api openapi:generate
```

### Results

- `pnpm --filter api db:generate`: passed.
- `pnpm --filter api typecheck`: passed after merging overlapping schedule/email edits and regenerating Prisma Client.
- `pnpm --filter api check`: passed.
- `pnpm --filter api test test/scheduled-payments.service.test.ts`: passed, 5 tests.
- `pnpm --filter api test`: passed, 14 files / 212 tests.
- `pnpm --filter api openapi:generate`: passed and updated `packages/api/openapi.json`.

### Decisions

- Stored scheduled payment lifecycle as `active`, `paused`, or `archived`, with display status computed from `nextDueAt`, timezone, and latest record.
- Added `snoozedUntil` to `ScheduledPayment` so snoozing reminders does not mutate the due date.
- Kept `createdById`, `assignedUserId`, reminder `userId`, and record `actionById` as scalar ObjectId fields instead of expanding User relation collections.
- Mark-paid uses `TransactionsService.createPaymentTransaction` when transaction creation is requested; it does not write `PaymentTransaction` directly.
- One-time payments are archived after paid/skip; recurring payments advance using the recurrence helper.
- Reminder recipients resolve to `assignedUserId` first and `createdById` otherwise.
- Telegram callbacks use short direct payloads (`sp:paid:<id>`, `sp:snooze:<id>:<days>`, `sp:skip:<id>`) rather than a token table for MVP.

### Subagent Contributions

- None. No separate subagent tool was available in this workspace turn; parallel investigation used local shell reads only.

### Blockers / Follow-ups

- Web generated client/module files were present in the worktree outside this backend slice; they were left untouched.
- Mark-paid transaction creation calls the existing `TransactionsService`, which owns its own Prisma transaction, then links the scheduled payment record afterward. A future shared transaction helper could make that fully atomic without direct transaction-table writes.
- Operations docs still need the hourly `/cron/scheduled-payment-reminders` scheduler note when the integration docs pass runs.

## 2026-06-20 18:56 +0300 - Codex / Orchestrator Integration

### Scope

- Reconciled the backend Developer subagent patch with local schema/service edits.
- Generated the OpenAPI spec and Orval web clients for scheduled payments.
- Implemented the `/payments` protected web route, navigation item, list tabs, create form, mark-paid dialog, and action buttons.
- Added frontend scheduled-payment adapters, types, constants, status/amount helpers, and TanStack Query keys.
- Updated domain, architecture, and operations docs.

### Files Changed

- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/operations.md`
- `docs/plans/scheduled-payments/work-log.md`
- `packages/api/openapi.json`
- `packages/api/prisma/schema.prisma`
- `packages/api/src/app.module.ts`
- `packages/api/src/email/email.service.ts`
- `packages/api/src/scheduled-payments/*`
- `packages/api/src/telegram-bot/*`
- `packages/api/test/scheduled-payments.service.test.ts`
- `packages/web/src/app/(dashboard)/components/dashboard-nav.ts`
- `packages/web/src/app/(dashboard)/payments/*`
- `packages/web/src/modules/scheduled-payments/*`
- `packages/web/src/shared/api/generated/*`
- `packages/web/src/shared/lib/query-keys.ts`

### Commands Run

```bash
pnpm --filter api db:generate
pnpm --filter api typecheck
pnpm api:generate
pnpm --filter web typecheck
pnpm api:check-generated
pnpm --filter api check
pnpm --filter web check
pnpm --filter web exec biome check --write src/app/'(dashboard)'/payments src/modules/scheduled-payments src/shared/lib/query-keys.ts src/app/'(dashboard)'/components/dashboard-nav.ts
pnpm --filter api test
pnpm --filter web test
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

### Results

- `pnpm --filter api db:generate`: passed.
- `pnpm --filter api typecheck`: passed.
- `pnpm api:generate`: passed.
- `pnpm --filter web typecheck`: passed.
- `pnpm api:check-generated`: passed.
- `pnpm --filter api check`: passed.
- `pnpm --filter web check`: passed after formatting touched web files and replacing button-checkbox labels with accessible text groups.
- `pnpm --filter api test`: passed, 14 files / 212 tests.
- `pnpm --filter web test`: passed, 28 files / 108 tests.
- `pnpm typecheck`: passed.
- `pnpm check`: passed.
- `pnpm test`: passed, API 14 files / 212 tests and web 28 files / 108 tests.
- `pnpm build`: passed, including API Nest build and web Next.js production build.
- Browser screenshot QA was not run because the plan and project instructions explicitly prohibit it unless requested.

### Decisions

- Kept the backend subagent's generated contract shape, including `one_time` schedule kind and `snoozedUntil`.
- Added explicit Swagger `@ApiQuery` metadata for scheduled-payment list filters so Orval generates `ListScheduledPaymentsParams`.
- Kept the first web iteration focused on the actual `/payments` workflow: list, tabs, create, pay, skip, pause/resume, and archive.
- Invalidated scheduled payment, transaction, account, and analytics query domains after mark-paid because optional transaction creation can change balances and analytics.

### Subagent Contributions

- Volta / Developer agent: implemented the backend/API slice, Prisma models, recurrence helper, reminder cron, email/Telegram integrations, Telegram callbacks, focused API tests, OpenAPI generation, and backend verification. The integration pass reconciled overlapping schema/email/schedule edits and built the web/client/docs layer on top.

### Blockers / Follow-ups

- Mark-paid transaction creation still calls `TransactionsService.createPaymentTransaction` before linking the scheduled-payment record, so the transaction and scheduled-payment record are not one shared Prisma transaction.
- Web UI has the MVP create/list/action flows but not a dedicated detail/history panel yet.

## 2026-06-20 19:17 +0300 - Codex / Scheduled Payments UI Fixes

### Scope

- Replaced scheduled-payment native selects with the shared `Select` primitive.
- Swapped native date-time inputs for `DateTimePicker`.
- Switched account selection to `AccountSelector` so account icons and owner display render consistently.
- Rendered responsible users with `UserDisplay` avatars in the shared select.
- Preserved shared TanStack Query cache shapes and unwrapped `ActionResult` data before mapping to avoid cached-object `map` crashes.
- Added form-control guidance to agent and architecture docs.

### Files Changed

- `AGENTS.md`
- `docs/architecture.md`
- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/app/(dashboard)/payments/components/PaymentsContent.tsx`
- `packages/web/src/modules/scheduled-payments/components/MarkScheduledPaymentPaidDialog.tsx`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web typecheck
pnpm --filter web check
pnpm --filter web test
```

### Results

- `pnpm --filter web typecheck`: passed.
- `pnpm --filter web check`: passed after manual import/format cleanup.
- `pnpm --filter web test`: passed, 28 files / 108 tests.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

## 2026-06-21 11:43 +0300 - Codex / Scheduled Payments Select Popover Fix

### Scope

- Fixed shared select dropdown layout jitter in scheduled-payment dialogs by disabling Floating UI portal tab-order sentinels for the shared `Popover`.
- Checked shadcn/Radix Select guidance and Floating UI portal docs before changing the shared overlay primitive.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/shared/ui/popover/Popover.tsx`

### Commands Run

```bash
pnpm dlx shadcn@latest docs select dialog
pnpm --filter web exec biome check src/shared/ui/popover/Popover.tsx src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx src/modules/scheduled-payments/components/MarkScheduledPaymentPaidDialog.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check ...`: passed, 3 files checked.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Changed the shared `Popover` instead of each scheduled-payment select because the jitter came from portal behavior used by every dropdown-style select.
- Set `FloatingPortal preserveTabOrder={false}` to prevent non-modal portal tab-order helpers from adding layout artifacts around compact form controls.

### Subagent Contributions

- None; the issue was narrow and localized to shared overlay behavior.

### Blockers / Follow-ups

- None.

## 2026-06-21 11:45 +0300 - Codex / Scheduled Payments Form Layout Fixes

### Scope

- Removed the synthetic "Создатель" responsible-user option from the scheduled-payment create form.
- Defaulted the responsible user to the current workspace member and sorted that member first.
- Changed scheduled-payment create form field groups from three columns to two columns.
- Added bottom spacing after the notes field before the dialog footer border.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx src/shared/ui/popover/Popover.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check ...`: passed, 2 files checked.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Kept responsible-user options limited to real workspace members and used the session user only to select/sort the current member.
- Kept the form modal width unchanged; the two-column layout removes the cramped three-column rows without widening the dialog.

### Subagent Contributions

- None; the change was localized to the scheduled-payment form.

### Blockers / Follow-ups

- None.

## 2026-06-21 11:50 +0300 - Codex / Scheduled Payments Modal And Schedule Dropdown

### Scope

- Switched scheduled-payment dialogs to the shared `useDialogState` mounted/open/unmount pattern so close animations can complete before unmounting.
- Replaced separate due date, reminder, and repeat controls in the create-payment form with a compact calendar-style schedule dropdown based on the supplied screenshot.
- Kept the dropdown fully functional: date selection, time presets, reminder offsets, notification channels, repeat kind, custom interval, clear, and OK actions.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/app/(dashboard)/payments/components/PaymentsContent.tsx`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check --write src/app/'(dashboard)'/payments/components/PaymentsContent.tsx src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check --write ...`: passed and formatted 1 file.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Used the same mounted dialog lifecycle as account/debt/transaction dialogs instead of conditional rendering directly from `open`.
- Implemented the schedule dropdown locally in the scheduled-payment form so the shared `DateTimePicker` remains unchanged.

### Subagent Contributions

- None; the change was localized to scheduled-payment UI.

### Blockers / Follow-ups

- None.

## 2026-06-21 11:54 +0300 - Codex / Scheduled Payments Amount And Dropdown Density

### Scope

- Removed the amount-mode field from the scheduled-payment create form.
- Kept scheduled-payment creation as a fixed-amount flow and submit `amountMode: "fixed"`.
- Placed amount and currency in one row, with the currency selector acting as a compact postfix.
- Reduced schedule dropdown vertical density and capped it to the available popover height with internal scrolling.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check --write src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check --write ...`: passed, no fixes applied.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Removed range/unknown amount UI for now because the create form no longer needs amount mode selection.
- Used `valueLabel={currency}` for the currency selector trigger so the postfix stays compact while dropdown options keep full labels.

### Subagent Contributions

- None; the change was localized to the scheduled-payment form.

### Blockers / Follow-ups

- None.

## 2026-06-21 12:00 +0300 - Codex / Scheduled Payments Schedule Dropdown UX

### Scope

- Reworked the schedule dropdown to restore the roomier calendar-first layout.
- Removed date/duration tabs and quick time preset buttons.
- Added direct time selection beside the due-date row.
- Moved notification and repeat controls behind click-through subpanels opened from their summary rows.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check --write src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check --write ...`: passed, no fixes applied.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Kept one popover with internal panels instead of nesting additional popovers, so draft settings remain local until `OK`.
- Kept calendar visible on the main panel while moving less-frequent notification/repeat controls one click deeper.

### Subagent Contributions

- None; the change was localized to the scheduled-payment form.

### Blockers / Follow-ups

- None.

## 2026-06-21 12:05 +0300 - Codex / Scheduled Payments Nested Schedule Dropdowns

### Scope

- Changed notification and repeat settings from internal schedule-dropdown panel swaps to separate nested dropdowns.
- Kept the main schedule dropdown content stable while nested dropdowns open from the notification and repeat summary rows.
- Preserved draft behavior so nested dropdown edits are still applied to the form only after the main `OK` action.

### Files Changed

- `docs/plans/scheduled-payments/work-log.md`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check --write src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx
pnpm --filter web typecheck
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm --filter web exec biome check --write ...`: passed and formatted 1 file.
- `pnpm --filter web typecheck`: passed.
- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

### Decisions

- Used nested shared `Popover` instances instead of swapping the main popover body.
- Kept the nested popovers positioned to the right of their trigger rows to read as separate dropdowns.

### Subagent Contributions

- None; the change was localized to the scheduled-payment form.

### Blockers / Follow-ups

- None.

## 2026-06-21 12:28 +0300 - Codex / Scheduled Payments Delete And Date Grouping

### Scope

- Removed pause/resume and archive lifecycle support from scheduled payments.
- Changed `DELETE /workspaces/:workspaceId/scheduled-payments/:id` to hard-delete the payment plus its scheduled records and reminder deliveries.
- Removed the payments segmented status filter and grouped the web list by due date with overdue dates shown in danger color.
- Added a delete confirmation dialog before deleting a scheduled payment.

### Files Changed

- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/plans/scheduled-payments/README.md`
- `docs/plans/scheduled-payments/work-log.md`
- `packages/api/prisma/schema.prisma`
- `packages/api/src/scheduled-payments/*`
- `packages/api/test/scheduled-payments.service.test.ts`
- `packages/web/src/app/(dashboard)/payments/components/PaymentsContent.tsx`
- `packages/web/src/modules/scheduled-payments/*`
- `packages/web/src/shared/api/generated/*`

### Commands Run

```bash
pnpm db:generate
pnpm api:generate
pnpm --filter api exec biome check --write src/scheduled-payments test/scheduled-payments.service.test.ts prisma/schema.prisma
pnpm --filter web exec biome check --write src/app/'(dashboard)'/payments src/modules/scheduled-payments src/shared/api/generated/model src/shared/api/generated/scheduled-payments
pnpm --filter api test test/scheduled-payments.service.test.ts
pnpm api:check-generated
pnpm typecheck
pnpm check
date '+%Y-%m-%d %H:%M %z'
```

### Results

- `pnpm db:generate`: passed.
- `pnpm api:generate`: passed and regenerated OpenAPI/Orval clients.
- `pnpm --filter api exec biome check --write ...`: passed, no fixes applied.
- `pnpm --filter web exec biome check --write ...`: passed and formatted 1 file.
- `pnpm --filter api test test/scheduled-payments.service.test.ts`: passed, 6 tests.
- `pnpm api:check-generated`: passed.
- `pnpm typecheck`: passed.
- `pnpm check`: passed.

### Decisions

- Removed scheduled-payment lifecycle `status` instead of keeping an always-active field.
- Kept one-time payments visible as paid/skipped after action; manual delete is the explicit destructive path.
- Hard delete also removes scheduled-payment records and reminder deliveries to avoid orphaned history.

### Subagent Contributions

- Bernoulli inspected scheduled-payment pause/archive references and confirmed the remaining API, generated client, UI, and docs cleanup targets.

### Blockers / Follow-ups

- Browser screenshot QA was not run because project instructions prohibit it unless explicitly requested.

## 2026-06-21 12:49 +0300 - Codex / Developer Web Integration

### Scope

- Added scheduled payment edit mode on the `/payments` page.
- Replaced the scheduled-payment-specific paid dialog with the shared dashboard transaction creation dialog.
- Added support for linking an already-created payment transaction to a scheduled payment record.

### Files Changed

- `packages/api/src/scheduled-payments/scheduled-payments.dto.ts`
- `packages/api/src/scheduled-payments/scheduled-payments.service.ts`
- `packages/api/test/scheduled-payments.service.test.ts`
- `packages/api/openapi.json`
- `packages/web/src/app/(dashboard)/payments/components/PaymentsContent.tsx`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentList.tsx`
- `packages/web/src/modules/scheduled-payments/components/MarkScheduledPaymentPaidDialog.tsx`
- `packages/web/src/modules/scheduled-payments/scheduled-payment.api.ts`
- `packages/web/src/modules/scheduled-payments/scheduled-payment.api.test.ts`
- `packages/web/src/modules/scheduled-payments/scheduled-payment.types.ts`
- `packages/web/src/modules/transactions/components/create-transaction-dialog/CreateTransactionDialog.tsx`
- `packages/web/src/modules/transactions/components/create-transaction-dialog/create-transaction-dialog.utils.ts`
- `packages/web/src/modules/transactions/components/create-transaction-dialog/create-transaction-dialog.utils.test.ts`
- `packages/web/src/shared/api/generated/model/markScheduledPaymentPaidDto.ts`

### Commands Run

```bash
pnpm api:generate
pnpm --filter api exec biome check src/scheduled-payments test/scheduled-payments.service.test.ts --write
pnpm --filter web exec biome check 'src/app/(dashboard)/payments/components/PaymentsContent.tsx' src/modules/scheduled-payments src/modules/transactions/components/create-transaction-dialog/CreateTransactionDialog.tsx --write
pnpm --filter api test test/scheduled-payments.service.test.ts
pnpm --filter web test src/modules/scheduled-payments/scheduled-payment.api.test.ts src/modules/transactions/components/create-transaction-dialog/create-transaction-dialog.utils.test.ts
pnpm typecheck
pnpm check
```

### Results

- `pnpm api:generate`: passed and regenerated OpenAPI/Orval output.
- API scheduled payments test: passed, 7 tests.
- Web scheduled-payment API and create-transaction-dialog utils tests: passed, 2 files / 5 tests.
- `pnpm typecheck`: passed for API and web.
- `pnpm check`: passed, including generated API drift check and Biome checks.

### Decisions

- Kept one scheduled payment form component and added an `initialPayment` edit mode instead of creating a separate edit form.
- Removed the dedicated scheduled-payment paid dialog and opened the shared `CreateTransactionDialog` in locked expense mode for paid scheduled payments.
- Used the shared transaction dialog as the form UI while submitting scheduled-payment payments through `markPaid(createTransaction: true)`, avoiding an unlinked transaction if a second linking request fails.
- Extended mark-paid to accept an existing expense `transactionId` for API flexibility, while the web UI now uses backend transaction creation from the mark-paid endpoint.
- Preserved `null` values in scheduled-payment update payloads so clearing optional fields works.
- Fixed selected-account resolution in the shared transaction dialog so changing account after opening with an initial account updates preview and validation.

### Subagent Contributions

- Ramanujan performed a narrow static review and found three issues: duplicate/unlinked transactions on failed post-create linking, stale selected-account preview/validation when opened with an initial account, and nullable edit fields being converted to `undefined`. All three were addressed before final checks.

### Blockers / Follow-ups

- No browser screenshot QA was run because the project instructions require explicit user request for browser/screenshot QA.

## 2026-06-23 19:58 +0300 - Codex / Notification Reliability And UX Polish

### Scope

- Fixed scheduled-payment reminder cron selection for MongoDB records where `snoozedUntil` is missing.
- Added workspace member notification channel availability for scheduled-payment reminder UI.
- Disabled unavailable Email/Telegram channel toggles with tooltips in the scheduled-payment form.
- Replaced the desktop scheduled-payment time input with a compact custom time picker while keeping native mobile time input.

### Files Changed

- `packages/api/src/scheduled-payments/scheduled-payments-notification.service.ts`
- `packages/api/src/workspace/workspace.dto.ts`
- `packages/api/src/workspace/workspace.service.ts`
- `packages/api/test/scheduled-payments.service.test.ts`
- `packages/api/test/workspace.e2e.test.ts`
- `packages/api/openapi.json`
- `packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx`
- `packages/web/src/modules/workspace/workspace.api.ts`
- `packages/web/src/modules/workspace/workspace.api.test.ts`
- `packages/web/src/shared/api/generated/model/workspaceMemberDto.ts`
- `packages/web/src/shared/api/generated/model/workspaceMemberNotificationChannelsDto.ts`

### Commands Run

```bash
pnpm api:generate
pnpm --filter api test test/scheduled-payments.service.test.ts test/workspace.e2e.test.ts
pnpm --filter web test src/modules/workspace/workspace.api.test.ts
pnpm api:check-generated
pnpm typecheck
pnpm check
pnpm --filter web typecheck
pnpm --filter web check
```

### Results

- `pnpm api:generate`: passed and regenerated OpenAPI/Orval output.
- API scheduled-payments and workspace tests: passed, 2 files / 25 tests.
- Web workspace API test: passed, 1 file / 4 tests.
- `pnpm api:check-generated`: passed.
- `pnpm typecheck`: passed for API and web.
- `pnpm check`: passed after manual formatting fixes.
- Final web-only `typecheck` and `check`: passed after the tooltip pointer-events polish.

### Decisions

- Treated missing `snoozedUntil` as equivalent to unsnoozed by adding `{ isSet: false }` to the cron query.
- Exposed only non-sensitive per-member notification availability: verified email and Telegram bot `telegramChatId` presence.
- Disabled unavailable notification channels based on the selected responsible member, since reminders are sent to `assignedUserId || createdById`.
- Kept native mobile time selection and limited the custom picker to desktop.

### Subagent Contributions

- None. The fix was narrow enough to implement and verify directly without parallel investigation.

### Blockers / Follow-ups

- No browser screenshot QA was run because the project instructions require explicit user request for browser/screenshot QA.
