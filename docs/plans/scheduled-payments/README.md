# Scheduled Payments Plan

## Summary

Add a first-class "Платежи" section for planned one-time and recurring payment obligations: utilities, mobile service,
credit payments, rent, insurance, subscriptions, and similar expected expenses.

Finnn should remind users before a payment is due through Telegram and/or email, let them mark a payment as paid, and
optionally create the corresponding expense transaction. The feature should extend Finnn from historical tracking into
near-term financial planning.

Use `scheduled-payments` for code/module naming to avoid confusion with existing `PaymentTransaction` records. Use
`Платежи` as the primary Russian UI label.

## Required Work Log

The Developer must update [work-log.md](./work-log.md) after every substantial phase.

Each entry must include:

- Date/time.
- Agent role/name.
- Files changed.
- Commands run.
- Tests/checks result.
- Decisions made.
- Blockers or follow-ups.

If a subagent contributes analysis or a patch, the Developer must summarize that contribution in the work log before
finishing.

## Goals

- Users can create planned payments in a workspace.
- Users can create one-time and recurring payments.
- Users can configure amount, currency, category, account, due schedule, reminder timing, and notification channels.
- Users can choose fixed amount, unknown amount, or an estimated amount range.
- Users can see upcoming, due, overdue, paid, and skipped payment states.
- Users can mark a payment as paid.
- When marking paid, users can create an expense transaction using the selected account/category/date/amount.
- Finnn sends Telegram and/or email reminders before and on the due date.
- Reminder delivery is idempotent and logged.
- Shared workspaces can assign a responsible member for a payment.

## Non-Goals For MVP

- Do not auto-pay bills or integrate with banks/operators.
- Do not scrape email/SMS invoices.
- Do not implement automatic transaction matching from bank imports.
- Do not implement full calendar sync with Google Calendar or iCal.
- Do not create a separate Telegram conversation flow for editing all payment fields in MVP.
- Do not store financial API responses or protected app routes in the service worker cache.
- Do not hand-edit generated OpenAPI or Orval client files.
- Do not run browser screenshot QA unless explicitly requested.

## Current Architecture Summary

Backend:

- NestJS modules live under `packages/api/src`.
- Prisma MongoDB schema is `packages/api/prisma/schema.prisma`.
- Finance creation logic lives in:
  - `packages/api/src/transactions/transactions.service.ts`
  - `packages/api/src/accounts/accounts.service.ts`
  - `packages/api/src/categories/categories.service.ts`
  - `packages/api/src/debts/debts.service.ts`
- Money values are strings and persisted calculations must use `packages/api/src/common/money.ts`.
- Workspace access should use `AuthGuard`, `EmailVerifiedGuard`, and `WorkspaceAccessGuard`.
- Email delivery is centralized in `packages/api/src/email/email.service.ts`.
- Telegram bot delivery is available through `packages/api/src/telegram-bot/telegram-bot.client.ts`.
- Cron-style protected endpoints currently live under `packages/api/src/currency/currency.controller.ts` and validate
  `Authorization: Bearer <CRON_SECRET>`.

Frontend:

- App Router protected pages live under `packages/web/src/app/(dashboard)`.
- Feature modules live under `packages/web/src/modules`.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.
- TanStack Query keys live in `packages/web/src/shared/lib/query-keys.ts`.
- Optimistic workspace updates live in `packages/web/src/shared/lib/optimistic-workspace-updates.ts`.
- Protected app routes should remain CSR-first and use TanStack Query for cached server state.

## Product Requirements

### Scheduled Payment Fields

Each payment should support:

- `name`: required user-facing title, for example `A1 mobile`, `Electricity`, `Credit`.
- `workspaceId`: required.
- `amountMode`: `fixed`, `unknown`, or `range`.
- `amount`: required when `amountMode = fixed`.
- `amountMin` and `amountMax`: required when `amountMode = range`.
- `currency`: required when any amount is configured; default to the workspace base currency.
- `categoryId`: optional expense category.
- `accountId`: optional default payment account.
- `assignedUserId`: optional workspace member responsible for paying.
- `notes`: optional.
- `schedule`: one-time or recurring.
- `nextDueAt`: the next payment deadline in the user's/workspace timezone.
- `reminderDaysBefore`: list such as `[7, 3, 1, 0]`.
- `notifyTelegram`: boolean.
- `notifyEmail`: boolean.
- `lastPaidAt`: nullable.

### Recurrence

MVP recurrence types:

- One-time due date.
- Weekly.
- Monthly by day of month.
- Yearly by month and day.
- Custom interval measured in days, weeks, months, or years.

