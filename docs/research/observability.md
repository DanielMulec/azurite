# Observability Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### Sentry JavaScript Logs

- URL: https://docs.sentry.io/platforms/javascript/logs/
- Accessed: 2026-07-08
- Area: Frontend observability
- Use when: Evaluating hosted structured logs, console-log capture, and
  correlated error/debugging telemetry for Azurite.
- Notes: Sentry JavaScript logs support structured attributes, log levels, and a
  console logging integration when logs are enabled.
- Caveats: For Daniel-owned Sentry debug mode, logs should be uncensored and
  diagnostically complete. Do not treat note content, local paths, editor state,
  or request context as data to redact from Sentry debug telemetry.

### Sentry JavaScript Session Replay

- URL: https://docs.sentry.io/platforms/javascript/session-replay/privacy/
- Accessed: 2026-07-08
- Area: Frontend observability
- Use when: Evaluating browser session replay for editor debugging.
- Notes: Sentry documents default text/input masking and media blocking for
  replay data before upload.
- Caveats: For Azurite debug sessions, replay should favor full editor-debugging
  fidelity over masking. Verify replay usefulness, not privacy minimization.

### Sentry React

- URL: https://docs.sentry.io/platforms/javascript/guides/react/
- Accessed: 2026-07-08
- Area: Frontend observability
- Use when: Adding Sentry to Azurite's React/Vite browser app.
- Notes: Sentry documents the React SDK for client-side React applications,
  including errors, logs, session replay, tracing, and SDK initialization before
  the app renders.
- Caveats: Azurite is a local-first SPA, so avoid framework-specific Sentry
  setup paths for SSR frameworks unless the frontend stack changes.

### Sentry React Tracing

- URL: https://docs.sentry.io/platforms/javascript/guides/react/tracing/
- Accessed: 2026-07-08
- Area: Frontend/backend correlation
- Use when: Configuring browser tracing, sample rates, and trace propagation
  targets for Azurite API requests.
- Notes: Sentry tracing can propagate context from browser requests to backend
  services when configured with appropriate trace propagation targets.
- Caveats: Azurite still needs its own request and operation IDs because trace
  sampling, proxying, or SDK limitations can leave a debugging path incomplete.

### Sentry Vite Source Maps

- URL: https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/
- Accessed: 2026-07-08
- Area: Release and source-map observability
- Use when: Adding production-like source-map uploads for Azurite's Vite build.
- Notes: Sentry documents a Vite plugin for release/source-map upload and notes
  that build-time auth token handling needs explicit configuration.
- Caveats: Source-map upload requires Sentry auth configuration and belongs in a
  future release-observability slice, not the first local debug setup.

### Sentry Pricing

- URL: https://sentry.io/pricing/
- Accessed: 2026-07-08
- Area: Observability service cost
- Use when: Checking whether Sentry's hosted plans fit solo/development
  observability needs.
- Notes: Sentry advertises a free Developer plan and event-based pricing across
  errors, traces, replays, and logs.
- Caveats: Re-check before adoption because quotas, included volumes, and
  billing behavior can change.

### Sentry Self-Hosted

- URL: https://develop.sentry.dev/self-hosted/
- Accessed: 2026-07-08
- Area: Self-hosted observability
- Use when: Comparing hosted Sentry with self-hosted Sentry for development
  observability operations.
- Notes: Sentry documents self-hosted deployment and source availability.
- Caveats: Self-hosted Sentry is operationally heavier than Azurite's current
  development needs and uses Sentry's source-available licensing model.

### Sentry Fastify

- URL: https://docs.sentry.io/platforms/javascript/guides/fastify/
- Accessed: 2026-07-08
- Area: Backend observability
- Use when: Adding Sentry to Azurite's local Fastify API server.
- Notes: Sentry documents an official Fastify setup path for capturing backend
  errors and telemetry.
- Caveats: Verify against Azurite's current Fastify version and existing error
  response contracts before implementation.

### Sentry Node Logs

