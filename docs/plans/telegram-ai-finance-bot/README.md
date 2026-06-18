# Telegram AI Finance Bot Plan

## Goal

Add an AI-assisted Telegram bot flow that lets users create financial records without opening the Finnn web app.

The primary target experience is:

```text
User sends text, voice, or receipt image
API extracts intent and receipt data
Bot asks only for missing or uncertain fields
User answers with inline buttons or free text
API updates the draft
Bot shows a transaction preview
User confirms in Telegram
API commits records through existing finance services
```

The bot must be useful for quick entry and receipt capture. A user should be able to add several expense transactions
from one receipt photo after a short Telegram conversation.

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

- Users can send regular text messages to the bot to create expenses, income, transfers, or later debt operations.
- Users can send Telegram voice messages. The API transcribes audio, then runs the same intent extraction pipeline as
  text messages.
- Users can send receipt/check photos. The API extracts receipt items, totals, currency, merchant, and date when possible.
- Receipt photos should default to grouped transactions by category, not one giant transaction and not one transaction
  per receipt line.
- The user can switch receipt mode to:
  - one transaction for the full receipt total;
  - grouped transactions by category;
  - one transaction per receipt item.
- The bot asks for workspace only when the user has more than one accessible workspace or no active workspace context.
- The bot asks for account only when no default account exists, the input does not identify an account, or confidence is
  low.
- The bot asks for date when no date was found or confidence is low. Users may answer in natural language, such as
  `5 days ago`, `yesterday evening`, or `last Friday`.
- The bot must support inline buttons and free-text answers for the same missing-field questions.
- The bot must show a clear preview before creating records.
- The bot must not auto-create financial records from AI output without explicit user confirmation.
- The bot must commit through existing NestJS finance services instead of writing directly to Prisma collections.
- The bot must preserve existing browser and Mini App behavior.

## Non-Goals For MVP

- Do not require the user to open the web app or Mini App for the normal create flow.
- Do not build a separate Mini App review surface for MVP unless Telegram-only confirmation proves insufficient.
- Do not implement autonomous record creation without confirmation.
- Do not implement long-term storage for raw receipt images or voice files.
- Do not hand-edit generated OpenAPI or Orval client files.
- Do not add an icon pack, unrelated UI redesign, or marketing/landing surface.
- Do not run browser screenshot QA unless explicitly requested.

## Current Architecture Summary

Backend:

- Telegram auth and Mini App session creation are implemented under `packages/api/src/auth`.
- Telegram identities are stored in `AuthIdentity` with `provider = "telegram"`.
- `TELEGRAM_BOT_TOKEN` exists and is currently used for Telegram Mini App `initData` validation.
- There is no existing Telegram message bot runtime, webhook controller, or bot SDK dependency.
- Sessions are cookie-based for the web app, but Telegram bot actions must resolve users by Telegram sender id through
  `AuthIdentity`.
- Finance creation logic lives in:
  - `packages/api/src/transactions/transactions.service.ts`
  - `packages/api/src/debts/debts.service.ts`
  - `packages/api/src/accounts/accounts.service.ts`
  - `packages/api/src/categories/categories.service.ts`
- Money values are strings. Persisted money logic must keep using project money helpers and existing service invariants.
- Prisma schema is `packages/api/prisma/schema.prisma`.

Frontend:

- Mini App auth bootstrap is global and existing protected routes are reused.
- Workspace routing is URL-based through `workspaceId`.
- Existing account/category/date selectors are available if a future Mini App review surface is added:
  - `packages/web/src/shared/components/AccountSelector.tsx`
  - `packages/web/src/shared/components/CategorySelectModal.tsx`
  - `packages/web/src/shared/ui/date-time-picker/DateTimePicker.tsx`
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Provider Choice

Use OpenRouter as the AI provider.

Relevant OpenRouter capabilities:

- Chat Completions-compatible endpoint for text and multimodal extraction.
- Structured outputs through `response_format` and JSON schema for draft extraction.
- Image inputs through `image_url` content parts for receipt understanding.
- Speech-to-text endpoint for voice transcription.

Implementation must still validate OpenRouter output locally. Structured output support reduces parser risk but is not a
security boundary.

