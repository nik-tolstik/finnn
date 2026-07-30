# Mobile Dashboard Performance Work Log

## 2026-07-30 13:55 +03 - Primary Agent

### Scope

- Created the dedicated worktree and implementation branch.
- Copied web and API environment files as opaque files.
- Installed dependencies with the locked pnpm workspace.
- Captured the baseline production build output.
- Reviewed the mobile dashboard critical path with parallel source and bundle audits.

### Files Changed

- `docs/plans/mobile-dashboard-performance/prompt.md`
- `docs/plans/mobile-dashboard-performance/README.md`
- `docs/plans/mobile-dashboard-performance/work-log.md`

### Commands Run

```bash
git worktree add -b agent/mobile-dashboard-performance <worktree-path> HEAD
pnpm install --frozen-lockfile
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
```

### Results

- Worktree created from local `develop` at `0aa0486`.
- Dependency installation passed.
- Baseline web build passed and matched the current production chunk sizes.

### Decisions

- Keep the first implementation pass client-only.
- Use the documented public production API URL only for production build validation.
- Target a draft pull request into `develop`.

### Subagent Contributions

- Audited the protected route and workspace loading path.
- Audited the production bundle/import graph.
- Audited mobile rendering, hidden responsive work, and likely LCP candidates.

### Blockers / Follow-ups

- Authenticated local mobile measurement still needs a repeatable harness.

## 2026-07-30 14:06 +03 - Responsive Shell Agent

### Scope

- Split desktop and mobile dashboard chrome at the 768px breakpoint with viewport-change subscriptions.
- Removed the mobile navigation's Motion runtime, layout reads, and resize observer in favor of CSS active states.
- Deferred mobile menu content and settings/category/create dialogs until the corresponding interaction.
- Added narrow source-contract coverage for the responsive and lazy-loading boundaries.

### Files Changed

- `packages/web/src/routes/dashboard/components/DashboardShell.tsx`
- `packages/web/src/routes/dashboard/components/Header.tsx`
- `packages/web/src/routes/dashboard/components/MobileDashboardNavigation.tsx`
- `packages/web/src/routes/dashboard/components/MobileUserMenu.tsx`
- `packages/web/src/routes/dashboard/components/MobileUserMenuContent.tsx`
- `packages/web/src/routes/dashboard/components/Sidebar.tsx`
- `packages/web/src/routes/dashboard/components/useDesktopViewport.ts`
- `packages/web/src/routes/dashboard/components/dashboard-shell-performance.test.ts`

### Commands Run

```bash
pnpm --filter web exec vitest run src/routes/dashboard/components/dashboard-shell-performance.test.ts
pnpm --filter web typecheck
pnpm --filter web exec biome check <responsive-shell-files> --error-on-warnings
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
```

### Results

- Targeted tests passed: 3 tests.
- Web typecheck and targeted Biome checks passed.
- Production web build passed and emitted independent `Sidebar`, `Header`, `MobileDashboardNavigation`, and `MobileUserMenuContent` chunks.
- The mobile header preload graph excludes `Sidebar` and `WorkspaceDropdown`; menu-only workspace/settings code starts after the menu opens.

### Decisions

- Use `useSyncExternalStore` with the same 768px breakpoint as Tailwind `md` so viewport resizing swaps the mounted chrome branch.
- Keep settings dialogs mounted after their first interaction so closing animations and subsequent openings remain intact without adding them to the cold path.
- Skip browser screenshot QA because the repository requires explicit user authorization for screenshot/browser QA; the primary agent owns synthetic mobile measurement.

### Blockers / Follow-ups

- The first accidental full Vitest run exposed two transient failures in files being changed by other parallel agents (`protected-route-preload.test.ts` and `logo-assets.test.ts`); the responsive-shell target itself passed.

## 2026-07-30 14:06 +03 - Dashboard Lazy Content Agent

### Scope

- Moved account create/action/edit/archive/transaction dialogs and account DnD behind interaction-only dynamic imports.
- Moved transaction action dialogs and the transaction filter drawer behind interaction-only dynamic imports.
- Delayed member and category queries until the transaction filter opens.
- Reduced mobile account and transaction skeleton paint work.
- Added per-transaction `content-visibility` with an intrinsic-size fallback for offscreen list items.

### Files Changed

- `packages/web/src/routes/dashboard/dashboard/components/DashboardContent.tsx`
- `packages/web/src/modules/accounts/components/accounts-cards/AccountsCards.tsx`
- `packages/web/src/modules/accounts/components/accounts-cards-skeleton/AccountsCardsSkeleton.test.tsx`
- `packages/web/src/modules/accounts/components/accounts-cards-skeleton/AccountsCardsSkeleton.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/CombinedTransactionsList.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/components/CombinedTransactionsView.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/hooks/useCombinedTransactionsController.ts`
- `packages/web/src/modules/transactions/components/transactions-filters/components/TransactionsFilterDrawer.tsx`

