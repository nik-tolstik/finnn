# Domain Model

## Core Entities

The Prisma schema in `packages/api/prisma/schema.prisma` is the source of truth.

Main models:

- `User` - authenticated user with optional password and verified email state.
- `Workspace` - shared financial space with owner, members, accounts, categories, transactions, transfers, debts, and invites.
- `WorkspaceMember` - user membership and role inside a workspace.
- `Account` - balance container with currency, owner, archive state, display metadata, and order.
- `Category` - income or expense classification.
- `PaymentTransaction` - income or expense transaction for one account.
- `TransferTransaction` - transfer between two accounts with source and destination amounts.
- `Debt` - open or closed debt with person, type, amount, remaining amount, currency, and optional linked account.
- `DebtTransaction` - operation applied to a debt, optionally linked to an account.
- `WorkspaceInvite` - tokenized invite to a workspace.
- `PendingRegistration` - pre-verification registration state.
- `ExchangeRate` - persisted daily currency rate.

## Workspace Boundary

Most domain data belongs to a workspace. API reads and mutations must enforce that the current user has access to that workspace.

Use:

- API auth guards when only authentication is required.
- `WorkspaceAccessGuard` for regular workspace access.
- `WorkspaceRoles(...)` metadata when a command requires admin or owner permissions.

Workspace roles are defined in `packages/api/src/workspace/workspace.constants.ts`. Frontend display constants live in `packages/web/src/modules/workspace/workspace.constants.ts`.

## Money Rules

Persisted financial amounts are strings. This avoids binary floating point issues and keeps formatting/conversion explicit.

Use:

- `packages/api/src/common/money.ts` for persisted backend money operations.
- `packages/web/src/shared/utils/money.ts` for frontend add, subtract, compare, multiply, divide, and formatting.
- `packages/web/src/shared/lib/balance-domain.ts` for UI/cache projections that map transactions, transfers, and debt operations to account balance deltas.
- `packages/web/src/shared/lib/domain-types.ts` for frontend branded IDs and money/currency domain values.

Do not use raw JavaScript arithmetic for persisted money behavior.

## Accounts

Accounts belong to a workspace and can optionally have an owner. Frontend owner visibility rules live in `packages/web/src/modules/accounts/account-visibility.ts`.

Accounts are archived instead of deleted for normal user flows. Deletion must account for dependencies:

- Payment transactions.
- Transfer transactions.
- Debts.
- Debt transactions.

Account order is stored as an integer and used by the dashboard account card views.

## Categories

Categories belong to a workspace and have a `type`:

- `income`
- `expense`

New workspaces are seeded with standard expense categories and one income category by the API workspace service.

Category changes should invalidate accounting-related client query domains because transaction lists, filters, and analytics may depend on category metadata.

## Payment Transactions

A payment transaction changes one account:

- Income increases account balance.
- Expense decreases account balance.

Creation and update rules include:

- The account must belong to the workspace.
- The transaction date cannot be before the account creation date.
- Expense amount cannot exceed the account balance.
- A newly typed category may be created during transaction creation.

## Transfers

A transfer changes two accounts:

- Source account gets `-amount`.
- Destination account gets `+toAmount`.

Rules include:

- Source and destination accounts must belong to the workspace.
- Source and destination accounts must be different.
- Source amount cannot exceed source account balance.
- `createdById` stores the user that created the transfer.

Transfers support cross-currency use cases by storing both source `amount` and destination `toAmount`.

## Debts

Debts track money lent or borrowed and can be open or closed.

Debt types are defined in `packages/web/src/modules/debts/debt.constants.ts` for frontend UI and mirrored by API DTO/domain values. Debt operations can affect:

- The debt amount.
- The remaining amount.
- The linked account balance.
- Related payment-category records when closing or settling.

Debt mutation logic is intentionally centralized in `packages/api/src/debts/debts.service.ts` because several operations need coordinated account and debt updates.

## Exchange Rates

Currency support is centered around BYN, USD, and EUR.

Important files:

- `packages/api/src/currency/exchange-rate.service.ts` fetches external rates, persists daily exchange rates, and derives cross-rates.
- `packages/api/src/currency/currency.controller.ts` exposes exchange-rate reads and the protected cron endpoint.
- `packages/web/src/shared/api/generated/currency` is the frontend contract client for exchange-rate UI.

The API cron endpoint must be protected with `CRON_SECRET`.

## PWA Cache Boundary

The service worker in `packages/web/public/sw.js` only caches static assets.

It must not cache:

- `/api/**`
- App documents and dashboard routes.
- `/_next/data/**`
- API or data responses.
- Non-GET requests.

The test `packages/web/src/shared/lib/service-worker-cache-policy.test.ts` protects this boundary.
