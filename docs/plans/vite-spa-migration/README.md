# Vite SPA Migration Plan

Status: completed and deployed to DEV and PROD on 2026-07-30.

## Summary

Replace the Next.js 16 App Router shell in `packages/web` with a Vite-built React 19 SPA using React Router in declarative/library mode. Preserve the existing client-side session gate, TanStack Query data flow, UI, PWA assets, and separate NestJS API. The migration removes the unused React Server Component/runtime boundary and makes the frontend a static deployment with a required history fallback.

## Goals

- Serve Finnn as a Vite SPA with the same public URLs and user-visible behavior.
- Use React Router for nested auth and dashboard layouts, client navigation, dynamic token parameters, and search parameters.
- Preserve route-level code splitting for feature pages and heavy analytics components.
- Preserve HTTP-only cookie authentication and cross-origin API requests with `credentials: "include"`.
- Preserve the PWA manifest, service-worker update flow, icons, theme metadata, Onest typography, Telegram Web App bootstrap, and Vercel Speed Insights.
- Remove Next.js runtime, build, routing, image, font, script, metadata, Storybook, test, and documentation dependencies.
- Complete and record an explicit one-time Next.js artifact audit before removing migration-only tooling.
- Keep this plan and `work-log.md` current throughout implementation.

## Non-Goals

- No visual redesign or copy changes.
- No NestJS API, OpenAPI, database, authentication contract, cookie policy, or domain-model changes.
- No adoption of React Router loaders/actions as a replacement for TanStack Query or the generated Orval client.
- No SSR, static prerendering, React Server Components, or server-side BFF.
- No deployment-provider changes beyond the Vercel web framework/output settings and API URL environment variables required by the migration.
- No browser screenshot QA without an explicit user request.

## Pre-Migration State

- `packages/web` uses Next.js 16.1 and React 19.2.
- App Router owns 12 page entry files, auth/dashboard layouts, two dynamic token routes, metadata, font loading, icons, and the root provider boundary.
- Protected pages are already CSR-first: their `page.tsx` files render client components, and `DashboardAuthGate` verifies the API session in the browser.
- Financial and workspace data is loaded through TanStack Query and a generated Orval client against the separate NestJS API.
- There are no web Route Handlers, Server Actions, middleware/proxy, ISR, or active server-side page-data dependencies.
- `packages/web/src/shared/lib/api-session.ts` is an unused Next server-session helper referenced only by its tests and documentation.
- Current Next-specific code includes `next/navigation`, `next/link`, `next/image`, `next/dynamic`, `next/font`, `next/script`, `next/headers`, Next metadata types, `@storybook/nextjs-vite`, and `@vercel/speed-insights/next`.
- The service worker recognizes `/_next/static/` and `/_next/data/`, which must be replaced with Vite asset behavior.

## Route Contract

The migration must preserve these URLs:

| URL | React Router owner | Layout / guard |
| --- | --- | --- |
| `/` | Home redirect route | Global providers |
| `/login` | Login route | Auth layout and `AuthPageGuard` |
| `/register` | Register route | Auth layout and `AuthPageGuard` |
| `/forgot-password` | Password-reset request route | Auth layout and `AuthPageGuard` |
| `/reset-password` | Password-reset confirmation route | Auth layout and `AuthPageGuard` |
| `/email-required` | Email-required route | Auth layout |
| `/invite/:token` | Workspace invite route | Auth layout |
| `/verify-email/:token` | Email verification route | Auth layout |
| `/dashboard` | Dashboard route | Dashboard layout and `DashboardAuthGate` |
| `/analytics` | Analytics route | Dashboard layout and `DashboardAuthGate` |
| `/debts` | Debts route | Dashboard layout and `DashboardAuthGate` |
| `/payments` | Scheduled payments route | Dashboard layout and `DashboardAuthGate` |
| `*` | Not-found redirect or screen | Global providers |

Query strings and hashes must survive navigation. In particular, preserve `workspaceId`, transaction filters, auth callback errors, invite tokens, password-reset state, and `returnTo` parameters.

