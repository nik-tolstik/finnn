# Telegram AI Finance Bot Work Log

This file is the required execution history for the Telegram AI Finance Bot project.

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

## 2026-06-18 03:03 +03 - Codex / Planning

### Scope

- Created the initial implementation plan for Telegram AI-assisted finance entry.
- Captured the product decision to make Telegram the primary confirmation surface instead of requiring the Mini App.
- Captured receipt grouping by category as the recommended default mode.
- Captured user context preferences for active workspace, default account, timezone, and receipt mode.
- Created this work log so future Developer agents can leave execution history.
- Created a short orchestration prompt that points future agents to the plan as the source of truth.

### Files Changed

- `docs/plans/telegram-ai-finance-bot/README.md`
- `docs/plans/telegram-ai-finance-bot/work-log.md`
- `docs/plans/telegram-ai-finance-bot/prompt.md`

### Commands Run

```bash
git status --short && git branch --show-current
find docs/plans -maxdepth 2 -type f | sort
sed -n '1,180p' docs/plans/telegram-mini-app/README.md
sed -n '1,140p' docs/plans/telegram-mini-app/work-log.md
sed -n '1,80p' docs/plans/telegram-mini-app/prompt.md
git switch -c codex/telegram-ai-finance-bot
date '+%Y-%m-%d %H:%M %z %Z'
mkdir -p docs/plans/telegram-ai-finance-bot
apply_patch
git status --short --branch
sed -n '1,220p' docs/plans/telegram-ai-finance-bot/README.md
sed -n '220,520p' docs/plans/telegram-ai-finance-bot/README.md
sed -n '1,220p' docs/plans/telegram-ai-finance-bot/work-log.md
sed -n '1,160p' docs/plans/telegram-ai-finance-bot/prompt.md
tail -80 docs/plans/telegram-ai-finance-bot/README.md
```

### Results

- Planning documents were created.
- No feature implementation was started.
- Verification was limited to reading the new plan files and checking git status.

### Decisions

- Use a draft-first slot-filling state machine.
- Create a draft immediately after the first user message, then update it as the user answers bot questions.
- Ask for workspace only when there are multiple available workspaces or active context is missing.
- Use grouped-by-category receipt transactions as the default receipt mode.
- Require explicit Telegram confirmation before committing records.
- Commit through existing finance services and add batch commit support for receipts instead of duplicating balance logic.

### Subagent Contributions

- Telegram explorer confirmed that the repo currently has Telegram auth and Mini App auth, but no Telegram message bot
  webhook/runtime.
- Domain explorer confirmed the required finance invariants, existing services to reuse, and hardening needed before AI
  commit.
- Frontend explorer confirmed existing workspace/account/category/date selection patterns and recommended Telegram-first
  confirmation for MVP.

### Blockers / Follow-ups

- Implementation not started.
- OpenRouter production model slugs still need to be selected.
- Real Telegram bot webhook testing will require deployed DEV/PROD bot configuration.

## 2026-06-18 03:11 +03 - Codex / Developer

### Scope

- Completed Phase 1 safety baseline before enabling AI-created finance records.
- Added payment transaction hardening for archived accounts and category workspace/type invariants.
- Added account hardening for valid money balance strings and account owners who must belong to the workspace.
- Added optional historical dates for debt add/close DTOs and service logic.

### Files Changed

- `packages/api/src/accounts/accounts.dto.ts`
- `packages/api/src/accounts/accounts.service.ts`
- `packages/api/src/debts/debts.dto.ts`
- `packages/api/src/debts/debts.service.ts`
- `packages/api/src/transactions/transactions.service.ts`
- `packages/api/test/accounts.e2e.test.ts`
- `packages/api/test/debts.e2e.test.ts`
- `packages/api/test/transactions.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/accounts.e2e.test.ts test/transactions.e2e.test.ts test/debts.e2e.test.ts
```

### Results

- Passed: 3 test files, 47 tests.

### Decisions

- Kept financial invariant checks in existing domain services so future AI commit paths can reuse them.
- Rejected archived accounts through the shared transaction account lookup and also rejected edits to payment transactions whose current account is archived.
- Validated payment category ids by workspace and transaction type before connect/create.
- Used DTO validation for account balance syntax and service-level validation for owner workspace membership.