Recommended environment variables:

```bash
OPENROUTER_API_KEY="..."
OPENROUTER_APP_REFERER="https://finnn.xyz"
OPENROUTER_APP_TITLE="Finnn"
OPENROUTER_TEXT_MODEL="..."
OPENROUTER_VISION_MODEL="..."
OPENROUTER_TRANSCRIPTION_MODEL="..."
TELEGRAM_BOT_WEBHOOK_SECRET="..."
TELEGRAM_BOT_WEBHOOK_URL="https://api.finnn.xyz/telegram/webhook"
TELEGRAM_BOT_DRAFT_TTL_SECONDS="1800"
```

Keep production and development bot configuration separated, matching the existing Telegram auth and Mini App operations
docs.

## High-Level Architecture

Add two backend feature modules.

### Telegram Bot Module

Suggested path: `packages/api/src/telegram-bot`.

Responsibilities:

- Receive Telegram updates through `POST /telegram/webhook`.
- Verify Telegram webhook secret header.
- Parse message, photo, voice, and callback query updates.
- Download Telegram files for photos and voice messages.
- Send, edit, and answer Telegram messages/callbacks.
- Resolve Telegram sender id to Finnn user through `AuthIdentity(provider = "telegram")`.
- Route user input to the active draft state machine.
- Send auth/linking guidance if the Telegram sender is unknown.

Suggested files:

```text
packages/api/src/telegram-bot/telegram-bot.module.ts
packages/api/src/telegram-bot/telegram-bot.controller.ts
packages/api/src/telegram-bot/telegram-bot.service.ts
packages/api/src/telegram-bot/telegram-bot.client.ts
packages/api/src/telegram-bot/telegram-bot.dto.ts
packages/api/src/telegram-bot/telegram-update.types.ts
packages/api/src/telegram-bot/telegram-callback-data.ts
```

### AI Finance Module

Suggested path: `packages/api/src/ai-finance`.

Responsibilities:

- Create and update AI finance drafts.
- Extract intent and receipt data with OpenRouter.
- Normalize natural-language dates with user timezone and conversation context.
- Resolve workspace, account, category, currency, and debt references.
- Track missing fields and confidence.
- Render Telegram-friendly preview text.
- Commit confirmed drafts through existing finance services.

Suggested files:

```text
packages/api/src/ai-finance/ai-finance.module.ts
packages/api/src/ai-finance/openrouter.client.ts
packages/api/src/ai-finance/ai-finance-parser.service.ts
packages/api/src/ai-finance/ai-finance-draft.service.ts
packages/api/src/ai-finance/ai-finance-resolver.service.ts
packages/api/src/ai-finance/ai-finance-preview.service.ts
packages/api/src/ai-finance/ai-finance-commit.service.ts
packages/api/src/ai-finance/ai-finance.dto.ts
packages/api/src/ai-finance/ai-finance.types.ts
```

## Data Model

Add durable bot preferences and short-lived drafts.

Suggested Prisma models:

```prisma
model TelegramBotPreference {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  userId            String   @unique @db.ObjectId
  telegramChatId    String?
  activeWorkspaceId String?  @db.ObjectId
  defaultAccountByWorkspace Json?
  receiptMode       String   @default("category")
  timezone          String   @default("Europe/Minsk")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([activeWorkspaceId])
  @@map("telegram_bot_preferences")
}

model AiFinanceDraft {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  userId         String   @db.ObjectId
  telegramChatId String?
  workspaceId    String?  @db.ObjectId
  status         String   @default("pending")
  sourceType     String
  sourceText     String?
  receiptMode    String?
  kind           String?
  payload        Json
  missingFields  String[]
  confidence     Float?
  currentQuestion String?
  expiresAt      DateTime
  committedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId, status, updatedAt])
  @@index([telegramChatId, status, updatedAt])
  @@index([expiresAt])
  @@map("ai_finance_drafts")
}
```

The exact `payload` TypeScript type should be a discriminated union in API code. Prisma can store it as JSON because
drafts are intermediate state, not source-of-truth financial records.

## Draft State Machine

The bot should create a draft immediately after the first user message.

States:

