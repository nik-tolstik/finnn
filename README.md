# Finnn

Finnn - личное и совместное приложение для учета финансов. В проекте есть рабочие столы, счета, категории, платежные транзакции, переводы, долги, аналитика, импорт/экспорт MongoDB и PWA-обвязка.

## Стек

- Next.js App Router, React, TypeScript
- Prisma + MongoDB
- NextAuth + Prisma Adapter
- TanStack Query для клиентского кеша и SSR hydration
- Tailwind CSS, собственные UI-компоненты, lucide-react
- Recharts для аналитики, lazy-loaded client chunks
- Vitest для unit/static tests
- Biome для форматирования и lint
- Vercel cron для обновления курсов валют

## Локальный запуск

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
pnpm dev
```

Приложение поднимается на [http://localhost:3000](http://localhost:3000).

Для локальной MongoDB можно использовать `docker-compose.yml`:

```bash
docker compose up -d
```

## Env Variables

Минимальный набор:

```env
DATABASE_URL="mongodb://localhost:27017/finnn"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-generated-secret-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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

`NEXTAUTH_SECRET` можно сгенерировать так:

```bash
openssl rand -base64 32
```

## Prisma и MongoDB

Основные команды:

```bash
pnpm db:generate  # сгенерировать Prisma Client
pnpm db:push      # применить schema.prisma и индексы в MongoDB
pnpm db:studio    # открыть Prisma Studio
```

После изменения `prisma/schema.prisma` запускайте `pnpm db:generate`. Для применения новых индексов и моделей к MongoDB запускайте `pnpm db:push`.

## Seed, Import, Export

```bash
pnpm db:seed
pnpm db:export
pnpm db:import
```

Скрипты лежат в `scripts/`:

- `db-seed.ts` - наполнение базы тестовыми данными.
- `mongo-export.ts` - экспорт данных MongoDB.
- `mongo-import.ts` - импорт данных MongoDB.

## Проверки

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build
```

`pnpm check` запускает Biome с ошибкой на warning. `pnpm build` сначала выполняет `prisma generate`, затем `next build`.

## Vercel и Cron

Cron настроен в `vercel.json` и дергает `/api/cron/update-exchange-rates`. Для защиты endpoint нужен `CRON_SECRET`; тот же секрет должен быть в переменных окружения Vercel.

Для production также нужны:

- `DATABASE_URL` на MongoDB.
- `NEXTAUTH_URL` с production URL.
- `NEXTAUTH_SECRET`.
- `NEXT_PUBLIC_APP_URL`.
- SMTP-переменные, если включены приглашения и подтверждение email.

## PWA и Service Worker

Service Worker находится в `public/sw.js`. Политика кеширования намеренно ограничена static assets:

- `/_next/static/**`
- favicon/icons/manifest
- static images/fonts/styles/scripts

SW не кеширует `/api/**`, document requests, dashboard/app routes, `/_next/data/**`, server action/data responses и любые non-GET requests. Финансовые данные должны приходить с сервера или из контролируемого клиентского кеша, а не из offline-кеша браузера.

## Архитектура

- `src/app` - App Router страницы, layouts, API routes и providers.
- `src/modules/accounts` - счета, сортировка, архив, UI-карточки.
- `src/modules/categories` - категории доходов и расходов.
- `src/modules/transactions` - платежи, переводы, общий transaction feed, фильтры.
- `src/modules/debts` - долги, закрытия, добавления, редактирование debt transactions.
- `src/modules/analytics` - серверная агрегация аналитики и lazy-loaded графики.
- `src/modules/workspace` - рабочие столы, участники, приглашения.
- `src/modules/auth` - регистрация, подтверждение email, профиль.
- `src/modules/currency` - курсы валют, cron persistence, fallback providers.
- `src/shared/lib` - Prisma, auth/session helpers, query keys, invalidation, result helpers, balance domain.
- `src/shared/ui` - базовые UI-компоненты.
- `src/shared/utils` - низкоуровневые утилиты, включая арифметику денег.

## Денежная логика

Низкоуровневая арифметика находится в `src/shared/utils/money.ts`. Доменные правила изменения балансов находятся отдельно в `src/shared/lib/balance-domain.ts`, чтобы одни и те же правила использовались server actions и client preview в формах.
