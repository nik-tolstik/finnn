# Domain Model

## Core Entities

The Prisma schema in `packages/api/prisma/schema.prisma` is the source of truth.

Main models:

- `User` - authenticated user with optional email, optional password, verified email state, display avatar URL, and optional uploaded avatar storage key.
- `AuthIdentity` - external sign-in identity linked to a user, currently used for Telegram and Google.
- `Workspace` - shared financial space with owner, members, accounts, categories, transactions, transfers, debts, and invites.
- `WorkspaceMember` - user membership and role inside a workspace.
- `Account` - balance container with currency, owner, archive state, display metadata, and order.
- `Category` - income or expense classification.
- `PaymentTransaction` - income or expense transaction for one account.
- `TransferTransaction` - transfer between two accounts with source and destination amounts.
- `Debt` - open or closed debt with person, type, amount, remaining amount, and currency.
- `DebtTransaction` - operation applied to a debt, optionally linked to an account.
- `WorkspaceInvite` - tokenized invite to a workspace.
- `PendingRegistration` - pre-verification registration state.
- `PendingEmailVerification` - verification state for an existing user adding or changing email.
- `PasswordResetCode` - hashed short-lived email code for password reset.
- `ExchangeRate` - persisted daily currency rate.
- `TelegramBotPreference` - per-user Telegram bot context, active workspace, default accounts, timezone, and receipt mode.
- `AiFinanceDraft` - short-lived AI finance entry draft that must be confirmed before creating financial records.

## Identity And Email

`User.email` is optional because Telegram-authenticated users can exist before adding email. Email/password
registration and login still require email, and `PendingRegistration` remains email-based.
Existing signed-in users add or change email through `PendingEmailVerification`; the email is not treated as verified
until the token is confirmed through the shared email verification endpoint.

External identities are stored in `AuthIdentity`:

- `provider` identifies the external provider, such as `telegram`.
- `providerUserId` is the provider's durable user identifier.
- `username`, `displayName`, and `photoUrl` are display metadata.

Telegram OIDC login/linking and Telegram Mini App launch authentication both use `provider = "telegram"`, so the same
Telegram account resolves to the same Finnn user across browser login, account linking, and Mini App launch.

Telegram bot updates use the same identity row. The API resolves the Telegram sender id from update `from.id`, not
`chat.id`, through `AuthIdentity(provider = "telegram")`. Bot preferences and AI finance drafts are linked to `User`;
draft payloads are intermediate JSON and are not the source of truth for financial records.

Google login/linking uses `provider = "google"` and Google `sub` as `providerUserId`. A first Google login can auto-link
to an existing Finnn user only when Google returns `email_verified = true` and the local Finnn email is already verified.
New Google users created from verified Google email start with `User.emailVerified` set. Users who enter through a
provider without a verified local email can sign in only to complete email verification before using financial features.

`PasswordResetCode` stores only a bcrypt hash of the six-digit code. Password reset requests return the same success
shape whether or not an email exists, and confirmation updates `User.password`, deletes the code, and revokes active
sessions.

`User.image` is the display avatar field used by API DTOs and the web UI. It can be `null` for the generated initial
avatar, a bundled preset path under `/avatars/`, a Telegram photo URL, or the stable uploaded-avatar path
`/auth/users/:userId/avatar`. Uploaded avatar object keys are stored separately in `User.avatarStorageKey` so replacing
or clearing an uploaded avatar can clean up the old private bucket object.

The pair `(provider, providerUserId)` is unique. MongoDB must also keep a partial unique index on `users.email`
for string email values only, so multiple users without email are valid while duplicate real email addresses are not.

Workspace invites remain email-based:

- Creating an invite requires an email target.
- Accepting an invite requires the signed-in user to have the same verified email.
- Telegram-only users must add and verify email before accepting email invites.

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
- The linked debt transaction account balance.
- Related payment-category records when closing or settling.

Debts are not linked to a specific account. Account usage is recorded on individual debt transactions so a debt can be created, increased, and closed through different accounts or without account movement. `DebtTransaction.amount` is always denominated in the debt currency. `DebtTransaction.toAmount` is the account-side amount when the selected account currency differs from the debt currency, and account balance deltas use `toAmount` when it is present.

Debt mutation logic is intentionally centralized in `packages/api/src/debts/debts.service.ts` because several operations need coordinated account and debt updates.

## Exchange Rates

Currency support is centered around BYN, USD, EUR, and RUB.

Important files:

- `packages/api/src/currency/exchange-rate.service.ts` fetches external rates, persists daily exchange rates, and derives cross-rates.
- `packages/api/src/currency/currency.controller.ts` exposes exchange-rate reads and the protected cron endpoint.
- `packages/web/src/shared/api/generated/currency` is the frontend contract client for exchange-rate UI.

Telegram AI finance drafts convert payment entries to the selected account currency during draft resolution, before the
draft is previewed or committed. The draft keeps `originalAmount`, `originalCurrency`, and `exchangeRate` when a
conversion was applied, while `amount` remains the account-side value used by transaction creation.

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