- `pending`: draft exists and may have missing fields.
- `ready`: all required fields are resolved and preview can be confirmed.
- `committed`: records were created.
- `cancelled`: user cancelled.
- `expired`: draft TTL elapsed.
- `failed`: unrecoverable parser or commit error.

The state machine should fill slots in this order for payment receipt MVP:

1. `workspaceId`
2. `accountId`
3. `date`
4. `category grouping`
5. `amounts`
6. `description`
7. `preview confirmation`

Free-text answers must be interpreted in the context of the current question. If the current missing field is `date`,
`5 days ago` should update the draft date, not start a new transaction. Still allow a user answer to update multiple
fields when it clearly includes them, for example: `5 days ago, and use Best Bank`.

## Telegram UX

### Start And Auth

`/start` should:

- Resolve the Telegram sender id.
- If no linked Finnn user exists, show a message with an auth/Mini App button.
- If linked, show active workspace/account context and short examples.

### Workspace Selection

Rules:

- If the user has one accessible workspace, select it automatically.
- If user context already has `activeWorkspaceId` and access is still valid, reuse it.
- If several workspaces are available and none is active, ask with inline buttons.
- Provide `/workspace` command to change context.

### Account Selection

Rules:

- If a message names an account with high confidence, use it.
- Else if a default account exists for the active workspace, use it.
- Else ask with inline buttons.
- Provide `/account` command to change default account for the active workspace.
- Do not use archived accounts by default.

### Date Selection

Rules:

- If receipt or message contains a confident date, use it.
- Else default to today only for simple text transactions.
- For receipt photos, ask for date if receipt date is missing or uncertain.
- User may answer with free text.
- Normalize relative dates using preference timezone.

### Receipt Preview

Default receipt preview should group items by category:

```text
Workspace: My Workspace
Account: Best Bank
Date: 2026-06-13

Will create expenses:
- Groceries: 42.10 BYN
- Home: 12.90 BYN
- Health: 8.40 BYN

Total: 63.40 BYN
```

Suggested buttons:

- `Create`
- `Edit`
- `One transaction`
- `By category`
- `By items`
- `Cancel`

All button labels can be localized later. Callback payloads should be compact and contain only action plus draft id.

## Commit Rules

- Never commit directly from model output.
- Only commit `ready` drafts after explicit user confirmation.
- Re-read draft and user access at commit time.
- Use `prisma.$transaction` for multi-record receipt commits.
- Reuse existing domain services where possible.
- If existing services only support single-record creation, add service-level batch methods rather than duplicating
  balance logic in the AI module.
- After commit, mark draft as `committed` and include created record ids in draft payload or audit metadata.

For receipt MVP, implement a batch payment transaction commit. It should create several `PaymentTransaction` records and
apply the combined account balance delta atomically.

## Required API Hardening Before Commit

Before AI-created records are allowed, tighten these invariants:

- Payment create/update must verify `categoryId` belongs to the same workspace and has the correct type.
- Payment create/update must not accept archived accounts unless a future explicit product rule allows it.
- Account create/update must validate `balance` as a valid money string.
- Account `ownerId`, when provided, must belong to a member of the workspace.
- Debt `add` and `close` DTOs should support optional `date` so AI can record historical debt operations later.
- Multi-record receipt commit must fail atomically on insufficient balance or invalid categories.

## AI Extraction Contract

Use a strict local TypeScript validator for the model response.

Suggested high-level schema:

```ts
type AiFinanceExtraction =
  | {
      kind: "payment";
      paymentType: "expense" | "income";
      amount: string | null;
      currency: string | null;
      description: string | null;
      merchant: string | null;
      dateText: string | null;
      accountHint: string | null;
      categoryHint: string | null;
      confidence: number;
    }
  | {
      kind: "receipt";
      merchant: string | null;
      totalAmount: string | null;
      currency: string | null;
      dateText: string | null;
      accountHint: string | null;
      items: Array<{
        name: string;
        amount: string | null;
        categoryHint: string | null;
        confidence: number;
      }>;
      confidence: number;
    }
  | {
      kind: "transfer";
      amount: string | null;
      toAmount: string | null;
      fromAccountHint: string | null;
      toAccountHint: string | null;
      dateText: string | null;
      description: string | null;
      confidence: number;
    }
  | {
      kind: "unknown";
      reason: string;
      confidence: number;
    };
```

