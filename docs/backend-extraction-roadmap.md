# План выноса backend в NestJS

Этот документ описывает поэтапный перенос backend-части Finnn из Next.js Server Actions и Route Handlers в отдельный NestJS API на TypeScript и Fastify. Цель - получить самостоятельный backend-сервис с REST-контрактом, OpenAPI-спецификацией и Orval-клиентами для frontend.

## Принятые архитектурные решения

- Миграция выполняется поэтапно, без big bang-переноса.
- Репозиторий переводится к pnpm monorepo-структуре с `apps/web` и `apps/api`.
- Backend-владельцем аутентификации становится NestJS.
- Сессия строится на JWT access/refresh token, передаваемых через secure HttpOnly cookies.
- Frontend обращается к отдельному публичному API-домену напрямую, без same-origin proxy.
- API размещается на Railway.
- База данных на первом этапе остается MongoDB через Prisma.
- Публичный контракт API строится как REST resource API.
- OpenAPI генерируется из NestJS через `@nestjs/swagger`.
- Frontend-клиент генерируется через Orval.
- Спринты в этом документе являются последовательными этапами без календарных дат.

## Текущее состояние проекта

Сейчас backend-поверхность распределена по Next.js App Router, Server Actions, Route Handlers и shared helpers.

Основные backend-возможности:

- Auth: credentials login через NextAuth, регистрация, pending registration, email verification, обновление профиля, bcrypt password hashing.
- Workspaces: CRUD рабочих пространств, роли owner/admin/member, участники, приглашения, принятие приглашений, выход из workspace, создание стандартных категорий.
- Accounts: CRUD счетов, архивирование, восстановление, удаление архивных счетов, порядок отображения, owner visibility, dependency checks.
- Categories: CRUD категорий, сортировка по типу, подсчет связанных транзакций.
- Transactions: income/expense платежи, transfers, общий список платежей/переводов/debt transactions, фильтры и пагинация.
- Debts: создание, пополнение, закрытие, редактирование, удаление долгов и debt transactions, пересчет remaining amount и account balance.
- Analytics: агрегации, периоды, графики, расходы по категориям, debt exposure, пересчет в base currency.
- Currency: NBRB provider, fallback provider, сохранение daily exchange rates, cron-обновление.
- Ops: seed, MongoDB export/import, Prisma generate/db push, service worker cache policy.

Ключевые текущие файлы:

- `prisma/schema.prisma` - источник моделей, индексов, enum и связей.
- `src/modules/*/*.service.ts` - текущая Server Action/API-like граница.
- `src/modules/transactions/transaction.application.ts` - транзакционная логика платежей и переводов.
- `src/modules/debts/debt.application.ts` - транзакционная логика долгов.
- `src/shared/lib/server-access.ts` - workspace authorization.
- `src/shared/lib/auth.ts` и `src/shared/lib/auth-session.ts` - NextAuth и server session.
- `src/shared/lib/action-result.ts` - текущий envelope `{ data } | { success } | { error }`.
- `src/shared/lib/query-keys.ts` и `src/shared/lib/optimistic-workspace-updates.ts` - TanStack Query keys и optimistic cache behavior.
- `src/app/api/cron/update-exchange-rates/route.ts` - cron endpoint.
- `src/app/api/exchange-rates/route.ts` - exchange-rate proxy.

## Основные риски миграции

- Frontend напрямую импортирует Server Actions из `*.service.ts`; REST/Orval вводит новую контрактную границу.
- SSR prefetch в App Router сейчас вызывает те же service-функции напрямую, поэтому web-приложению понадобится API-aware fetcher с cookie forwarding.
- NextAuth глубоко связан с `SessionProvider`, `useSession`, `getServerSession` и Prisma Adapter; перенос auth должен быть отдельным этапом.
- В client-коде встречаются типы Prisma; после выноса backend frontend должен работать через DTO, а не через database model shape.
- Текущий UI ожидает `{ data }`, `{ success: true }` или `{ error }`; Orval-клиенты обычно работают через response body и thrown HTTP errors.
- Query key factories должны остаться стабильными, иначе сломаются optimistic updates и invalidation.
- HTTP/JSON меняет `Date`-значения на строки; DTO должны явно нормализовать даты.
- Денормализованный `Account.balance` обновляется вместе с платежами, переводами и долгами; эти операции должны оставаться атомарными.
- MongoDB через Prisma требует replica set для `$transaction`.
- Currency service использует Next `fetch` revalidation и in-memory state; под NestJS и Railway поведение кеша нужно описать заново.
- Direct API domain требует CORS credentials, cookie domain/SameSite/Secure, CSRF-защиту и production-проверку браузерного поведения.

