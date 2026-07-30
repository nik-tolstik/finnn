# Mobile Dashboard Performance

## Summary

Reduce mobile `/dashboard` LCP by removing parser-blocking and interaction-only work from the cold path, flattening route and workspace loading, and deferring below-the-fold rendering without weakening authentication or financial-data cache policy.

## Goals

- Bring mobile `/dashboard` LCP below 2.5 seconds, with a working target near 2.2 seconds.
- Keep INP below 100 ms and CLS below 0.1.
- Reduce the compressed JavaScript required before the dashboard can render.
- Preserve all account, transaction, debt, scheduled-payment, workspace, and Telegram Mini App workflows.
- Provide repeatable local mobile measurements in addition to post-deploy RUM.

## Non-Goals

- No backend data-model or API contract changes unless client-only work proves insufficient.
- No caching of HTML documents, protected routes, API responses, or financial data.
- No redesign of the dashboard.

## Current State

- `packages/web/index.html` loads the Telegram SDK synchronously before the Vite entry module.
- `packages/web/src/app/App.tsx` uses nested render-time `React.lazy` boundaries for the dashboard layout and route.
- `DashboardShell` mounts desktop and mobile chrome together and hides the inactive branch with CSS.
- Account, navigation, transaction, filter, and settings modules statically import interaction-only dialogs and drag-and-drop code.
- `DashboardRoute` renders `null` while workspace resolution is pending.
- Filter-only member and category queries start on every dashboard visit.
- The transaction section renders below-the-fold work immediately.
- Hashed assets are not currently given an explicit immutable cache policy.

## Implementation Plan

1. Load the Telegram SDK without blocking normal browser rendering while preserving Mini App initialization.
2. Preload the matched protected layout and child route together to remove the nested lazy-import waterfall.
3. Start workspace discovery as soon as authentication succeeds and reuse the TanStack Query cache in the route.
4. Split desktop and mobile shell branches so mobile does not execute desktop-only queries or load desktop settings code.
5. Dynamically import click-only dialogs, filters, transaction actions, and drag-and-drop code.
6. Delay filter-only data queries until the filter opens.
7. Render a stable dashboard loading frame instead of a blank route and use realistic mobile skeleton geometry.
8. Apply `content-visibility` and intrinsic sizing to below-the-fold transaction content.
9. Add immutable caching for content-hashed `/assets/*` while preserving network-only behavior for documents and APIs.
10. Add or update narrow tests for preload, responsive loading, query gating, and cache policy.

## Test Plan

- `pnpm --filter web test`
- `pnpm --filter web typecheck`
- `pnpm --filter web check`
- `VITE_API_URL=https://api.finnn.xyz pnpm --filter web build`
- Repository-wide `pnpm typecheck` and `pnpm check` after targeted checks pass.
- Compare before/after production build chunk graphs.
- Run an authenticated mobile Lighthouse/Chrome trace against a local production build when the local API/data path permits it; otherwise use a deterministic mocked authenticated harness and document the limitation.
- Verify the page identity, meaningful content, console health, mobile navigation interaction, and dialog lazy-loading behavior.

## Documentation And Operations

- Record commands, results, decisions, and subagent contributions in `work-log.md`.
- Update `docs/operations.md` only if Vercel settings or deployment procedures change.

## Rollout

1. Validate locally.
2. Push the dedicated branch and open a draft PR targeting `develop`.
3. Verify the DEV deployment.
4. Merge through the existing branch-owned deployment flow.
5. Compare PROD Speed Insights after enough mobile samples accumulate.

## Risks

- Conditional Telegram loading can break Mini App startup if readiness is not modeled explicitly.
- Responsive code splitting must still support viewport changes without losing navigation state.
- Lazy dialogs need focused fallbacks and import-error handling.
- Skeleton changes can trade LCP improvements for CLS if geometry is not stable.
- Synthetic metrics depend on authentication and local API latency, so bundle/trace evidence must be reported separately from RUM.