When a recurring payment is marked paid or skipped, calculate and persist the next due date. If the original day does
not exist in a target month, use the last day of that month.

### Status Display

API computes display state from dates/history:

- `upcoming`: due in the future.
- `due`: due today in the relevant timezone.
- `overdue`: due date is before today.
- `paid`: last action for the current due occurrence is paid.
- `skipped`: last action for the current due occurrence is skipped.

### Mark Paid

Users can mark a scheduled payment as paid with:

- actual amount;
- account;
- category;
- payment date;
- optional note;
- create transaction flag.

If transaction creation is enabled, the backend must call existing transaction service logic instead of writing a
`PaymentTransaction` directly with Prisma. The resulting transaction should be linked back to the scheduled payment
history record.

### Skip / Snooze / Pause

MVP should include:

- Skip current occurrence: advance recurring payments without creating a transaction.
- Snooze reminder: delay reminder by a selected number of days without changing the due date.
- Pause payment: stop reminders and keep it out of "due soon" lists.
- Archive payment: soft-delete from default UI.

### Notifications

Reminder delivery rules:

- A due payment can send reminders through Telegram, email, or both.
- A reminder should be sent for each configured offset at most once per channel.
- `0` in `reminderDaysBefore` means the due-date reminder.
- Overdue reminders are optional for MVP; if implemented, cap retries to avoid noisy loops.
- Telegram reminders require a linked Telegram identity and a known `telegramChatId`.
- Email reminders require a verified user email.
- If a selected channel is unavailable, record a failed delivery with a clear reason and surface it in the UI.

Telegram reminder copy should include concise inline actions:

- `Оплачено`
- `Отложить`
- `Пропустить`

For MVP, inline actions may route to lightweight callback handlers that update the scheduled payment directly. Full
field editing can remain in the web app.

## Proposed Backend Design

Add a backend feature module:

```text
packages/api/src/scheduled-payments/scheduled-payments.module.ts
packages/api/src/scheduled-payments/scheduled-payments.controller.ts
packages/api/src/scheduled-payments/scheduled-payments.dto.ts
packages/api/src/scheduled-payments/scheduled-payments.service.ts
packages/api/src/scheduled-payments/scheduled-payments-schedule.service.ts
packages/api/src/scheduled-payments/scheduled-payments-notification.service.ts
packages/api/src/scheduled-payments/scheduled-payments-cron.controller.ts
packages/api/src/scheduled-payments/scheduled-payments.types.ts
```

Register `ScheduledPaymentsModule` in `packages/api/src/app.module.ts`.

### Prisma Models

Suggested schema:

```prisma
model ScheduledPayment {
  id                 String   @id @default(auto()) @map("_id") @db.ObjectId
  workspaceId        String   @db.ObjectId
  name               String
  amountMode         String
  amount             String?
  amountMin          String?
  amountMax          String?
  currency           String?
  categoryId         String?  @db.ObjectId
  accountId          String?  @db.ObjectId
  assignedUserId     String?  @db.ObjectId
  createdById        String   @db.ObjectId
  status             String   @default("active")
  scheduleKind       String
  scheduleInterval   Int      @default(1)
  scheduleUnit       String?
  dueDay             Int?
  dueMonth           Int?
  nextDueAt          DateTime
  timezone           String   @default("Europe/Minsk")
  reminderDaysBefore Int[]
  notifyTelegram     Boolean  @default(false)
  notifyEmail        Boolean  @default(false)
  notes              String?
  lastPaidAt         DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  account   Account?  @relation(fields: [accountId], references: [id])
  category  Category? @relation(fields: [categoryId], references: [id])

  @@index([workspaceId, status, nextDueAt])
  @@index([assignedUserId, status, nextDueAt])
  @@index([nextDueAt, status])
  @@map("scheduled_payments")
}

model ScheduledPaymentRecord {
  id                 String   @id @default(auto()) @map("_id") @db.ObjectId
  scheduledPaymentId String   @db.ObjectId
  workspaceId        String   @db.ObjectId
  transactionId      String?  @db.ObjectId
  dueAt              DateTime
  paidAt             DateTime?
  skippedAt          DateTime?
  amount             String?
  currency           String?
  accountId          String?  @db.ObjectId
  categoryId         String?  @db.ObjectId
  actionById         String   @db.ObjectId
  status             String
  note               String?
  createdAt          DateTime @default(now())

  @@index([scheduledPaymentId, dueAt])
  @@index([workspaceId, createdAt])
  @@index([transactionId])
  @@map("scheduled_payment_records")
}

model ScheduledPaymentReminderDelivery {
  id                 String    @id @default(auto()) @map("_id") @db.ObjectId
  scheduledPaymentId String    @db.ObjectId
  workspaceId        String    @db.ObjectId
  userId             String    @db.ObjectId
  dueAt              DateTime
  reminderDate       DateTime
  daysBefore         Int
  channel            String
  status             String
  sentAt             DateTime?
  error              String?
  createdAt          DateTime  @default(now())

  @@unique([scheduledPaymentId, dueAt, daysBefore, channel])
  @@index([workspaceId, reminderDate])
  @@index([userId, reminderDate])
  @@map("scheduled_payment_reminder_deliveries")
}
```