### Subagent Contributions

- Pascal / Explorer: mapped finance hardening risks in account, transaction, and debt services and identified exact tests to add.
- Gauss / Explorer: mapped Telegram bot reuse points for the next phases, including resolving Telegram users through `AuthIdentity(provider = "telegram")`, avoiding cookie guards on webhooks, and following current env/test patterns.

### Blockers / Follow-ups

- OpenRouter production model slugs still need to be selected.
- Real Telegram bot webhook testing will require deployed DEV/PROD bot configuration.
- Continue with draft/preference storage, Telegram bot runtime, and parser/confirmation flows.

## 2026-06-18 03:25 +03 - Codex / Developer

### Scope

- Implemented the Telegram bot webhook runtime and AI finance draft flow.
- Added Prisma models for `TelegramBotPreference` and `AiFinanceDraft`, then regenerated Prisma Client.
- Added OpenRouter client/parser support for structured text and receipt extraction plus voice transcription.
- Added Telegram text, receipt photo, voice, command, callback, receipt-mode, cancel, and confirmation routing.
- Added AI finance resolver, preview, draft, preference, and commit services.
- Added text transfer preview and commit support through existing transfer transaction logic.
- Added batch payment transaction creation for atomic multi-entry receipt commits.
- Updated docs, env examples, OpenAPI, and generated web API clients.

### Files Changed

