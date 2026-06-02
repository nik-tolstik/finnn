# Finnn

Finnn - личное и совместное приложение для учета финансов. В проекте есть рабочие столы, счета, категории, платежные транзакции, переводы, долги, аналитика, импорт/экспорт MongoDB и PWA-обвязка.

## Документация

Подробная документация находится в [`docs/`](./docs/README.md): локальная разработка, архитектура, доменная модель, операции и AI-facing guide для Codex.

## Стек

- `pnpm` workspace: `packages/web` и `packages/api`
- Next.js App Router, React, TypeScript
- NestJS API, Prisma + MongoDB
- API-owned HTTP-only cookie auth
- OpenAPI + Orval-generated web client
- TanStack Query для клиентского кеша и SSR hydration
- Tailwind CSS, собственные UI-компоненты, lucide-react
- Recharts для аналитики, lazy-loaded client chunks
- Vitest для unit/static tests
- Biome для форматирования и lint
- Backend cron endpoint для обновления курсов валют

## Локальный запуск

```bash
pnpm install
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env
pnpm db:generate
pnpm db:push
pnpm dev
```

API поднимается на [http://localhost:4000](http://localhost:4000), web-приложение - на [http://localhost:3000](http://localhost:3000).

Для локальной MongoDB можно использовать `docker-compose.yml`:

```bash
docker compose up -d
```

## Env Variables

Минимальный набор для `packages/api/.env`:

```env
DATABASE_URL="mongodb://localhost:27017/finnn"
API_AUTH_SECRET="paste-generated-secret-here"
API_COOKIE_SECRET="paste-generated-secret-here"
API_ALLOWED_ORIGINS="http://localhost:3000"
CRON_SECRET="paste-cron-secret-here"
```

Email-приглашения и подтверждение регистрации используют SMTP:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="paste-smtp-password-here"
SMTP_FROM="Finnn <your-email@example.com>"
```

Минимальный набор для `packages/web/.env`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

API-секреты можно сгенерировать так:

```bash
openssl rand -base64 32
```

## Prisma и MongoDB

Основные команды:

```bash
pnpm db:generate  # сгенерировать Prisma Client
pnpm db:push      # применить schema.prisma и индексы в MongoDB
```

После изменения `packages/api/prisma/schema.prisma` запускайте `pnpm db:generate`. Для применения новых индексов и моделей к MongoDB запускайте `pnpm db:push`.

## Seed, Import, Export

```bash
pnpm db:seed
pnpm db:export
pnpm db:import
```

Скрипты лежат в `packages/api/scripts/`:

- `db-seed.ts` - наполнение базы тестовыми данными.
- `mongo-export.ts` - экспорт данных MongoDB.
- `mongo-import.ts` - импорт данных MongoDB.

Для безопасной проверки импорта используйте отдельную базу:

```bash
pnpm db:export ./backups/manual
pnpm db:import ./backups/manual --drop --db=finnn_restore
```

## Проверки

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

`pnpm check` проверяет API contract drift и запускает Biome в обоих пакетах. `pnpm build` сначала собирает NestJS API, затем Next.js web.

## Backend Cron

Backend endpoint `/cron/update-exchange-rates` защищен `CRON_SECRET`. Планировщик должен передавать его в заголовке `Authorization: Bearer <secret>`.

Для production также нужны:

- `DATABASE_URL` на MongoDB.
- `API_AUTH_SECRET` и `API_COOKIE_SECRET`.
- `API_ALLOWED_ORIGINS` с production URL web-приложения.
- `NEXT_PUBLIC_API_URL` с production URL API.
- SMTP-переменные, если включены приглашения и подтверждение email.

## PWA и Service Worker

Service Worker находится в `packages/web/public/sw.js`. Политика кеширования намеренно ограничена static assets:

- `/_next/static/**`
- favicon/icons/manifest
- static images/fonts/styles/scripts

SW не кеширует `/api/**`, document requests, dashboard/app routes, `/_next/data/**`, API/data responses и любые non-GET requests. Финансовые данные должны приходить с сервера или из контролируемого клиентского кеша, а не из offline-кеша браузера.

## Архитектура

- `packages/web/src/app` - App Router страницы, layouts и providers.
- `packages/web/src/modules` - UI-модули для счетов, категорий, транзакций, долгов, аналитики, workspace и auth.
- `packages/web/src/shared` - frontend helpers, API client, query keys, UI primitives и низкоуровневые утилиты.
- `packages/api/src` - NestJS backend modules, auth/session ownership, workspace guards, finance endpoints, cron, email и Prisma access.
- `packages/api/prisma/schema.prisma` - source of truth для MongoDB collections, relations, indexes и enums.
- `packages/api/scripts` - seed, MongoDB import/export и OpenAPI generation.

## Денежная логика

Низкоуровневая frontend-арифметика находится в `packages/web/src/shared/utils/money.ts`. Backend сохраняет money-as-string инвариант в `packages/api/src/common/money.ts` и доменных сервисах NestJS.
