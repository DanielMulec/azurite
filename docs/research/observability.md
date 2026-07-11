# Observability Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### Sentry JavaScript Logs

- URL: https://docs.sentry.io/platforms/javascript/logs/
- Accessed: 2026-07-09
- Area: Frontend observability
- Use when: Evaluating hosted structured logs, console-log capture, and
  correlated error/debugging telemetry for Azurite.
- Notes: Sentry JavaScript logs support structured attributes and log levels
  through `enableLogs` and `Sentry.logger`. The installed 10.64.0 SDK also
  exports `consoleLoggingIntegration` for selected console levels.
- Caveats: For Daniel-owned Sentry debug mode, logs should be uncensored and
  diagnostically complete. Do not treat note content, local paths, editor state,
  or request context as data to redact from Sentry debug telemetry.

### Sentry JavaScript Session Replay

- URL: https://docs.sentry.io/platforms/javascript/session-replay/privacy/
- Accessed: 2026-07-09
- Area: Frontend observability
- Use when: Evaluating browser session replay for editor debugging.
- Notes: Sentry documents default text/input masking and media blocking before
  upload. The installed React SDK types accept `maskAllText`, `maskAllInputs`,
  and `blockAllMedia` on `replayIntegration`.
- Caveats: For Azurite debug sessions, replay should favor full editor-debugging
  fidelity over masking. Verify replay usefulness, not privacy minimization.

### Sentry React

- URL: https://docs.sentry.io/platforms/javascript/guides/react/
- Accessed: 2026-07-09
- Area: Frontend observability
- Use when: Adding Sentry to Azurite's React/Vite browser app.
- Notes: Sentry documents initialization before the app renders. The installed
  10.64.0 React SDK exports `init`, `replayIntegration`,
  `browserTracingIntegration`, `consoleLoggingIntegration`, `logger`, and
  tracing/error APIs used by Azurite's enabled-only runtime module.
- Caveats: Azurite is a local-first SPA, so avoid framework-specific Sentry
  setup paths for SSR frameworks unless the frontend stack changes.

### Sentry React Tracing

- URL: https://docs.sentry.io/platforms/javascript/guides/react/tracing/
- Accessed: 2026-07-09
- Area: Frontend/backend correlation
- Use when: Configuring browser tracing, sample rates, and trace propagation
  targets for Azurite API requests.
- Notes: Sentry tracing can propagate context from browser requests to backend
  services when configured with appropriate trace propagation targets. Azurite
  verified `sentry-trace` and `baggage` across its relative Vite proxy path.
- Caveats: Azurite still needs its own request and operation IDs because trace
  sampling, proxying, or SDK limitations can leave a debugging path incomplete.

### Sentry Browser Scopes

- URL: https://docs.sentry.io/platforms/javascript/enriching-events/scopes/
- Accessed: 2026-07-10
- Area: Frontend correlation and concurrency
- Use when: Attaching note, request, operation, editor, or payload context to
  browser Sentry events without leaking it across overlapping work.
- Notes: Sentry documents global, isolation, and current scopes. In browser
  applications the isolation scope is effectively global, while `withScope`
  provides a short-lived current scope for event-local enrichment.
- Caveats: Azurite must keep browser operation state in app-owned closures or
  sessions and pass explicit event attributes. A mutable browser isolation scope
  is not a safe owner for concurrent note context.

### Sentry Vite Source Maps

- URL: https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/
- Accessed: 2026-07-09
- Area: Release and source-map observability
- Use when: Adding production-like source-map uploads for Azurite's Vite build.
- Notes: Sentry documents a Vite plugin for release/source-map upload and notes
  that build-time auth token handling needs explicit configuration.
- Caveats: Source-map upload requires Sentry auth configuration and belongs in a
  future release-observability slice, not the first local debug setup.

### Sentry Fastify

- URL: https://docs.sentry.io/platforms/javascript/guides/fastify/
- Accessed: 2026-07-08
- Area: Backend observability
- Use when: Adding Sentry to Azurite's local Fastify API server.
- Notes: Sentry documents Node initialization before Fastify import. The
  installed 10.64.0 Node SDK exports `fastifyIntegration`; Fastify 5 is
  supported through diagnostics channels and was verified under Azurite's
  custom conditional ESM preload.
- Caveats: The installed SDK documentation and source identify
  `setupFastifyErrorHandler` as the Fastify 3/4 path and warn that it duplicates
  Fastify 5 error capture, so Azurite does not install it.

### Sentry Node And Fastify Scopes

- URL: https://docs.sentry.io/platforms/javascript/guides/fastify/enriching-events/scopes/
- Accessed: 2026-07-10
- Area: Backend request correlation and concurrency
- Use when: Deciding how Azurite request metadata relates to SDK-managed
  per-request scope in the Fastify server.
- Notes: Sentry documents isolation scopes as request-local in server runtimes
  and recommends narrow current scopes for temporary event enrichment. The
  Fastify integration manages SDK request isolation for automatic telemetry.
- Caveats: Azurite's decorated Fastify request remains the authoritative
  correlation context. Route events and spans must still receive explicit
  attributes and must not depend on Sentry scope as product state.

### Sentry Node Logs

- URL: https://docs.sentry.io/platforms/javascript/guides/node/logs/
- Accessed: 2026-07-09
- Area: Backend structured logs
- Use when: Sending searchable structured backend logs to Sentry from Azurite's
  local Node/Fastify runtime.
- Notes: Sentry supports structured logs with attributes that can be queried and
  correlated with errors and traces. The installed Node SDK exposes
  `enableLogs`, `logger`, `consoleLoggingIntegration`, and `flush` used by the
  runtime and bounded shutdown path.
- Caveats: Backend Sentry logs should capture complete debugging context when
  Sentry debug mode is enabled. Keep local Fastify logging behavior intact.

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