Also add relations from `Workspace`, `Account`, and `Category` if Prisma requires relation fields for generation.

### API Endpoints

Suggested endpoints:

```text
GET    /workspaces/:workspaceId/scheduled-payments
POST   /workspaces/:workspaceId/scheduled-payments
GET    /workspaces/:workspaceId/scheduled-payments/:id
PATCH  /workspaces/:workspaceId/scheduled-payments/:id
POST   /workspaces/:workspaceId/scheduled-payments/:id/pay
POST   /workspaces/:workspaceId/scheduled-payments/:id/skip
POST   /workspaces/:workspaceId/scheduled-payments/:id/snooze
DELETE /workspaces/:workspaceId/scheduled-payments/:id
GET    /workspaces/:workspaceId/scheduled-payments/:id/history
GET    /cron/scheduled-payment-reminders
```

Endpoint rules:

- Use DTO validation and explicit Swagger metadata.
- Use `AuthGuard`, `EmailVerifiedGuard`, and `WorkspaceAccessGuard` for workspace endpoints.
- Use `CRON_SECRET` bearer auth for cron.
- Validate account/category/workspace membership in the service.
- Validate `assignedUserId` is a member of the workspace.
- Do not allow income categories for scheduled expense payments unless a future product decision adds income obligations.
- Return generated response DTOs that are stable for Orval.

### Telegram Callback Integration

Extend `packages/api/src/telegram-bot/telegram-callback-data.ts` and `telegram-bot.service.ts` with scheduled payment
callback actions:

```text
sp:paid:<scheduledPaymentId>
sp:snooze:<scheduledPaymentId>:<days>
sp:skip:<scheduledPaymentId>
```

Keep callback payloads short enough for Telegram's callback data limits. If IDs make payloads too long, add a compact
callback token model instead of embedding all data.

### Email Integration

Add `sendScheduledPaymentReminderEmail` to `packages/api/src/email/email.service.ts`.

The email should include:

- payment name;
- due date;
- amount or range if known;
- workspace name;
- direct web link to the payment detail or payments page;
- clear fallback text if the user did not create this payment.

### Cron Integration

