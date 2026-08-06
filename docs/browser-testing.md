# Browser Testing

Use the repository Playwright workflow for explicit browser, visual, or rendered-frontend QA requests.

## Available tools

- `@playwright/test` is a web-package development dependency.
- Chromium is the supported browser for repository browser tests.
- Vite starts the web app for the test run automatically.
- The configuration provides desktop and mobile-sized Chromium projects.
- Storybook remains available for component-level visual review through `pnpm storybook`.

The Browser plugin or `agent-browser` CLI may not be available in every Codex session. Do not search for a global
Playwright installation or use an environment-specific bundled path: use the project commands below.

## Setup

Install the project dependencies with the repository package manager, then install Chromium once per environment:

```bash
pnpm install
pnpm browser:install
```

The browser binary is stored in Playwright's user cache and is not committed to the repository.

## Run browser tests

Add a focused spec under `packages/web/e2e/` for the flow being changed, then run it from the repository root:

```bash
pnpm browser:test
```

From the web package:

```bash
pnpm --filter web browser:test
```

The repository provides the Playwright runner and configuration but does not impose a product-specific E2E scenario.
Keep each new spec focused on the requested flow and mock external dependencies when real credentials or services are
not required.

To run one project or one test file:

```bash
pnpm --filter web exec playwright test --project=chromium-desktop
pnpm --filter web exec playwright test e2e/<test-file>.spec.ts
```

Use `PLAYWRIGHT_WEB_PORT` when another local service already occupies port 4173:

```bash
PLAYWRIGHT_WEB_PORT=4174 pnpm browser:test
```

## Visual QA workflow

For a rendered UI change, add focused browser coverage when the changed flow needs visual or interaction validation:

1. Identify the flow as entry route → user action → expected rendered state.
2. Run the targeted Playwright spec and inspect generated screenshots when the test fails or visual evidence is needed.
3. Check desktop and mobile-sized viewports when the change affects responsive layout.
4. Check the browser console, page errors, failed requests, overlays, clipping, overlap, and stale loading states.
5. Keep screenshots, traces, and reports outside committed source; Playwright writes them under the ignored
   `packages/web/test-results/` directory.
6. Stop any manually started dev servers after the check.

## Real API and custom ports

For a real API flow, start the API and web app with matching origins. The API must allow the exact web origin through
`API_ALLOWED_ORIGINS`, and the web app must use the matching `VITE_API_URL`. For example, a web app on port 3002
requires an origin such as `http://127.0.0.1:3002`; otherwise the browser will report a CORS failure even if both
servers are running.

The standard local ports are documented in [`docs/development.md`](./development.md): API 4000 and web 3000.
