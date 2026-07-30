# Mobile Dashboard Performance Prompt

## Goal

Improve the authenticated mobile `/dashboard` experience, with a primary focus on reducing Largest Contentful Paint while preserving the current finance workflows and visual behavior.

## Requirements

- Implement the full agreed performance plan, including third-party script loading, route and data waterfalls, responsive shell loading, on-demand interaction code, below-the-fold rendering, and static asset caching.
- Work in a dedicated Git worktree and branch.
- Validate mobile performance independently from Vercel Speed Insights using a repeatable local measurement.
- Run the repository checks and create a GitHub pull request.

## Constraints

- Branch: `agent/mobile-dashboard-performance`.
- Base: the current local `develop` HEAD.
- Keep protected routes client-rendered and keep API authorization as the security boundary.
- Do not cache financial documents, API responses, dashboard routes, or data responses in the service worker.
- Use `pnpm`.
- Do not change product behavior solely to improve a synthetic score.

## Baseline

- Vercel Speed Insights mobile `/dashboard` LCP p75: 3,171 ms.
- Vercel Speed Insights mobile `/dashboard` INP p75: 88 ms.
- Current local production build matches the deployed bundle layout and includes several interaction-only dependencies in the initial dashboard import graph.