## Целевая backend-архитектура

`apps/api` должен содержать NestJS приложение на Fastify с префиксом `/v1`.

Рекомендуемые модули:

- `AuthModule` - login, registration, email verification, refresh, logout, `/auth/me`, cookie issuing.
- `UsersModule` - user profile, avatar/name/email read model.
- `WorkspacesModule` - workspace CRUD, members, roles, invites, accept/leave flows.
- `AccountsModule` - accounts lifecycle, archive/unarchive/delete archived, order, dependency checks.
- `CategoriesModule` - category CRUD, ordering, usage counts.
- `TransactionsModule` - payment transactions, transfers, combined feed.
- `DebtsModule` - debts lifecycle and debt transactions.
- `BalancesModule` или shared domain package - money arithmetic, balance deltas, non-negative balance assertions.
- `AnalyticsModule` - reporting read models and aggregations.
- `CurrencyModule` - external providers, persisted exchange rates, conversion.
- `NotificationsModule` - SMTP transport and email templates.
- `JobsModule` - scheduled exchange-rate updates and protected job endpoints.
- `DatabaseModule` - Prisma Client lifecycle and transaction helpers.

Общие backend-компоненты:

- Global validation pipe.
- Global exception filter with standard JSON error shape.
- Request id middleware/interceptor.
- Auth guards and workspace access guards.
- OpenAPI decorators and DTO classes.
- Environment validation at boot.
- Structured logging.
- Health endpoint for Railway.

## Public API и контракты

- API base URL для frontend: `NEXT_PUBLIC_API_URL`.
- API prefix: `/v1`.
- Health endpoint: `GET /health`.
- OpenAPI JSON: `GET /openapi.json` или `GET /docs-json`.
- Swagger UI: включать в non-production или защищать в production.
- Auth cookies: HttpOnly, Secure, SameSite=None для cross-origin API domain.
- Standard error response:

```json
{
  "code": "WORKSPACE_ACCESS_DENIED",
  "message": "Доступ запрещён",
  "details": {},
  "requestId": "req_..."
}
```

Переходный frontend adapter может временно маппить backend errors в текущий `{ error }` формат, чтобы не переписывать все UI-компоненты за один этап.

Orval output должен находиться внутри web-приложения и использовать общий fetcher с:

- `credentials: "include"`;
- `NEXT_PUBLIC_API_URL`;
- обработкой стандартного error envelope;
- поддержкой SSR-вызовов из server components;
- сохранением текущих TanStack Query key factories.

## Спринт 0. Roadmap и инвентаризация

Цель: зафиксировать текущую backend-поверхность, риски и план миграции до изменения архитектуры.

Задачи:

- Создать этот документ.
- Зафиксировать текущие Server Action entrypoints по модулям.
- Описать Prisma models, индексы и важные доменные инварианты.
- Зафиксировать auth/session зависимости от NextAuth.
- Отметить client imports из `*.service.ts` и `@prisma/client`.
- Описать зависимость optimistic updates от текущих query key shapes.
- Зафиксировать env vars для web, api, database, SMTP, cron и Railway.
- Описать rollback-подход: пока все домены не перенесены, старые server actions остаются рабочими.

Acceptance criteria:

- Документ существует в `docs/backend-extraction-roadmap.md`.
- В документе есть архитектурные решения, спринты, риски, тест-план и assumptions.

## Спринт 1. Monorepo и API foundation

Цель: подготовить инфраструктуру для отдельного backend-сервиса без переноса доменной логики.

Задачи:

