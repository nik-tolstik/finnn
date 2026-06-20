# Analytics Calendar View Plan

## Goal

Add a calendar view to the analytics page so a user can understand daily money movement at a glance and immediately drill
into the transactions behind a selected day.

The target experience is:

```text
User opens Analytics
User switches to Calendar or sees Calendar as a section
Calendar shows one month as daily income / expense / net cells
User taps a highlighted day
Day details open with summary totals and transactions from that date
User can inspect or edit an existing transaction through the existing transaction flow
```

The calendar must be genuinely good on mobile. The mobile surface should prioritize touch targets, readable values, clear
selected/today states, and a bottom sheet for day details instead of a tiny anchored popup.

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

## Product Requirements

- Show a month calendar on the analytics page with one cell per day.
- Each day cell shows one primary value based on the active calendar metric:
  - `Net`: income minus expense.
  - `Income`: received money.
  - `Expense`: spent money.
- Day cells use color tone and intensity so unusually high income or spending days stand out without requiring long text.
- Day cells show the day number and a compact amount label when there is activity.
- Today and the selected day are visually distinct.
- Empty days are still tappable but visually quiet.
- The user can move between months with previous/next controls.
- The user can choose the metric with a compact segmented control or tabs.
- Existing analytics filters must apply to calendar totals and day transaction details:
  - date range / selected month;
  - transaction types;
  - accounts;
  - categories;
  - users;
  - amount range;
  - description search.
- Selecting a day opens details for that date.
- Day details show:
  - localized date;
  - income total;
  - expense total;
  - net total;
  - transaction count;
  - list of transactions from that date.
- Day details must load transactions lazily when the user selects a day.
- Day details should reuse existing transaction list rendering and edit/action flows where practical.
- Mobile day details must use `Sheet` or an equivalent bottom sheet pattern.
- Desktop day details may use a `Popover`, `Dialog`, or side panel depending on what best fits the existing analytics
  layout.
- Browser screenshot QA must not be run unless explicitly requested.

## Non-Goals For MVP

- Do not replace the current analytics overview and charts.
- Do not build a separate recurring calendar or budget calendar.
- Do not add drag-and-drop transaction editing from the calendar.
- Do not add weekly/monthly forecasting.
- Do not create a new transaction editor if the existing transaction dialogs can be reused.
- Do not hand-edit generated OpenAPI or Orval client files.
- Do not add browser automation screenshot QA unless explicitly requested.

## Current Architecture Summary

Backend:

- Analytics routes live in `packages/api/src/analytics/analytics.controller.ts`.
- Analytics DTOs live in `packages/api/src/analytics/analytics.dto.ts`.
- Analytics aggregation logic lives in `packages/api/src/analytics/analytics.service.ts`.
- The current analytics endpoint is `GET /workspaces/:workspaceId/analytics/overview`.
- The analytics controller already uses `AuthGuard`, `EmailVerifiedGuard`, and `WorkspaceAccessGuard`.
- The current analytics query supports amount, user, transaction type, category, account, description, and date filters.
- Existing analytics responses already include daily `timeSeries` points with income and expense totals.
- Combined transaction listing already exists at `GET /workspaces/:workspaceId/transactions`.

Frontend:

- The analytics page is `packages/web/src/app/(dashboard)/analytics/page.tsx`.
- The client analytics shell is `packages/web/src/app/(dashboard)/analytics/components/AnalyticsContent.tsx`.
- Existing chart rendering is in `packages/web/src/app/(dashboard)/analytics/components/AnalyticsCharts.tsx`.
- Analytics mapping helpers live in `packages/web/src/modules/analytics/analytics.api.ts`.
- Analytics domain types live in `packages/web/src/modules/analytics/analytics.types.ts`.
- Analytics view model helpers live in `packages/web/src/modules/analytics/analytics.view-model.ts`.
- Analytics tests already cover API mapping, utilities, and view model behavior.
- Query keys live in `packages/web/src/shared/lib/query-keys.ts`; do not invent ad hoc key shapes.
- Reusable UI primitives include `packages/web/src/shared/ui/sheet`, `dialog`, `popover`, `button`, and `select`.
- The reusable transaction list is `packages/web/src/modules/transactions/components/combined-transactions-list`.
- The transaction API mapper is `packages/web/src/modules/transactions/transaction.api.ts`.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Proposed UX