- `packages/api/prisma/schema.prisma`
- `packages/api/src/ai-finance/*`
- `packages/api/src/telegram-bot/*`
- `packages/api/src/app.module.ts`
- `packages/api/src/openapi.ts`
- `packages/api/src/transactions/transactions.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `packages/api/openapi.json`
- `packages/web/src/shared/api/generated/**`
- `packages/api/.env.example`
- `docs/architecture.md`
- `docs/development.md`
- `docs/domain-model.md`
- `docs/operations.md`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm db:generate
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm api:generate
pnpm --filter api test test/accounts.e2e.test.ts test/transactions.e2e.test.ts test/debts.e2e.test.ts test/telegram-bot.e2e.test.ts
pnpm api:check-generated
pnpm --filter api exec biome check . --write --unsafe
pnpm --filter api check
pnpm --filter api typecheck
pnpm typecheck
pnpm check
pnpm test
git diff --check
```

### Results

- Passed: targeted API e2e suites, 4 files / 52 tests.
- Passed: full API test suite, 12 files / 169 tests.
- Passed: full web test suite, 28 files / 108 tests.
- Passed: `pnpm typecheck`.
- Passed: `pnpm check`.
- Passed: `pnpm api:check-generated`.
- Passed: `git diff --check`.

### Decisions

- Implemented the webhook as a raw Telegram endpoint secured by `x-telegram-bot-api-secret-token`, not cookie auth.
- Resolved bot users through `AuthIdentity(provider = "telegram")` and Telegram sender `from.id`.
- Kept AI drafts as intermediate JSON and committed payments/transfers only after Telegram callback confirmation.
- Used the existing transaction service for final record creation and added a service-level batch method for receipt-style
  multi-record commits.
- Used fetch-based Telegram/OpenRouter clients to avoid adding SDK dependencies.
- Kept browser screenshot QA out of scope per project instructions.

### Subagent Contributions

- Pascal / Explorer: Phase 1 finance hardening map that guided invariant tests and service changes.
- Gauss / Explorer: Telegram auth/runtime map that guided webhook auth, identity resolution, and e2e mocking style.

### Blockers / Follow-ups

- OpenRouter production model slugs still need to be chosen for text, vision, and transcription.
- Real Telegram webhook testing still requires DEV/PROD bot webhook setup and deployed environment variables.
- Debt operations remain a later extension; the MVP supports expenses, income, transfers, receipt photos, and voice input.
- Receipt category matching currently resolves to existing categories only; category creation during confirmation remains a
  future product decision.

## 2026-06-18 12:30 +03 - Codex / Developer

### Scope

- Improved Telegram bot UX when a linked user has no accessible workspaces.
- Replaced the empty workspace-selection keyboard with a direct message telling the user to create a workspace in Finnn
  first, plus an `Open Finnn` Mini App button.
- Applied the same fallback to draft responses from text, receipt photo, voice, and workspace command paths.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 6 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept financial record creation blocked when no workspace exists.
- Used the existing Mini App/open-Finnn button pattern instead of creating workspaces from Telegram bot chat.

### Subagent Contributions

- None for this small follow-up.

### Blockers / Follow-ups

- None for this UX fix.

## 2026-06-18 12:53 +03 - Codex / Developer

### Scope

- Fixed local Telegram webhook testing when `WEB_APP_URL` points to `http://localhost:3000`.
- Skipped the Telegram Mini App button for non-HTTPS web URLs because Telegram rejects `web_app` buttons without HTTPS.
- Included Telegram Bot API `description` details in webhook error responses to make future 400s diagnosable.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.client.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 7 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept the `Open Finnn` Mini App button for HTTPS environments.
- Treated local HTTP as a development-only fallback where the bot still replies, just without the Mini App button.

### Subagent Contributions

- None for this local debugging fix.

### Blockers / Follow-ups

- None.

## 2026-06-18 14:53 +03 - Codex / Reviewer Integration

### Scope

- Integrated high-signal reviewer findings after the conversational bot implementation.
- Ignored Telegram messages and callbacks from non-private chats to avoid leaking finance previews in groups.
- Made draft confirmation safer under Telegram retries by reserving ready drafts with a `committing` status before creating transactions.
- Returned already committed draft transaction IDs instead of creating duplicates on stale callback retries.
- Moved callback parsing inside the guarded callback handler path.
- Replaced floating-point receipt grouping with `addMoney`.
- Added regression coverage for group chat ignores, malformed callback data, and already committed callback retries.

### Files Changed

- `packages/api/src/ai-finance/ai-finance.types.ts`
- `packages/api/src/ai-finance/ai-finance-draft.service.ts`
- `packages/api/src/ai-finance/ai-finance-commit.service.ts`
- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 26 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept old callback handling compatible, but made it safe for malformed data and stale committed drafts.
- Used a string status for `committing` because draft status is already stored as a string in MongoDB; no schema migration required.
- Left larger test-fixture cleanup as a follow-up to avoid mixing structural cleanup with behavior fixes.

### Subagent Contributions

- Reviewer subagent identified privacy, idempotency, callback, and money precision risks.
- Fixer subagent extracted `updateDraftFromResolved` before this integration pass.

### Blockers / Follow-ups

- Consider a separate cleanup pass for shared Telegram e2e draft fixture builders.

## 2026-06-18 13:01 +03 - Codex / Developer

### Scope

- Improved OpenRouter runtime diagnostics for local Telegram bot testing.
- Included OpenRouter error messages and codes in extraction/transcription `BadRequestException` responses.

### Files Changed

- `packages/api/src/ai-finance/openrouter.client.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 7 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept the existing OpenRouter request payload unchanged.
- Surfaced provider diagnostics instead of mapping all non-2xx extraction failures to a generic message.

### Subagent Contributions

- None for this diagnostics fix.

### Blockers / Follow-ups

- Retry the local Telegram message after restarting the API to capture the exact provider-side failure reason if it still fails.

## 2026-06-18 13:04 +03 - Codex / Developer

### Scope

- Improved OpenRouter structured-output compatibility for Telegram AI extraction.
- Added `provider.require_parameters: true` so OpenRouter routes only to endpoints that support requested parameters such
  as `response_format`.
- Expanded OpenRouter error diagnostics with provider metadata and raw provider error details.

### Files Changed

- `packages/api/src/ai-finance/openrouter.client.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 7 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept strict JSON schema extraction.
- Used OpenRouter provider routing instead of weakening extraction to plain JSON mode.

### Subagent Contributions

- None for this compatibility fix.

### Blockers / Follow-ups

- Retry the local Telegram message after restarting the API.

## 2026-06-18 13:24 +03 - Codex / Developer

### Scope

- Improved Telegram callback UX when pressing `Create` fails during draft commit.
- Added callback error handling that answers the Telegram callback query and edits the message with the domain error.
- Added regression coverage for a failed payment commit.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 8 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept commit validation in the existing transaction services.
- Showed commit failures in Telegram instead of leaving the callback spinner/message unchanged.

### Subagent Contributions

- None for this callback UX fix.

### Blockers / Follow-ups

- Retry the local `Create` action after restarting the API to see the exact domain error, if any.

## 2026-06-18 13:26 +03 - Codex / Developer

### Scope

- Fixed Telegram `Create` callbacks when `answerCallbackQuery` fails because the query is too old or invalid.
- Acknowledged callback queries before commit work starts.
- Made callback acknowledgement best-effort so an expired query cannot block message edits or commit results.
- Added regression coverage for successful commit with an expired Telegram callback acknowledgement.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 9 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Treated Telegram callback acknowledgement as best-effort transport UX.
- Kept the actual operation result visible through `editMessageText`.

### Subagent Contributions

- None for this callback transport fix.

### Blockers / Follow-ups

- Restart the API and retry the Telegram `Create` button.

## 2026-06-18 13:39 +03 - Codex / Developer

### Scope

- Fixed text extraction for messages containing multiple independent payment operations.
- Added `payments` extraction kind with multiple payment items.
- Resolved account/date/category data per payment item and included account/currency details in preview entries.
- Added regression coverage for a two-line Telegram message producing two payment preview rows.

### Files Changed

- `packages/api/src/ai-finance/ai-finance.types.ts`
- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/src/ai-finance/ai-finance-preview.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 10 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept receipt extraction separate from multi-payment text extraction.
- Used per-entry account resolution for multi-payment text messages.

### Subagent Contributions

- None for this extraction follow-up.

### Blockers / Follow-ups

- Restart the API and retry the multi-line Telegram text message.

## 2026-06-18 13:59 +03 - Codex / Developer

### Scope

- Added Telegram chat UX feedback while AI finance parsing is running.
- Sent a temporary `Думаю...` message for text, receipt photo, and voice inputs.
- Deleted the temporary message before sending the final draft response.
- Added Telegram `deleteMessage` client support.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.client.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 11 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept thinking-message send/delete best-effort so Telegram transport issues do not block the final response.
- Did not show thinking messages for commands or callback button actions.

### Subagent Contributions

- None for this UX follow-up.

### Blockers / Follow-ups

- Restart the API and retry text/photo/voice Telegram inputs.

## 2026-06-18 14:05 +03 - Codex / Developer

### Scope

- Added plain-text editing for active ready Telegram AI finance drafts.
- Treated text messages sent while a ready draft exists as edit instructions instead of starting a new draft.
- Supported category moves such as `Ноутбук в подарки` by matching an existing category name and the target entry
  description.
- Added regression coverage for moving a notebook entry into `Подарки`.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 12 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept category edit deterministic: it uses existing category names and entry descriptions from the current draft.
- Did not invoke OpenRouter for simple ready-draft category edits.

### Subagent Contributions

- None for this draft-editing follow-up.

### Blockers / Follow-ups

- Restart the API and retry sending `Ноутбук в подарки` while a ready draft is active.

## 2026-06-18 13:57 +03 - Codex / Developer

### Scope

- Reworked category selection to use workspace catalog context in the AI prompt.
- Loaded the active/single accessible workspace before text and receipt extraction.
- Passed existing account names and category names/types to OpenRouter.
- Instructed the model to choose exact existing category/account names and never invent them.
- Removed runtime stem-like/synonym category fallback from the resolver.

### Files Changed

- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 11 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Made the model responsible for selecting from the user's actual workspace categories.
- Kept backend validation deterministic: it only accepts category names that match existing categories for the entry type.
- Kept fallback behavior for missing workspace context: ask the user for workspace/account as before.

### Subagent Contributions

- None for this prompt-context refactor.

### Blockers / Follow-ups

- Restart the API and retry the multi-line Telegram text message.

## 2026-06-18 13:52 +03 - Codex / Developer

### Scope

- Improved category fallback matching when OpenRouter does not return `categoryHint`.
- Matched categories against payment description, merchant, and receipt item name in addition to category hints.
- Added Russian stem-like hints for forms such as `машину` matching category `Машина`, and `блины` matching `Питание`.
- Updated regression coverage so multi-payment categorization works with null category hints and categories `Питание` /
  `Машина`.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 11 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept matching deterministic and local to existing workspace categories.
- Did not add automatic category creation.

### Subagent Contributions

- None for this category fallback fix.

### Blockers / Follow-ups

- Restart the API and retry the multi-line Telegram text message.

## 2026-06-18 13:45 +03 - Codex / Developer

### Scope

- Fixed Telegram mode callbacks that keep the rendered preview unchanged.
- Treated Telegram `message is not modified` edit failures as successful no-ops.
- Removed a duplicate direct callback acknowledgement after the initial best-effort acknowledgement.
- Added regression coverage for a mode callback whose `editMessageText` response is `message is not modified`.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 11 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept unchanged Telegram message edits as transport no-ops.
- Continued surfacing real domain and commit errors in the edited message.

### Subagent Contributions

- None for this Telegram callback transport fix.

### Blockers / Follow-ups

- Restart the API and retry the `By Category` callback.

## 2026-06-18 13:48 +03 - Codex / Developer

### Scope

- Improved automatic category resolution for Telegram AI finance drafts.
- Added synonym-based category hint matching for common finance categories such as food/cafe, fuel/auto, groceries,
  health, home, transport, entertainment, and salary.
- Added regression coverage for multi-payment text where `food` maps to `Питание` and `fuel` maps to `Авто`.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 11 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept category creation out of scope.
- Resolved categories only from existing workspace categories.

### Subagent Contributions

- None for this category matching fix.

### Blockers / Follow-ups

- Restart the API and retry the multi-line Telegram text message.

## 2026-06-18 13:18 +03 - Codex / Developer

### Scope

- Fixed OpenRouter/Azure structured-output schema compatibility for AI finance extraction.
- Replaced the top-level `oneOf` union schema with a flat envelope schema that Azure accepts.
- Updated extraction prompts to require every schema field and use `null`/`[]` for fields outside the selected `kind`.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 7 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept runtime validation by `kind` in `assertValidExtraction`.
- Avoided weakening extraction to non-strict JSON mode.

### Subagent Contributions

- None for this schema compatibility fix.

### Blockers / Follow-ups

- Retry the local Telegram message after restarting the API.

## 2026-06-18 14:20 +03 - Codex / Developer

### Scope

- Converted ready Telegram AI finance drafts from inline-button preview flow to conversational chat flow.
- Added OpenRouter conversation action parsing for draft edits, receipt mode changes, commit, cancel, clarification, and explicit new draft requests.
- Passed workspace catalog and current draft summary into conversation action prompts so the AI chooses exact existing account/category names.
- Added deterministic fast paths for text confirmation and cancellation phrases before calling AI.
- Removed ready-draft action keyboards from new preview replies while keeping callback handlers compatible for old messages.
- Updated preview copy to explain plain-text confirmation and edit examples.
- Added regression coverage for text commit, text cancel, account edits, date edits, and no ready-draft buttons.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/src/ai-finance/ai-finance-resolver.service.ts`
- `packages/api/src/ai-finance/ai-finance-preview.service.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 16 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Used deterministic phrase matching for obvious `commit`/`cancel` commands to avoid unnecessary LLM calls.
- Used OpenRouter only for ambiguous ready-draft chat messages that need intent/category/account/date interpretation.
- Validated conversation action account/category names by exact catalog-name match instead of fuzzy hints.
- Kept `/cancel`, `/workspace`, `/account`, workspace/account keyboards, and old callback handlers for fallback/backward compatibility.
- Treated ordinary text with an active draft as a draft command/edit; a new draft requires no active draft or an explicit `новая операция:` prefix.

### Subagent Contributions

- None for this conversational flow implementation.

### Blockers / Follow-ups

- Restart the API and retry local Telegram chat flows end to end.

## 2026-06-18 14:25 +03 - Codex / Developer

### Scope

- Added a local fallback parser for simple text payment lines when OpenRouter returns `unknown` or no usable text amounts.
- Covered Russian multi-line messages like `Блины ... за 15.23 рублей` so the bot still creates a draft preview instead of generic `preview` fallback text.
- Added regression coverage for the reported three-line message with food, car fuel, and laptop purchase entries.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 17 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept the fallback narrow: it only parses clear amount lines and still does not invent accounts.
- Used existing workspace category names when local keyword matching can map a line to an exact category.

### Subagent Contributions

- None for this hotfix.

### Blockers / Follow-ups

- Restart the API and retry the reported Telegram message.

## 2026-06-18 14:31 +03 - Codex / Developer

### Scope

- Added deterministic Telegram chat answers for catalog questions like `какие категории доступны` and `какие счета доступны`.
- Bypassed `Думаю...`, draft creation, and OpenRouter parsing for these catalog questions.
- Added regression coverage so category catalog questions return workspace categories and do not create an AI draft.

### Files Changed

- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 18 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Treated catalog questions as deterministic bot commands, not finance extraction intents.
- Kept active drafts untouched when the user asks for available categories or accounts.

### Subagent Contributions

- None for this hotfix.

### Blockers / Follow-ups

- Restart the API and retry `какие категории доступны`.

## 2026-06-18 14:37 +03 - Codex / Developer

### Scope

- Fixed Telegram photo/receipt AI failures so webhook handling replies in chat instead of returning an error that Telegram retries.
- Passed Telegram photo captions such as `по карте` into the OpenRouter receipt image prompt.
- Added regression coverage for receipt caption forwarding and graceful receipt image extraction errors.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/src/telegram-bot/telegram-bot.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 20 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept `Думаю...` for image/voice/text AI paths, but always deletes it before sending either a draft or a parse failure message.
- Returned a chat error for AI parsing/download failures so Telegram does not retry the same update indefinitely.

### Subagent Contributions

- None for this hotfix.

### Blockers / Follow-ups

- Restart the API and retry the screenshot with caption `по карте`.

## 2026-06-18 14:39 +03 - Codex / Developer

### Scope

- Fixed Telegram photo downloads whose blob type is `application/octet-stream`.
- Normalized generic Telegram photo MIME types to image MIME types before sending data URLs to vision providers.
- Added regression coverage for `application/octet-stream` photo downloads becoming `data:image/jpeg`.

### Files Changed

- `packages/api/src/telegram-bot/telegram-bot.client.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 21 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Kept provider/API errors visible in Telegram chat.
- Treated Telegram's generic `application/octet-stream` for photos as `image/jpeg` by default, with extension-based handling for PNG/WebP/GIF.

### Subagent Contributions

- None for this hotfix.

### Blockers / Follow-ups

- Restart the API and retry the screenshot with caption `по карте`.

## 2026-06-18 14:41 +03 - Codex / Developer

### Scope

- Improved receipt/screenshot vision prompts for bank or finance app transaction-history screenshots.
- Asked the model to extract transaction-history screenshots as `payments` and include visible date/time per payment.
- Fixed the pending-date loop when the user replies that dates are on the screenshot: the bot now explains that it could not read them and asks for a text date.
- Added regression coverage for the screenshot-date-reference answer.

### Files Changed

- `packages/api/src/ai-finance/ai-finance-parser.service.ts`
- `packages/api/src/ai-finance/ai-finance.service.ts`
- `packages/api/test/telegram-bot.e2e.test.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 22 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Did not pretend to re-read the original screenshot from a text reply because the image bytes are not retained in the draft.
- Kept the user-facing error explicit and actionable.

### Subagent Contributions

- None for this hotfix.

### Blockers / Follow-ups

- Restart the API and retry the screenshot; if date extraction still fails, reply with a concrete date such as `2026-06-18`.

## 2026-06-18 14:48 +03 - Codex / Fixer Subagent

### Scope

- Inspected the Telegram AI finance bot implementation for low-risk structure and maintainability improvements.
- Extracted duplicated resolved-draft persistence/rendering logic in the AI finance service.
- Kept behavior unchanged.

### Files Changed

- `packages/api/src/ai-finance/ai-finance.service.ts`
- `docs/plans/telegram-ai-finance-bot/work-log.md`

### Commands Run

```bash
pnpm --filter api test test/telegram-bot.e2e.test.ts
pnpm --filter api typecheck
pnpm --filter api check
```

### Results

- Passed: Telegram bot e2e suite, 1 file / 22 tests.
- Passed: API typecheck.
- Passed: API Biome check.

### Decisions

- Added a private `updateDraftFromResolved` helper instead of changing resolver or draft-service contracts.
- Left bot control flow and user-facing text unchanged to avoid behavioral drift.

### Subagent Contributions

- None; this fixer pass was already scoped as a subagent task.

### Blockers / Follow-ups

- None.