Add a dedicated cron controller in the scheduled payments module. A scheduler should call it periodically, for example
every hour:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://api.finnn.xyz/cron/scheduled-payment-reminders
```

The service should:

- find active scheduled payments whose reminder date is today or overdue and unsent;
- create/send one delivery per channel and configured offset;
- record `sent` or `failed` deliveries;
- avoid duplicate sends with the compound unique key;
- not advance payment due dates unless the user pays or skips.

## Proposed Frontend Design

Add a feature module:

```text
packages/web/src/modules/scheduled-payments/scheduled-payment.api.ts
packages/web/src/modules/scheduled-payments/scheduled-payment.types.ts
packages/web/src/modules/scheduled-payments/scheduled-payment.constants.ts
packages/web/src/modules/scheduled-payments/scheduled-payment.utils.ts
packages/web/src/modules/scheduled-payments/components/ScheduledPaymentForm.tsx
packages/web/src/modules/scheduled-payments/components/ScheduledPaymentList.tsx
packages/web/src/modules/scheduled-payments/components/ScheduledPaymentStatusBadge.tsx
packages/web/src/modules/scheduled-payments/components/MarkScheduledPaymentPaidDialog.tsx
```

Add the protected route:

```text
packages/web/src/app/(dashboard)/payments/page.tsx
```

Navigation:

- Add `Платежи` to `packages/web/src/app/(dashboard)/components/dashboard-nav.ts`.

Query/cache:

- Add `scheduledPaymentKeys` to `packages/web/src/shared/lib/query-keys.ts`.
- Invalidate scheduled payment queries after create/update/pay/skip/snooze/delete.
- Invalidate transaction/account/analytics queries when mark-paid creates an expense transaction.

UX expectations:

- First screen should be the actual payments list, not a marketing or explainer page.
- Group payments by due date. Show overdue groups first naturally by date ordering and use danger color on overdue dates.
- Use forms with existing selectors for account, category, date, and workspace members.
- Use switches for Telegram/email notification channels.
- Use checkboxes or chips for reminder offsets: `7`, `3`, `1`, `0` days.
- Surface channel setup issues inline, for example "Telegram is not connected" or "Email is not verified".
- Keep protected route CSR-first and do not introduce server-side session/data dependencies.
- Keep labels concise: the section title is `Платежи`.

## Implementation Plan

### Phase 1 - Domain And API Skeleton

- Add Prisma models and relations.
- Run `pnpm --filter api db:generate`.
- Add `ScheduledPaymentsModule`, DTOs, controller, service, and schedule calculation service.
- Implement CRUD, list filters, status computation, and history read.
- Add API tests for validation, authorization, workspace isolation, recurrence calculation, and list filters.

### Phase 2 - Mark Paid, Skip, Pause, Archive

- Implement mark-paid in a Prisma transaction.
- Call existing transaction service logic when `createTransaction = true`.
- Create scheduled payment records for paid/skipped actions.
- Advance `nextDueAt` for recurring payments.
- Archive one-time payments after pay/skip unless product decision says otherwise.
- Add tests for account/category validation, transaction creation, balance effects, and recurrence advancement.

### Phase 3 - Reminders

- Add email reminder method.
- Add Telegram reminder sender and callback handling.
- Add cron endpoint and idempotent delivery log.
- Add tests for due selection, duplicate prevention, channel failure logging, and callback actions.
- Update `docs/operations.md` with scheduler setup and environment expectations.

### Phase 4 - Web UI

- Add generated API client by running `pnpm api:generate`.
- Add scheduled payment module API wrappers and query keys.
- Build `/payments` list, filters, create/edit form, detail/history view, and mark-paid dialog.
- Add the `Платежи` nav item.
- Add focused component/unit tests for helpers and API wrappers.

### Phase 5 - Docs, Verification, Rollout

- Update `docs/domain-model.md` with scheduled payment models and invariants.
- Update `docs/architecture.md` with the module and notification flow.
- Update `docs/operations.md` with reminder cron schedule and Telegram/email caveats.
- Run required verification commands.
- Update this plan and `work-log.md` with final decisions and test results.

## Test Plan

API:

```bash
pnpm --filter api test test/scheduled-payments.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

Generated API:

```bash
pnpm api:generate
pnpm api:check-generated
```

Web:

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

Full verification for non-trivial completion:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

Manual verification:

- Create a one-time payment with fixed amount and email reminder.
- Create a monthly payment with unknown amount and Telegram reminder.
- Mark a payment as paid and create an expense transaction.
- Mark a recurring payment as skipped and verify the next due date.
- Run the reminder cron twice and confirm no duplicate sends.
- Verify unavailable Telegram/email channels are recorded and displayed.

Do not run browser screenshot QA unless the user explicitly asks for it.

## Documentation / Operations Updates

Update:

- `docs/domain-model.md`
- `docs/architecture.md`
- `docs/operations.md`
- `packages/api/.env.example` if new environment variables are added.

No new environment variables should be necessary for MVP if the feature reuses:

- `CRON_SECRET`
- `SMTP_*`
- `WEB_APP_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_WEBHOOK_SECRET`

Operations should add a scheduled call to `/cron/scheduled-payment-reminders`, ideally hourly.

## Rollout Notes

- Deploy schema changes before enabling the cron scheduler.
- Keep the cron disabled until API and notification delivery are verified in DEV.
- Test Telegram reminders with the DEV bot first.
- If email is unavailable in an environment, the feature should still support in-app and Telegram usage.
- Existing transactions, debts, analytics, and Telegram AI finance flows must keep working unchanged.

## Risks

- Reminder spam if idempotency or overdue retry logic is wrong.
- Timezone bugs around "due today" and month-end recurrence.
- Confusion between historical transactions and planned payments if UI labels are unclear.
- Telegram callback payload length limits if raw ObjectIds plus action data become too large.
- Mark-paid transaction creation could double-count expenses if users also record the same expense manually.
- Shared workspace responsibility rules may need clearer product decisions for who receives reminders.

## Open Questions

- Should reminders go only to `assignedUserId`, only to the creator, or to all workspace owners/admins when no assignee is set?
- One-time payments remain visible as completed after being paid/skipped; manual delete is explicit and destructive.
- Should fixed-amount payments allow editing actual amount during mark-paid?
- Should a paid scheduled payment always create a transaction by default?
- Should overdue reminders repeat, and if yes, at what capped cadence?
- Should "Платежи" include expected income later, or only expense obligations for MVP?
- Should credit payments link to the existing `debts` domain in the future?