- Добавить pnpm workspace layout.
- Переместить текущий Next.js app в `apps/web` или подготовить промежуточную структуру с минимальным churn.
- Создать `apps/api` как NestJS + Fastify app.
- Настроить TypeScript, Biome, Vitest/Jest или выбранный test runner для API.
- Подключить Prisma Client к API через `DatabaseModule`.
- Сохранить `prisma/schema.prisma` как общий источник схемы на первом этапе.
- Добавить env validation для `DATABASE_URL`, JWT secrets, cookie settings, CORS origins, SMTP, `CRON_SECRET`.
- Добавить `GET /health`.
- Настроить global validation и exception filter.
- Настроить OpenAPI generation.
- Добавить Railway-ready build/start scripts.
- Обновить docs setup/operations после изменения структуры.

Acceptance criteria:

- `apps/api` стартует локально и отвечает на `GET /health`.
- OpenAPI JSON доступен локально.
- Prisma Client генерируется и доступен API-приложению.
- Существующий web app продолжает запускаться.

## Спринт 2. Auth и security boundary

Цель: перенести владение auth в NestJS и подготовить безопасный cross-origin session flow.

Задачи:

- Реализовать `POST /v1/auth/register`.
- Реализовать `POST /v1/auth/login`.
- Реализовать `POST /v1/auth/refresh`.
- Реализовать `POST /v1/auth/logout`.
- Реализовать `GET /v1/auth/me`.
- Реализовать `POST /v1/auth/verify-email` или `GET /v1/auth/verify-email/:token`.
- Сохранить bcrypt password verification.
- Перенести pending registration behavior.
- Настроить access/refresh JWT secrets и TTL.
- Выдавать токены через secure HttpOnly cookies.
- Настроить CORS credentials для frontend origin allowlist.
- Добавить CSRF strategy для mutating requests.
- Реализовать auth guard и `CurrentUser`.
- Реализовать workspace access guard/service с owner/admin/member ролями.
- Подготовить frontend auth adapter вместо NextAuth `useSession`/server session reads.
- Определить стратегию удаления NextAuth после завершения перехода.

Acceptance criteria:

- Пользователь может зарегистрироваться, подтвердить email, войти, обновить токен, выйти.
- `GET /v1/auth/me` возвращает текущего пользователя по cookie.
- Cross-origin cookies работают в локальной и production-like конфигурации.
- Workspace access guard покрыт unit tests.

## Спринт 3. Read API migration

Цель: перевести чтение данных на REST API и Orval без изменения пользовательских мутаций.

Задачи:

- Добавить read endpoints для workspaces, workspace summary, members.
- Добавить read endpoints для accounts и archived accounts.
- Добавить read endpoints для categories.
- Добавить read endpoints для combined transactions с текущими фильтрами и пагинацией.
- Добавить read endpoints для debts и debt edit data.
- Добавить read endpoints для analytics overview.
- Добавить read endpoints для today/yesterday exchange rates и rate conversion.
- Описать DTO без Prisma model leakage.
- Нормализовать dates как ISO strings на wire-level.
- Сгенерировать Orval client.
- Добавить frontend API fetcher с `credentials: "include"`.
- Добавить adapter-функции, которые сохраняют текущие query key factories.
- Перевести SSR prefetch на API-aware query functions.
- Оставить текущие server actions как fallback до завершения этапа.

Acceptance criteria:

- Dashboard, analytics и debts pages получают read data через API adapters.
- Query keys не меняют форму.
- Optimistic update tests продолжают проходить.
- DTO не импортируют `@prisma/client` в client code.

## Спринт 4. Workspace, account и category mutations

Цель: перенести CRUD и low-risk mutations перед финансовыми транзакциями.

Задачи:

- Перенести create/update/delete workspace.
- Перенести get/update workspace settings.
- Перенести member list, invite creation, accept invite, leave workspace.
- Перенести create/update/archive/unarchive/delete archived account.
- Перенести account ordering.
- Перенести create/update/delete category.
- Перенести category ordering и transaction count.
- Сохранить role checks для admin/owner operations.
- Заменить Next `revalidatePath` на frontend invalidation через TanStack Query.
- Сохранить временные frontend adapters для `{ data } | { success } | { error }`.
- Добавить API tests для authorization и validation.