- URL: https://docs.sentry.io/platforms/javascript/guides/node/logs/
- Accessed: 2026-07-08
- Area: Backend structured logs
- Use when: Sending searchable structured backend logs to Sentry from Azurite's
  local Node/Fastify runtime.
- Notes: Sentry supports structured logs with attributes that can be queried and
  correlated with errors and traces.
- Caveats: Backend Sentry logs should capture complete debugging context when
  Sentry debug mode is enabled. Keep local Fastify logging behavior intact.

### Zustand Devtools Middleware

- URL: https://github.com/pmndrs/zustand#redux-devtools
- Accessed: 2026-07-08
- Area: Frontend state debugging
- Use when: Inspecting Zustand actions, state transitions, and store snapshots
  during editor persistence QA.
- Notes: Zustand can connect to the Redux DevTools extension, name stores, log
  action types, and disable devtools through configuration.
- Caveats: For explicit debug sessions, Zustand state capture may include full
  editor and draft state when that helps diagnose behavior.

### Dexie Debug And DBCore

- URL: https://dexie.org/docs/Dexie/Dexie.debug
- Accessed: 2026-07-08
- Area: IndexedDB diagnostics
- Use when: Debugging Dexie errors, draft persistence failures, or IndexedDB
  timing around editor recovery.
- Notes: Dexie debug mode improves error stack context. Dexie also documents
  DBCore middleware for intercepting runtime IndexedDB calls.
- Caveats: Dexie debug/error context is not a complete draft lifecycle log;
  Azurite still needs explicit draft read/write/delete breadcrumbs.

### Milkdown Listener Plugin

- URL: https://milkdown.dev/docs/api/plugin-listener
- Accessed: 2026-07-08
- Area: Milkdown editor diagnostics
- Use when: Instrumenting Milkdown markdown update callbacks and editor update
  boundaries.
- Notes: Milkdown exposes listener hooks such as markdown update events and is
  built on ProseMirror and Remark.
- Caveats: Listener callbacks alone do not explain floating menu focus,
  selection, or remount behavior; pair with browser QA and ProseMirror-level
  inspection.

### Playwright Trace Viewer And Console Capture

- URL: https://playwright.dev/docs/trace-viewer
- Accessed: 2026-07-08
- Area: Browser QA and frontend debugging
- Use when: Reproducing editor UI findings with screenshots, DOM snapshots,
  network activity, and console evidence.
- Notes: Playwright traces support visual step-by-step debugging, and
  Playwright's console event API can capture frontend console output.
- Caveats: Trace artifacts from Daniel-owned QA may contain real app state; that
  is acceptable when the trace is created for debugging.

### OpenReplay Session Replay

- URL: https://docs.openreplay.com/en/home/
- Accessed: 2026-07-08
- Area: Self-hosted session replay
- Use when: Evaluating a self-hosted replay alternative for browser debugging.
- Notes: OpenReplay documents an open-source, self-hosted session replay stack
  with tracker SDK setup and plugins.
- Caveats: A full replay stack is heavier than a focused editor diagnostics
  slice. This source is only relevant if Sentry stops satisfying Azurite's
  debugging needs.

### OpenReplay Zustand Plugin

- URL: https://docs.openreplay.com/en/plugins/zustand/
- Accessed: 2026-07-08
- Area: Frontend state replay
- Use when: Comparing packaged Zustand mutation/state capture against custom
  Azurite diagnostics.
- Notes: OpenReplay's Zustand plugin captures mutations and state for replay
  sessions and supports filters/transformers.
- Caveats: This source is only relevant if Azurite evaluates an OpenReplay
  alternative to Sentry's uncensored debug telemetry.

### rrweb

- URL: https://github.com/rrweb-io/rrweb
- Accessed: 2026-07-08
- Area: Session replay foundation
- Use when: Evaluating low-level session replay capture without adopting a full
  hosted observability product.
- Notes: rrweb records and replays DOM state changes and user interactions, and
  underpins several replay products.
- Caveats: Raw replay capture requires storage, export, and review tooling to be
  useful, so it is heavier than using Sentry for the current debug workflow.