Add a calendar section below the top analytics controls and summary cards, before or near the existing charts.

Recommended section structure:

```text
Calendar header
  Month label
  Previous month button
  Next month button
  Metric segmented control: Net / Income / Expense

Weekday row
Month grid
Day details surface when a day is selected
```

Calendar cells:

- Use stable square-ish dimensions with `aspect-ratio` or fixed grid row constraints.
- On desktop, show day number, compact amount, and a tiny activity hint when space allows.
- On mobile, show day number plus one compact amount only. Do not show income, expense, and net all together in the cell.
- Keep font sizes fixed by breakpoint classes; do not scale type with viewport width.
- Use red/rose tone for expense-dominant negative net, green for positive net or income, and neutral for zero.
- Use intensity based on the selected metric relative to the largest absolute day value in the displayed month.
- Keep transfer-only or no-cash-impact days visually quiet unless the selected filters make them relevant.

Day details:

- Desktop: prefer a side panel or a comfortably sized popover/dialog if the list is short enough. Avoid tiny popups that
  become cramped with real transaction names.
- Mobile: use `Sheet` from the bottom, with the summary at the top and a scrollable transaction list below.
- Include loading, empty, and error states.
- Preserve access to existing transaction actions/editing by reusing `CombinedTransactionsList` or extracting a lighter
  day-list variant from its internals if needed.

## API And Data Plan

Use backend aggregation for calendar totals. Do not compute month totals from a full client-side transaction list.

Recommended API shape:

- Extend `AnalyticsOverviewResponseDto` with `calendarDays`.
- Build `calendarDays` from the same filtered current-range transactions used by the analytics overview.
- Keep all money values as strings in base currency.
- Regenerate OpenAPI and Orval clients with `pnpm api:generate`.

Suggested DTO:

```ts
export class AnalyticsCalendarDayDto {
  date!: string;
  incomeTotalInBaseCurrency!: string;
  expenseTotalInBaseCurrency!: string;
  netTotalInBaseCurrency!: string;
  transactionCount!: number;
}
```

Suggested frontend type:

```ts
export interface AnalyticsCalendarDay {
  date: string;
  incomeTotalInBaseCurrency: string;
  expenseTotalInBaseCurrency: string;
  netTotalInBaseCurrency: string;
  transactionCount: number;
}
```

Month range behavior:

- The calendar should normally request exactly one visible month through the existing analytics date filters.
- Existing period presets can remain, but when the user navigates calendar months, update the analytics filters to that
  month so totals, cards, charts, and calendar stay consistent.
- If product direction later requires a calendar independent of the analytics period, introduce a dedicated calendar query
  key and endpoint instead of overloading the overview state.

Day transaction details:

- On day selection, call the existing combined transactions list through `getCombinedTransactions(workspaceId, filters)`.
- Merge the currently applied filters with `dateFrom = selectedDate` and `dateTo = selectedDate`.
- Use `transactionKeys.list(workspaceId, dayFilters)` for the query key.
- This keeps the first analytics request small and uses the existing transaction DTOs, mapping, and edit flows.

Semantic notes:

- Income and expense should match the semantics already used by analytics overview and time series.
- Transfers should not inflate income or expense totals. Show transfer transactions in day details only when the active
  filters include transfers or do not exclude them.
- Debt transactions should follow the existing analytics cash-impact rules. If the current overview semantics are unclear,
  document the chosen behavior in `work-log.md` before implementation.

## Implementation Plan

1. Backend calendar aggregation
   - Add `AnalyticsCalendarDayDto` to `packages/api/src/analytics/analytics.dto.ts`.
   - Add `calendarDays` to `AnalyticsOverviewResponseDto`.
   - In `packages/api/src/analytics/analytics.service.ts`, initialize all dates in the effective range and aggregate
     filtered current transactions into daily income, expense, net, and transaction count.
   - Reuse existing money helpers and currency conversion paths.
   - Add or update analytics API tests for empty days, income/expense days, mixed days, filtered categories/accounts, and
     date boundaries.