Acceptance criteria:

- Workspace/account/category UI работает через API.
- Existing optimistic invalidation behavior сохранен.
- Hard delete account по-прежнему блокируется dependency checks.
- Старые server actions для этих доменов больше не используются frontend-кодом.

## Спринт 5. Ledger и debt mutations

Цель: перенести наиболее рискованную финансовую доменную логику с сохранением атомарности.

Задачи:

- Перенести `transaction.application.ts` в backend domain services.
- Перенести `debt.application.ts` в backend domain services.
- Перенести money helpers и balance-domain helpers без перехода на JS number.
- Реализовать payment transaction create/update/delete endpoints.
- Реализовать transfer create/update/delete endpoints.
- Реализовать debt create/add/close/update/delete endpoints.
- Реализовать debt transaction update/delete endpoints.
- Сохранить проверки:
  - account принадлежит workspace;
  - transaction date не раньше account creation date;
  - expense/source amount не превышает balance;
  - transfer accounts разные;
  - debt remaining amount и status консистентны;
  - account balances не становятся отрицательными.
- Сохранить Prisma `$transaction` для coordinated writes.
- Добавить regression tests вокруг balance changes.
- Проверить MongoDB replica set requirement в local и Railway окружениях.

Acceptance criteria:

- Создание, редактирование и удаление платежей/переводов/долгов работает через API.
- Account balances совпадают с текущим поведением.
- Финансовые тесты покрывают успешные и отказные сценарии.
- UI не импортирует старые transaction/debt server actions.

## Спринт 6. Analytics, currency, email и jobs

Цель: завершить перенос backend-only интеграций и фоновых процессов.

Задачи:

- Перенести analytics aggregation в `AnalyticsModule`.
- Убрать зависимость analytics от UI/component utilities.
- Перенести NBRB provider и fallback exchange-rate provider в `CurrencyModule`.
- Перенести persisted exchange-rate cache/upsert logic.
- Пересмотреть in-memory currency cache/circuit behavior для Railway и multi-instance сценария.
- Перенести SMTP transport и email templates в `NotificationsModule`.
- Перенести verification email и invite email отправку в backend use cases.
- Реализовать protected job endpoint или Railway scheduled job для daily exchange-rate update.
- Убрать зависимость от Vercel cron для backend jobs.
- Добавить operational logging для jobs и external providers.

Acceptance criteria:

- Daily exchange-rate update выполняется через API/Railway job.
- Email verification и workspace invites отправляются backend-сервисом.
- Analytics endpoints не зависят от frontend files.
- Currency behavior покрыт unit/integration tests.

## Спринт 7. Frontend contract cleanup

Цель: удалить переходные зависимости и оставить Next.js приложением frontend-only.

Задачи:

- Удалить неиспользуемые imports из `*.service.ts` в client components.
- Удалить client imports из `@prisma/client`, заменив их DTO/generated types.
- Удалить или архивировать замененные server actions.
- Удалить NextAuth routes/providers после полного перехода auth.
- Заменить `useSession` на новый auth client/hook.
- Убедиться, что SSR prefetch использует API client и корректно передает cookies.
- Нормализовать все date parsing/serialization в frontend adapters.
- Проверить service worker: API domain не кешируется, financial data не кешируется.
- Обновить docs architecture/development/operations/domain-model.

Acceptance criteria:

- Next.js app не содержит backend mutations через Server Actions.
- Client code не зависит от Prisma model types.
- `pnpm typecheck`, `pnpm check`, `pnpm test` проходят для web.
- Документация отражает новую архитектуру.

## Спринт 8. Hardening и cutover

Цель: подготовить production-переход и снизить риск регрессий.

Задачи:

- Добавить API e2e tests:
  - login/refresh/logout;
  - workspace authorization;
  - CRUD flows;
  - финансовые mutations;
  - cron/job endpoint;
  - OpenAPI availability.
- Добавить contract check: generate OpenAPI, run Orval, typecheck generated client.
- Добавить CI check на stale generated client.
- Подготовить Railway deployment configuration.
- Описать Railway env vars и секреты.
- Добавить smoke checklist для production:
  - auth cookies;
  - CORS credentials;
  - CSRF;
  - dashboard read;
  - transaction mutation;
  - debt mutation;
  - exchange-rate job;
  - email delivery.