### Commands Run

```bash
pnpm --filter web exec biome check <changed-files>
pnpm --filter web typecheck
pnpm --filter web test -- src/modules/transactions/components/transactions-filters/utils/search-params.test.ts src/modules/transactions/components/combined-transactions-list/utils/scheduledPaymentFromTransaction.test.ts
pnpm --filter web exec vitest run src/modules/accounts/components/accounts-cards-skeleton/AccountsCardsSkeleton.test.tsx
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
```

### Results

- Targeted Biome check passed.
- Web typecheck passed.
- The web test suite passed: 45 files and 193 tests.
- The focused responsive account skeleton test passed.
- Production build passed and emitted independent chunks for DnD, account dialogs, the filter drawer, and combined-transaction dialogs.
- The production CSS contains the expected `content-visibility: auto` and `contain-intrinsic-size: auto 96px` declarations.

### Decisions

- Keep a filter drawer mounted after its first open so its close transition remains intact, while avoiding any initial import or filter-only requests.
- Keep existing category filter selections unchanged while deferred category options are loading, and expose loading placeholders in the affected selectors.
- Use independent Suspense boundaries for account dialogs so loading a follow-up form does not interrupt the outgoing dialog transition.
- Render three account skeleton cards on mobile and retain six from the medium breakpoint; remove the non-representative add-account skeleton card.

## 2026-07-30 14:08 +03 - Routing, Telegram, And Cache Agent

### Scope

- Removed the parser-blocking Telegram SDK request from regular web visits.
- Added an early asynchronous SDK loader for Telegram launch parameters and made Mini App bootstrap await its result.
- Started the protected layout and matched child route imports together while keeping protected data in TanStack Query.
- Limited service-worker cache-first behavior to content-hashed Vite assets and added immutable Vercel headers for `/assets/*`.

### Files Changed

- `packages/web/index.html`
- `packages/web/src/app/App.tsx`
- `packages/web/src/app/protected-route-preload.ts`
- `packages/web/src/app/protected-route-preload.test.ts`
- `packages/web/src/app/spa-shell.test.ts`
- `packages/web/src/modules/telegram-mini/TelegramMiniAppBootstrap.tsx`
- `packages/web/src/modules/telegram-mini/telegram-mini.types.ts`
- `packages/web/src/modules/telegram-mini/telegram-mini-sdk-loader.test.ts`
- `packages/web/public/sw.js`
- `packages/web/src/shared/lib/service-worker-cache-policy.test.ts`
- `packages/web/vercel.json`
- `docs/domain-model.md`
- `docs/operations.md`

### Commands Run

```bash
pnpm --filter web test src/modules/telegram-mini/telegram-mini-sdk-loader.test.ts src/app/protected-route-preload.test.ts src/app/spa-shell.test.ts src/shared/lib/service-worker-cache-policy.test.ts
pnpm --filter web typecheck
pnpm --filter web exec biome check <routing-telegram-cache-files> --write
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
```

### Results

- Targeted tests passed: 4 files and 14 tests.
- Web typecheck and targeted Biome checks passed.
- Production web build passed; every emitted file under `/assets/` matched the content-hash allowlist.
- The built HTML contains no unconditional external Telegram script request.

### Decisions

- Detect Telegram launch context from `tgWebAppData` or `tgWebAppVersion` in the query/hash before injecting the SDK.
- Keep the provider pending from its first render during asynchronous SDK loading to preserve Mini App authentication readiness.
- Reuse memoized dynamic-import promises so preloading does not download or evaluate route modules twice.
- Cache only hashed `/assets/` files in the service worker; leave all documents, API/data responses, and unhashed public files network-owned.

### Blockers / Follow-ups

- Verify the immutable response header on the Vercel preview after deployment.
- The primary agent owns authenticated local mobile Lighthouse measurement and PR creation.

## 2026-07-30 14:39 +03 - Primary Agent

### Scope

- Integrated and reviewed the three parallel implementation areas.
- Avoided loading the create-workspace flow on the normal dashboard path.
- Prevented the service-worker `controllerchange` handler from reloading a first-time visit.
- Updated the legacy logo/PWA assertion for the hashed-asset-only cache contract.
- Built an authenticated local mobile performance fixture with three visible accounts.
- Compared the baseline and optimized production builds with fresh Chrome profiles and verified the primary mobile interaction.

### Files Changed