Receipt category grouping should be computed by API code after resolving category hints, not trusted blindly from the
model.

## Implementation Phases

### Phase 1: Planning And Safety Baseline

- Read this plan, root `AGENTS.md`, Telegram auth/Mini App docs, and relevant finance service tests.
- Create or confirm a feature branch.
- Record the first implementation work-log entry.
- Add API hardening tests for category workspace/type, archived accounts, account balance validation, and account owner
  membership.
- Implement hardening changes before enabling AI commit.

### Phase 2: Telegram Bot Runtime

- Add bot module, webhook controller, Telegram client, update DTO/types, and webhook secret validation.
- Add `/start`, `/cancel`, `/workspace`, `/account` command handling.
- Resolve Telegram sender id through `AuthIdentity(provider = "telegram")`.
- Add e2e tests for unknown user, known user, webhook secret failure, and command routing.

### Phase 3: Draft Storage And Preferences

- Add Prisma models for `TelegramBotPreference` and `AiFinanceDraft`.
- Run `pnpm db:generate`.
- Add draft service with create/update/expire/cancel/commit state transitions.
- Add preference service for active workspace, default account, timezone, and receipt mode.
- Add tests for workspace auto-selection and draft TTL behavior.

### Phase 4: OpenRouter Text Parser

- Add `OpenRouterClient`.
- Add structured-output extraction for text messages.
- Add local response validation and parser failure handling.
- Implement slot filling for simple expense/income text messages.
- Add tests with mocked OpenRouter responses.

### Phase 5: Telegram Questions And Confirmation

- Add inline keyboard builders for workspace/account/receipt mode/confirmation.
- Add callback query handling with compact callback data.
- Add free-text answer handling based on `currentQuestion`.
- Add preview renderer.
- Commit simple payment drafts through `TransactionsService`.
- Add e2e tests for a full Telegram text expense flow.

### Phase 6: Receipt Photo Support

- Download Telegram photo files.
- Send image to OpenRouter vision model.
- Parse receipt items and totals.
- Resolve/group items by category.
- Ask for missing workspace/account/date/category information.
- Add batch payment transaction commit.
- Add tests for grouped receipt commit, one-transaction commit, and insufficient-balance rollback.

### Phase 7: Voice Support

- Download Telegram voice files.
- Transcribe through OpenRouter speech-to-text endpoint.
- Feed transcript into the same text parser.
- Add tests for mocked voice transcription.

### Phase 8: Transfers And Debts

- Add transfer draft support.
- Add debt creation support.
- Add debt add/close only after DTOs support optional historical dates.
- Add tests for cross-currency and insufficient-balance cases.

### Phase 9: Documentation And Operations

- Update `docs/architecture.md`, `docs/development.md`, `docs/operations.md`, and `.env.example` files.
- Document BotFather webhook setup for PROD and DEV bots.
- Document OpenRouter model/env configuration.
- Document manual Telegram testing checklist.
- Run required checks.

## Verification

For non-trivial implementation phases, run relevant targeted checks before finishing:

```bash
pnpm --filter api typecheck
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api test test/transactions.e2e.test.ts
pnpm --filter api test test/ai-finance.e2e.test.ts
pnpm api:generate
pnpm api:check-generated
pnpm typecheck
pnpm check
```

Full `pnpm test` should run before finalizing the complete feature if time and environment allow.

Do not run Playwright, browser screenshot QA, `agent-browser`, or similar browser automation unless the user explicitly
asks for screenshot/browser QA.

## Open Questions

- Which OpenRouter model slugs should be used for text, vision, and transcription in production?
- Should receipt categories use only existing categories for MVP, or allow explicit creation during confirmation?
- What should happen when receipt total and item total disagree?
- Should default account be global per workspace or scoped per Telegram chat?
- Should Telegram group chats be supported, or only direct chats for MVP? Recommended MVP: direct chats only.
- How should failed commits be retried when a draft becomes invalid because account balance changed?

