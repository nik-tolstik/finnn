# Account Personal Visibility

## Summary

Add a server-persisted, per-user preference for hiding active account cards on the dashboard. The existing `Все счета`
mode remains the recovery path and includes accounts hidden by the current user.

## Data and API

- Add the `HiddenAccount` MongoDB collection with a unique `(accountId, userId)` pair.
- Return `hidden` on account DTOs, computed for the authenticated user.
- Add idempotent `POST /accounts/:accountId/hide` and `POST /accounts/:accountId/show` endpoints.
- Remove preference rows when an archived account is permanently deleted.

## Frontend behavior

- Add a dynamic `Скрыть`/`Показать` action to the account actions dialog.
- Apply the change optimistically through the existing workspace cache helpers and roll back on failure.
- Filter hidden accounts only from the default dashboard card view; keep them in account data used by operations and
  analytics.

## Verification

- Run account API e2e tests and account visibility/API adapter unit tests.
- Run `pnpm db:generate`, `pnpm api:generate`, `pnpm api:check-generated`, `pnpm typecheck`, and `pnpm check`.
- Confirm the generated OpenAPI and Orval files are committed and contain the new routes and DTO field.