- Описать rollback: вернуть frontend на старые adapters/server actions до удаления legacy-кода.
- Удалить obsolete Next API routes, если они больше не нужны frontend.
- Обновить release checklist.

Acceptance criteria:

- API задеплоен на Railway и проходит smoke checks.
- Web frontend работает с production API domain.
- Contract generation воспроизводим в CI.
- Rollback steps описаны и проверены на уровне конфигурации.

## Тест-план

Backend unit tests:

- auth password verification, registration, email verification;
- workspace access and role ranking;
- validation DTOs;
- money arithmetic and balance-domain rules;
- payment transaction application logic;
- transfer application logic;
- debt lifecycle and debt transaction logic;
- currency conversion and provider fallback.

Backend e2e tests:

- login, refresh, logout, `/auth/me`;
- workspace CRUD and authorization failures;
- account/category CRUD;
- transaction and transfer mutations;
- debt create/add/close/update/delete;
- combined transaction feed filters;
- analytics overview;
- exchange-rate job endpoint;
- OpenAPI JSON availability.

Frontend tests:

- generated client adapters;
- auth hook/session replacement;
- TanStack Query key compatibility;
- optimistic updates;
- service worker cache policy;
- SSR prefetch with API client.

Full verification before cutover:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

After monorepo split, add API-specific checks:

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter web typecheck
pnpm --filter web build
```

## Environment variables

Expected API variables:

```env
DATABASE_URL="mongodb-connection-string"
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
COOKIE_DOMAIN=".example.com"
COOKIE_SECURE="true"
COOKIE_SAME_SITE="none"
CORS_ORIGINS="https://app.example.com"
CSRF_SECRET="..."
CRON_SECRET="..."
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM="Finnn <no-reply@example.com>"
APP_WEB_URL="https://app.example.com"
```

Expected web variables:

```env
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_APP_URL="https://app.example.com"
```

`NEXTAUTH_SECRET` and `NEXTAUTH_URL` remain only during the transition and should be removed after NestJS auth fully replaces NextAuth.

## Rollback strategy

- До завершения каждого домена сохранять старые server actions как fallback.
- Переводить frontend через adapter layer, чтобы можно было переключить конкретный домен обратно.
- Не удалять NextAuth до полной проверки NestJS auth в production-like окружении.
- Не менять Prisma schema одновременно с переносом финансовой логики, кроме строго необходимых индексов.
- Не менять формат persisted money values.
- Для production cutover иметь env-переключатель или release branch, возвращающий frontend к legacy service functions.

## Документация, которую нужно обновить в ходе работ

- `docs/architecture.md` - новая high-level схема `apps/web` + `apps/api`.
- `docs/development.md` - monorepo setup, API dev server, Orval generation.
- `docs/operations.md` - Railway deploy, env vars, jobs, smoke checks.
- `docs/domain-model.md` - если будут уточнены DTO, auth ownership или balance invariants.
- `docs/ai-contributor-guide.md` - новые agent-facing правила после смены backend boundary.
- `README.md` - краткая ссылка на подробные docs без дублирования больших разделов.

## Reference links

- [NestJS Fastify performance adapter](https://docs.nestjs.com/techniques/performance)
- [NestJS OpenAPI/Swagger](https://docs.nestjs.com/recipes/swagger)
- [Orval documentation](https://orval.dev/docs)
- [Railway NestJS guide](https://docs.railway.com/guides/nest)

## Assumptions

- Prisma + MongoDB остаются основой данных на первом этапе.
- Любая миграция с MongoDB/Prisma на другую БД является отдельным roadmap item после backend extraction.
- Money values остаются строками во всех persisted financial fields.
- MongoDB окружение поддерживает replica set transactions.
- API будет доступен с отдельного домена на Railway.
- Cross-origin cookies будут использовать `SameSite=None` и `Secure`.
- Frontend adapters временно сохранят текущую форму action results там, где это снижает объем одновременной миграции.
- Существующие несвязанные изменения в рабочем дереве не откатываются.