- `packages/web/src/routes/dashboard/dashboard/DashboardRoute.tsx`
- `packages/web/src/routes/dashboard/dashboard/components/DashboardRouteSkeleton.tsx`
- `packages/web/src/routes/dashboard/components/DashboardAuthGate.tsx`
- `packages/web/src/modules/workspace/useWorkspaceRoute.ts`
- `packages/web/src/providers/AppProviders.tsx`
- `packages/web/src/modules/accounts/hooks/useAccountDisplayPreferences.ts`
- `packages/web/src/shared/components/ServiceWorkerRegistration.tsx`
- `packages/web/src/shared/lib/logo-assets.test.ts`
- `packages/web/src/shared/lib/service-worker-cache-policy.test.ts`

### Commands Run

```bash
pnpm db:migrate:deploy
VITE_API_URL=http://localhost:4000 pnpm --filter web build
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web check
pnpm typecheck
pnpm check
pnpm test
pnpm dlx lighthouse@13.4.1 <local-authenticated-dashboard> --only-categories=performance
```

### Results

- Repository checks passed:
  - API: 18 test files passed, 1 skipped; 267 tests passed, 12 skipped.
  - Web: 49 test files and 208 tests passed.
  - PostgreSQL backup: 5 test files and 11 tests passed.
  - Root typecheck, generated-client drift check, and Biome checks passed.
- Local mobile Lighthouse setup:
  - Windows Chrome 151 and Lighthouse 13.4.1 mobile defaults.
  - Three fresh-profile runs per build against the same local API, PostgreSQL database, authenticated user, workspace, and three visible accounts.
  - Median Lighthouse score improved from 58 to 63.
  - Median modeled LCP improved from 18.43 s to 7.66 s (-58%); FCP from 6.40 s to 5.04 s (-21%); TBT from 71 ms to 15.5 ms (-78%); Speed Index from 7.00 s to 5.04 s (-28%); CLS remained 0.
  - Median observed trace LCP improved from 2.35 s to 1.63 s (-31%); observed FCP from 2.35 s to 1.37 s (-42%); observed Speed Index from 2.35 s to 1.63 s (-31%).
  - Representative transferred JavaScript fell from 329,925 bytes to 209,807 bytes (-36%); all transferred assets fell from 395,670 bytes to 275,621 bytes (-30%).
  - Initial API fetches fell from 9 to 4 and normal-browser Telegram requests fell from 2 to 0.
- Browser verification at a 390 x 844 mobile viewport found all three account cards, both dashboard headings, all four navigation destinations, and the create-transaction action. The lazy transaction dialog opened successfully with no console exceptions.
- The temporary workspace/accounts fixture, authenticated headers, browser profiles, and secret-bearing Lighthouse reports were removed after the measurements; only sanitized aggregate results remain.

### Decisions

- Report both modeled Lighthouse metrics and observed trace timings because the local client-rendered/data-dependent route is penalized heavily by the simulated network model.
- Use medians from fresh Chrome profiles rather than warm-cache repeats.
- Keep the production RUM target unchanged; local trace LCP is below 2.5 seconds, but Speed Insights still needs post-deploy traffic to confirm the field result.
- Keep first-install service-worker takeover without a reload; reload only when a page already had a controller and receives an updated worker.

### Blockers / Follow-ups

- The built-in browser bridge could not attach from this WSL checkout because its sandbox path was not accepted, so local verification used standalone Chrome, Lighthouse, and the Chrome DevTools Protocol.
- `pnpm db:seed` could not reseed the existing local database because its cleanup order hit `debt_transactions_paymentTransactionId_fkey`; the performance fixture was created through the authenticated local API instead. No seed code was changed.
- Confirm the immutable `/assets/*` response header on the Vercel preview and review mobile Speed Insights after sufficient DEV/PROD samples accumulate.

## 2026-07-30 15:08 +03 - Primary Agent Interaction Follow-up

### Scope

- Addressed user feedback that first-time dashboard actions had become visibly slower after dialog code splitting.
- Kept first-level mobile interactions in their already breakpoint- or route-scoped chunks: the create-transaction form, account actions, transaction actions, account creation, transaction filters, and user menu content.
- Kept secondary edit/archive/delete forms lazy, but starts loading them as soon as the corresponding first-level action menu opens.
- Removed the full-screen `Загрузка…` interstitial from dashboard interactions.

### Files Changed

- `packages/web/src/modules/accounts/components/accounts-cards/AccountsCards.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/CombinedTransactionsList.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/components/CombinedTransactionsDialogs.tsx`
- `packages/web/src/routes/dashboard/components/MobileDashboardNavigation.tsx`
- `packages/web/src/routes/dashboard/components/MobileUserMenu.tsx`
- `packages/web/src/routes/dashboard/components/dashboard-shell-performance.test.ts`
- `packages/web/src/routes/dashboard/dashboard/components/DashboardContent.tsx`
- `packages/web/src/routes/dashboard/dashboard/components/dashboard-interaction-ux.test.ts`