## Proposed Architecture

```text
packages/web/
  index.html                    Vite HTML entry and static metadata
  vite.config.ts               React plugin and @ alias
  vercel.json                  SPA history fallback
  src/main.tsx                 createRoot entry and BrowserRouter boundary
  src/app/App.tsx              lazy route tree
  src/providers/AppProviders.tsx
  src/routes/auth/**            auth layout and route components
  src/routes/dashboard/**       dashboard layout, route components, and route-local UI
  src/styles/globals.css
  public/**                     icons, manifest, service worker, and static assets
```

Use React Router declarative/library mode. Continue using TanStack Query for all server state; do not introduce router loaders or actions. Use nested routes with `Outlet` for auth/dashboard layouts and `React.lazy` plus `Suspense` for route-level chunks.

## Implementation Plan

### Phase 1: Establish the Vite Runtime

1. Update `packages/web/package.json`:
   - replace `next dev`, `next build`, and `next start` with Vite `dev`, `build`, and `preview` commands while preserving ports 3000 and 9999;
   - remove `next` and `@storybook/nextjs-vite`;
   - add `vite`, `@vitejs/plugin-react`, React Router, `@storybook/react-vite`, and a self-hosted Onest font package;
   - keep `@vercel/speed-insights` and use its React entry point.
2. Add `packages/web/vite.config.ts` with the React plugin and `@` -> `src` alias.
3. Add `packages/web/index.html` containing:
   - Russian language declaration;
   - title, description, viewport, theme-color, manifest, favicon, and Apple PWA metadata equivalent to the current root layout;
   - Telegram Web App script before the application entry;
   - `/src/main.tsx` module entry.
4. Add `src/main.tsx`, move the global stylesheet to `src/styles/globals.css`, and move the provider tree to `src/providers/AppProviders.tsx`.
5. Load Onest from a local build dependency, preserve the existing `--font-onest` CSS contract, and avoid a runtime Google Fonts dependency.
6. Move Next-managed icon assets needed by Vite into `public` and verify all manifest/icon URLs resolve from the static root.

### Phase 2: Introduce React Router

1. Add the `BrowserRouter` boundary in `src/main.tsx`; add `src/app/App.tsx` with lazy route modules, nested `Routes`, and a deterministic fallback route.
2. Convert the auth and dashboard layouts to React Router layout components using `Outlet`.
3. Move Next route-group/page files into framework-neutral `src/routes/auth` and `src/routes/dashboard` locations. Preserve route-local components and update absolute imports that reference `@/app/(dashboard)`.
4. Replace navigation APIs:
   - `useRouter().push(path)` -> `useNavigate()(path)`;
   - `useRouter().replace(path)` -> `useNavigate()(path, { replace: true })`;
   - `useRouter().back()` -> `useNavigate()(-1)`;
   - `usePathname()` -> `useLocation().pathname`;
   - Next `useSearchParams()` -> React Router `useSearchParams()` while preserving read/update behavior;
   - Next `useParams()` -> typed React Router `useParams()`;
   - `next/link` `href` -> React Router `Link`/`NavLink` `to`, removing unsupported `prefetch` props.
5. Replace the three `router.refresh()` calls with explicit session/TanStack Query state updates. A React Router navigation must not trigger a full document reload merely to refresh client state.
6. Replace the transaction filter hook's direct `window.history.replaceState` calls with React Router `navigate({ pathname, search, hash }, { replace: true, preventScrollReset: true })`. Preserve unknown parameters such as `workspaceId` and the URL hash so every React Router location/search-param subscriber is notified reliably.

### Phase 3: Replace Remaining Next Integrations