2. Generated API and frontend mapping
   - Run `pnpm api:generate`.
   - Update `packages/web/src/modules/analytics/analytics.types.ts`.
   - Update `packages/web/src/modules/analytics/analytics.api.ts`.
   - Update analytics API mapper tests.

3. Calendar view model
   - Add calendar helpers in `packages/web/src/modules/analytics/analytics.view-model.ts` or a focused
     `analytics-calendar.view-model.ts` if the logic grows.
   - Build visible month cells, leading/trailing blanks, compact labels, tone, selected metric value, and intensity.
   - Add unit tests for month grid generation, leap years, week starts, zero activity days, and intensity scaling.

4. Calendar UI
   - Add `AnalyticsCalendar.tsx` under `packages/web/src/app/(dashboard)/analytics/components`.
   - Render month navigation, metric segmented control, weekday labels, and the responsive grid.
   - Wire month navigation to existing filter application so the analytics request range follows the visible month.
   - Keep layout stable on mobile with fixed grid tracks and constrained text.

5. Day details
   - Add `AnalyticsDayDetails.tsx` or colocated components under the analytics components folder.
   - Use a query against `getCombinedTransactions` with selected-day filters.
   - Reuse `CombinedTransactionsList` if it fits inside a sheet/panel; otherwise extract a presentational compact list while
     preserving transaction action/edit behavior.
   - Use `Sheet` on mobile. Use a panel, dialog, or popover on desktop depending on final layout.
   - Add loading, empty, and error states.

6. Integration and polish
   - Insert the calendar section into `AnalyticsContent.tsx`.
   - Ensure `keepPreviousData` avoids jarring blanking during month navigation.
   - Keep all labels concise in Russian, matching the current analytics page tone.
   - Verify no service worker cache policy changes are needed because analytics and transaction API responses must remain
     uncached.

## Test Plan

Backend:

```bash
pnpm --filter api test test/analytics.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

Frontend:

```bash
pnpm --filter web test analytics
pnpm --filter web typecheck
pnpm --filter web check
```

Repository-level checks when the implementation is non-trivial:

```bash
pnpm typecheck
pnpm check
pnpm test
```

Manual responsive checks without browser screenshot automation:

- Inspect mobile widths around 320px, 375px, and 430px.
- Verify day cells do not overflow or overlap.
- Verify bottom sheet opens, scrolls, and closes comfortably.
- Verify the selected day, today, and empty days are distinguishable.
- Verify a long transaction list remains scrollable without hiding the summary.

## Documentation / Operations Updates

- Update this plan's [work-log.md](./work-log.md) during implementation.
- Update `docs/` only if the implementation changes analytics architecture, query semantics, setup, or operational
  behavior.
- No new environment variables are expected.
- No database migration is expected unless the implementation uncovers a need for persisted user calendar preferences.

## Rollout Notes

- This can ship as a normal frontend/API feature once generated clients and tests pass.
- The backend response grows by one daily array. Keep the default range bounded to avoid large responses.
- If analytics is commonly opened with very large custom ranges, consider capping calendar rendering to the active visible
  month while the overview charts continue to use the full range.

## Risks

- The current analytics time series may not exactly match the desired calendar semantics for debt and transfer cash impact.
- A full transaction list inside a sheet may be too heavy or visually dense on small screens; be ready to extract a compact
  day-list presentation while preserving actions.
- Month navigation tied to global analytics filters may surprise users if they expected charts to keep a broader range.
- Long localized money labels can overflow small day cells if compact formatting is not deliberate.
- API contract changes require generated clients; missing generation will create frontend drift.

## Open Questions

- Should the calendar be a permanent analytics section or a tab/view switch between charts and calendar?
- Should week rows start on Monday for all locales, or follow a user/browser locale setting?
- Should day details show transfer transactions by default when the metric is `Net`, or only when transfer filters include
  them?
- Should users be able to persist their preferred calendar metric?
- Should clicking an empty day offer a quick create transaction action in a later iteration?