### Commands Run

```bash
pnpm --filter web typecheck
pnpm --filter web check
pnpm --filter web test -- src/routes/dashboard/components/dashboard-shell-performance.test.ts src/routes/dashboard/dashboard/components/dashboard-interaction-ux.test.ts
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
```

### Results

- Web typecheck and Biome checks passed.
- All 50 web test files and 210 tests passed, including the new interaction-loading assertions.
- Production web build passed.
- Authenticated Chrome verification at a 390 x 844 mobile viewport measured:
  - create transaction: 111.7 ms to the rendered dialog;
  - account actions: 40.0 ms;
  - transaction actions: 43.2 ms.
- None of the three flows displayed the removed loading interstitial, and the browser reported no console errors.

### Decisions

- Treat first-level interactions as part of the interactive route rather than the cold-start-only optimization budget.
- Defer secondary forms behind their action menus, where the user's decision time provides a safe preload window.
- Preserve the responsive shell and route-level splitting that delivered the original mobile loading improvement.

## 2026-07-30 15:30 +03 - Category Dialog Follow-up

### Scope

- Addressed the remaining first-open delay in category settings reported during manual mobile QA.
- Kept the category dialog and editor inside the responsive dashboard chrome chunk so opening it never waits for a dynamic import.
- Prefetched category data during browser idle time and again on avatar/category intent through the existing TanStack Query key.

### Files Changed

- `packages/web/src/modules/accounts/components/category-settings-dialog/index.ts`
- `packages/web/src/modules/accounts/components/category-settings-dialog/useCategorySettingsPreload.ts`
- `packages/web/src/routes/dashboard/components/MobileUserMenu.tsx`
- `packages/web/src/routes/dashboard/components/Sidebar.tsx`
- `packages/web/src/routes/dashboard/components/dashboard-shell-performance.test.ts`
- `packages/web/src/routes/dashboard/dashboard/components/dashboard-interaction-ux.test.ts`

### Results

- Authenticated Chrome verification at 390 x 844 measured 178.2 ms from the category action to the rendered dialog and five editable category rows.
- The previous split-shell implementation needed 337.5 ms for the same content and briefly rendered its fallback.
- The final flow displayed no loading fallback, framework overlay, console error, or console warning.

### Decisions

- Accept the route-scoped category editor cost to guarantee interaction responsiveness; the dashboard route and mobile/desktop shell remain independently split from the application entry point.
- Keep the categories API request prefetched rather than making it an unconditional render-blocking dashboard request.

## 2026-07-30 15:52 +03 - Primary Agent Review

### Scope

- Reviewed the complete pull-request diff for correctness, interaction regressions, unnecessary preload work, secrets, and generated or temporary artifacts.
- Kept favicon synchronization active when the inline theme bootstrap had already applied the selected theme.
- Added complete service-worker polling and listener cleanup, including development Strict Mode remounts.
- Suppressed Telegram authentication errors after bootstrap cancellation.
- Scoped secondary transaction-dialog preloading to the selected transaction type instead of loading every dialog chunk.
- Removed disposable local TypeScript and Chrome/Lighthouse artifacts and corrected the work log to contain only portable, accurate evidence.

### Files Changed

- `packages/web/src/providers/AppProviders.tsx`
- `packages/web/src/shared/components/ServiceWorkerRegistration.tsx`
- `packages/web/src/modules/telegram-mini/TelegramMiniAppBootstrap.tsx`
- `packages/web/src/modules/transactions/components/combined-transactions-list/components/CombinedTransactionsDialogs.tsx`
- `packages/web/src/routes/dashboard/dashboard/components/dashboard-interaction-ux.test.ts`
- `packages/web/src/shared/lib/logo-assets.test.ts`
- `packages/web/src/shared/lib/service-worker-cache-policy.test.ts`
- `docs/plans/mobile-dashboard-performance/work-log.md`

### Commands Run

```bash
pnpm --filter web check
pnpm --filter web typecheck
pnpm --filter web test
VITE_API_URL=https://api.finnn.xyz pnpm --filter web build
pnpm check
pnpm typecheck
curl http://127.0.0.1:3000/login
curl http://127.0.0.1:4000/health
```

### Results

- Web check, typecheck, production build, and all 50 test files with 213 tests passed.
- Repository-wide generated-client drift, Biome, and TypeScript checks passed.
- Every emitted production asset matched the service-worker content-hash allowlist.
- The local web and API development servers both returned HTTP 200 after cleanup.
- No tracked Lighthouse reports, browser profiles, screenshots, traces, logs, build caches, or secret-bearing files remain.