1. Replace `next/dynamic(..., { ssr: false })` with `React.lazy` and focused `Suspense` fallbacks. Because the application is client-only, no SSR-disable flag is required.
2. Replace `next/image` usages with native images that retain explicit dimensions/aspect-ratio containers, alternative text, eager loading for the app mark, and lazy defaults elsewhere.
3. Replace `@vercel/speed-insights/next` with `@vercel/speed-insights/react`.
4. Delete the unused server-session helper and tests that mock `next/headers`.
5. Remove redundant `"use client"` directives after all code runs exclusively in the browser.
6. Replace `process.env.NEXT_PUBLIC_API_URL` with typed `import.meta.env.VITE_API_URL`. Update tests using Vitest environment stubs or explicit configuration seams.
7. Replace `.storybook/main.ts` framework configuration with `@storybook/react-vite` while preserving docs, accessibility addons, aliases, and `public` static assets.

### Phase 4: Static Hosting and PWA

1. Add `packages/web/vercel.json` with the official SPA rewrite to `/index.html`, so direct navigation to dynamic token and protected routes does not return 404.
2. Update `public/sw.js`:
   - bump the cache version;
   - recognize `/assets/` instead of `/_next/static/`;
   - remove `/_next/data/` handling;
   - continue excluding documents, API responses, protected redirects, and financial data from caches.
3. Update the service-worker cache-policy test for Vite asset paths and explicitly verify that HTML documents and data/API responses remain uncached.
4. Run a production build and use static inspection of `dist` to verify `index.html`, `assets`, manifest, icons, and `sw.js`. Browser screenshot QA remains out of scope under repository rules.

### Phase 5: Documentation and Operations

1. Update `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/development.md`, `docs/operations.md`, and other current documentation from Next/App Router terminology to Vite/React Router terminology.
2. Replace `NEXT_PUBLIC_API_URL` with `VITE_API_URL` in tracked examples and operational tables.
3. Document the required Vercel configuration:
   - framework/build detection for `packages/web`;
   - `dist` output;
   - SPA rewrite supplied by `vercel.json`;
   - DEV and PROD `VITE_API_URL` values must be created before rollout;
   - remove the obsolete `NEXT_PUBLIC_API_URL` only after the new variable is present in both environments.
4. Keep the existing DEV/PROD domains and API CORS origins unchanged.

### Phase 6: One-Time Next.js Artifact Audit

Use a temporary automated check during the migration. It must fail for runtime/configuration artifacts including:

- `packages/web/next.config.*`, `next-env.d.ts`, or a `.next` build directory;
- direct `next`, `@storybook/nextjs-*`, or other Next-only dependencies in `packages/web/package.json`;
- imports from `next`, `next/*`, or `@vercel/speed-insights/next` in web source/config/test files;
- `"use client"`, `"use server"`, and `"use cache"` directives in the Vite source tree;
- Next App Router convention files or route-group directories left under the old `src/app` layout;
- `process.env.NEXT_PUBLIC_*`, `NEXT_PUBLIC_API_URL`, `/_next/static`, `/_next/data`, `.next/types`, `next dev`, `next build`, or `next start` in active web configuration and current documentation;
- stale Next-specific Storybook framework configuration or test mocks;
- a direct `next` dependency visible through the web package dependency graph.

The audit may allow this migration plan/work log to describe historical Next.js artifacts, but active source, configuration, examples, and current architecture/operations documentation must be clean. Supplement the temporary check with explicit `rg`, `find`, and `pnpm --filter web list next --depth Infinity` checks during final verification. After the clean result is recorded in `work-log.md`, remove the temporary checker and its package script so migration-only machinery does not become permanent maintenance surface.

## Test Plan

### Automated

```bash
pnpm install
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web check
pnpm --filter web build
pnpm --filter web build:storybook
pnpm api:check-generated
pnpm typecheck
pnpm check
pnpm test
```

### Route and Static-Output Checks

- Verify the route table contains every URL listed above, including `:token` paths and a fallback.
- Verify programmatic push, replace, and back semantics in focused unit tests where practical.
- Verify `workspaceId` and filter query parameters survive route navigation.
- Verify auth redirects preserve `returnTo`, invite token, reset state, and error query parameters.
- Verify the production `dist/index.html` includes manifest, icon, viewport, theme, Telegram script, and app entry assets.
- Verify `dist/sw.js`, manifest, Apple icon, maskable icons, logos, and preset avatars exist.
- Verify Vercel SPA fallback configuration targets `/index.html`.
- Verify service-worker tests prohibit document/API/data caching and allow only static assets.

### Behavior Regression Checklist

- Root route redirects authenticated users to `/dashboard` and unauthenticated users to `/login`.
- Auth-only routes redirect authenticated users correctly.
- Dashboard routes wait for Telegram Mini App bootstrap and API session state.
- Login, logout, email verification, password reset, Google auth, Telegram auth, and invite acceptance retain current URLs and redirects.
- Desktop/sidebar and mobile navigation preserve `workspaceId`.
- Transaction filters continue updating the address bar without full reloads.
- Analytics charts and mobile user menu remain lazy-loaded with existing skeletons.
- Theme, accent color, dynamic favicon, PWA install metadata, pull-to-refresh, and service-worker update reload behavior remain intact.

## Documentation / Operations Updates

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/development.md`
- `docs/operations.md`
- `docs/README.md` if its frontend summary is framework-specific
- `packages/web/.env.example`
- `docs/plans/vite-spa-migration/work-log.md`

## Rollout Notes

1. Land code and tracked Vercel configuration without changing public domains.
2. Before deploying a shared environment, create `VITE_API_URL` with the same value as its existing `NEXT_PUBLIC_API_URL`.
3. Deploy DEV first and verify direct loads for `/dashboard`, `/invite/<token>`, and `/verify-email/<token>` plus Google/Telegram return flows.
4. Verify the new service worker activates, deletes the old `finnn-v3` cache, and does not cache documents or financial responses.
5. Deploy PROD after DEV verification.
6. Remove the obsolete Vercel `NEXT_PUBLIC_API_URL` after both environments are confirmed on the Vite build.

The rollout completed on 2026-07-30. Vercel now uses the Vite framework preset, the `packages/web` root, and `dist`
output. `VITE_API_URL` is configured independently for Development, Preview, and Production; the obsolete
`NEXT_PUBLIC_API_URL` entries were removed after a successful Preview build. PR #15 deployed and verified DEV before
PR #16 promoted the same migration to PROD. Both shared domains serve Vite assets and SPA deep links, target the
correct API origin, pass API health and credentialed CORS preflight checks, and serve the `finnn-v4` service worker
without Next.js cache paths.

## Risks and Mitigations

- **Direct-link 404s:** require and test Vercel history fallback.
- **Stale service-worker cache:** bump the cache name and retain activation cleanup.
- **Lost search parameters:** use React Router location/search APIs carefully and add focused tests for workspace/filter/auth URLs.
- **Session refresh regressions:** replace implicit `router.refresh()` behavior with explicit TanStack Query session state changes.
- **Bundle regression:** retain route lazy loading and analytics lazy loading; inspect Vite chunk output.
- **Typography shift:** self-host Onest and keep the existing CSS variable/fallback contract.
- **Deep import churn:** move route-local code mechanically and use `rg` to update every old `@/app/(dashboard)` import.
- **Deployment env mismatch:** document a two-phase `VITE_API_URL` rollout before removing the old variable.
- **False-negative artifact audit:** combine the temporary automated check, package graph check, source scans, path scans, and clean-build verification, then record the results before removing migration-only tooling.

## Open Questions

No blocking product questions. Implementation will use the latest mutually compatible stable versions resolved by `pnpm`, preserve declarative React Router mode, and make the smallest behavior-preserving choices available in the repository.

## Acceptance Criteria

- `packages/web` builds and previews with Vite and contains no Next runtime dependency.
- All existing URLs and client-side guards behave equivalently under React Router.
- The frontend is deployable as static `dist` output with a working Vercel history fallback.
- Existing unit tests plus new routing/static-output/artifact tests pass.
- The one-time artifact audit is recorded as clean; package-local checks, full workspace checks, and generated API drift checks pass.
- Current documentation describes Vite, React Router, `VITE_API_URL`, and the static deployment accurately.
- The plan work log records implementation passes, subagent contributions, verification commands, and any remaining external rollout action.
