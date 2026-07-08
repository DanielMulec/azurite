# Proposed Slice: End-To-End Sentry Observability Foundation

## Status

Revised after adversarial review, side-chat decisions, and third-review
hardening.

This observability foundation is the next real implementation slice. This
planning update deliberately moves create-new-notes later in the roadmap so the
project does not carry two competing next-slice truths.

## Product Decision

Azurite adopts Sentry as the observability backbone for the current local web
app and local Fastify API runtime.

Sentry owns the durable observability platform role: event capture, structured
logs, session replay, error grouping, trace correlation, and investigation UI.
Azurite owns a thin semantic instrumentation layer that explains product events
such as note routing, editor updates, draft persistence, save conflicts, and
filesystem-backed note route outcomes.

This settles that Azurite will not hand-roll a custom logging/replay system for
development debugging when a mature observability platform can own that future
product capability.

## User Story

As Daniel testing real notes on desktop Chrome or mobile over Tailscale, when
Azurite feels wrong, we can inspect the real session path in Sentry:

- browser session replay
- frontend errors, logs, breadcrumbs, and traces
- frontend API request breadcrumbs with request IDs
- backend Fastify request/error telemetry for the same request IDs
- backend route-boundary structured logs for note list/read/save behavior
- Azurite-specific breadcrumbs for routing, Milkdown, Zustand, Dexie, save,
  conflict, recovery, and cluster metadata behavior

## Why This Matters

Slice 6 made Azurite meaningfully testable, but the most important current
failure modes are under-instrumented. Backend logs show request success or
failure, and Vite shows incidental browser warnings, but neither explains the
full editor and persistence path.

The Milkdown block-menu QA finding shows the gap clearly: a visual editor issue
may involve Milkdown focus, React render timing, Zustand state transitions,
Dexie draft writes, frontend fetches, and backend note state. Azurite needs a
single investigation surface that can correlate those events across the current
runtime.

## Future Workflow Boundary

### Current Workflow

This slice covers the current local development workflow end to end:

1. Daniel starts the local Fastify API and Vite web app.
2. The web app may be opened on desktop Chrome or from a phone over the
   Tailscale MagicDNS URL while the backend stays local-only behind the Vite
   proxy.
3. The app lists notes from the configured filesystem cluster.
4. URL-owned route state selects a note.
5. The frontend reads that note through `/api/notes/content`.
6. The Milkdown editor mounts, switches modes, emits markdown updates, and
   writes browser-local drafts through Dexie.
7. Manual save writes markdown through the content-hash conflict contract.
8. Missing-note, degraded draft recovery, save failure, and conflict states stay
   visible and debuggable.
9. Sentry shows the replay, frontend logs/breadcrumbs/traces, backend
   route-boundary request/error telemetry, and Azurite semantic events for the
   same session, note, request, and save operation.

The user story is complete only when a real desktop session and a real
mobile/Tailscale session can be followed from browser behavior through the API
request, server route boundary, and filesystem-backed note outcome surfaced by
that boundary.

### Future Workflows This Foundation Must Support

The observability vocabulary and correlation contract must be durable enough for
near-term Azurite slices:

- create new markdown notes
- recoverable delete or move-to-trash behavior
- autosave policy and conflict resolution
- file watching and external-edit detection
- derived indexing, search, backlinks, and graph behavior
- multi-cluster selection and cluster identity changes
- PWA installability, service worker behavior, offline/degraded states, and
  mobile tab discard recovery
- authentication and local/Tailscale hosting hardening
- production-like release builds with source-map upload

These future workflows should reuse the same event naming, request ID,
operation ID, trace propagation, release, environment, surface, cluster, and
note attributes instead of creating parallel telemetry shapes.

### Product Layers Participating Now

This slice touches every current layer that participates in the note
investigation workflow:

- repository docs and environment examples
- `apps/web` entrypoint and Sentry initialization
- React app shell and error boundary
- TanStack Router selected-note URL state
- web API client fetch boundary and request headers
- Zustand note browser store actions
- Dexie draft persistence and recovery states
- Milkdown/Crepe editor lifecycle and markdown update hooks
- Vite dev server proxy and Tailscale MagicDNS access path
- `packages/shared` API routes, error codes, and observability constants
- `apps/server` entrypoint, Sentry initialization, Fastify lifecycle, and Pino
  logging
- Fastify note list/read/save routes
- existing `packages/core` filesystem note read/write, note ID, path boundary,
  content hash, and cluster metadata behavior as surfaced by server route
  return values and caught errors. `packages/core` stays Sentry-free in this
  slice and receives no new observer contract.
- Vitest unit/integration tests
- manual desktop and mobile Sentry UI verification

### Product Layers Predictably Needed Soon

The implementation should leave explicit seams for these soon-needed layers
without instrumenting nonexistent runtimes:

- create/delete API routes and frontend actions
- note lifecycle operation IDs that span create, save, delete, and future
  recovery flows
- file-watch and external-change events
- derived index/search worker or backend service instrumentation
- PWA/service-worker telemetry once that runtime exists
- release/source-map upload for production-like builds
- future auth and local-hosting decision telemetry

### Deliberately Excluded Layers

These layers are excluded because they do not yet participate in a working
Azurite runtime or because they would create a different product slice:

- mobile-native and desktop-native apps
- service workers, sync workers, indexing workers, and background jobs that do
  not exist yet
- public production telemetry policy
- custom in-app log viewer
- Sentry self-hosting or billing work
- source-map upload automation that requires Sentry auth tokens
- direct `packages/core` observability hooks, observer interfaces, or Sentry
  imports
- fixing the Milkdown block-menu bug itself

The exclusions are stable for this slice because the current product value is
development observability for the existing browser, API, and filesystem-backed
note workflow at the browser, API, and server route boundary. Direct core-level
observability waits until a future slice introduces a second core runtime,
background worker, indexing service, or repeated need to inspect below the route
boundary.

## Goals

- Create Sentry coverage for the current `apps/web` React browser surface.
- Create Sentry coverage for the current `apps/server` Fastify API surface.
- Verify that real desktop and mobile/Tailscale Azurite sessions reach Sentry.
- Capture frontend session replay for editor QA with unmasked debug content.
- Capture frontend logs, errors, breadcrumbs, and traces.
- Capture backend Fastify errors, request telemetry, structured logs, and
  route-level core outcome/error evidence.
- Propagate trace context across frontend `/api/*` calls into the backend.
- Add Azurite request IDs and operation IDs so events remain correlatable even
  when Sentry trace propagation is incomplete.
- Load local Sentry values from one root untracked `.env.local` while keeping
  typed web/server config parsing independent of the local value source.
- Establish shared event names and rich diagnostic attributes for Azurite
  observability.
- Map semantic telemetry intentionally into logs, breadcrumbs, spans, tags,
  context, and errors.
- Add explicit development-only, env-gated test telemetry triggers.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Fixing the Milkdown block-menu bug in this slice.
- Adding Sentry to future mobile-native, desktop-native, worker, sync, or
  indexing surfaces that do not exist yet.
- Creating a public production telemetry policy.
- Creating a custom in-app log viewer.
- Persisting observability events as Azurite product state.
- Replacing existing Fastify/Pino logs with Sentry.
- Adding direct Sentry instrumentation, observer hooks, or telemetry contracts to
  `packages/core`.
- Adding payment information, paid Sentry features, or billing-dependent
  behavior.
- Uploading source maps to Sentry during local development.

## Existing Sentry State

- Organization/workspace: `Daniel Mulec`
- Web project: `azurite-web`
- Web platform: React
- Web project URL:
  `https://daniel-mulec.sentry.io/projects/azurite-web/getting-started/`

The backend project still needs to be created:

- Backend project: `azurite-server`
- Backend platform: Fastify, using Sentry's official Fastify setup path.

If the Sentry UI offers both Fastify and generic Node.js setup paths, choose
Fastify. Use the generic Node.js path only if the Fastify path is unavailable or
blocked, and record that implementation decision in the slice notes.

## Architecture

### Sentry Projects

Use two Sentry projects:

- `azurite-web` for React browser telemetry.
- `azurite-server` for Fastify API telemetry.

This split matches Azurite's current runtime boundary and Sentry's project
model. Browser/editor problems and backend route-boundary/filesystem-backed
outcomes should be grouped separately while still being correlatable through
trace IDs, Azurite request IDs, note operation IDs, note IDs, release, and
environment.

### Configuration Boundary

Sentry configuration must be parsed through explicit web and server config
modules. Feature code must consume typed config objects and helper APIs, not raw
`import.meta.env` or `process.env` reads.

Preferred local development workflow:

- Commit one root `.env.example` with placeholder values for every supported
  Sentry variable.
- Use one root untracked `.env.local` for Daniel's real local Sentry values.
- Keep `.env.local`, real DSNs, Sentry auth tokens, and unrelated local
  credentials out of Git.
- Treat `.env.local` only as the local development value source. Future
  production, showcase, or packaged deployments may inject the same variables
  through platform-managed environment variables or secret stores without
  changing Sentry feature code.

Web variables:

- `VITE_SENTRY_ENABLED`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACE_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE`
- `VITE_SENTRY_TEST_EVENTS_ENABLED`

Server variables:

- `SENTRY_ENABLED`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_TRACE_SAMPLE_RATE`
- `SENTRY_TEST_EVENTS_ENABLED`

Exact loading mechanism:

- `apps/web/vite.config.ts` sets Vite's `envDir` to the repository root so the
  web app reads the root `.env.local` and exposes only `VITE_*` values to client
  code.
- `apps/web/src/config/sentry-config.ts` parses `import.meta.env` into a typed
  web Sentry config, including strict booleans and sample-rate numbers.
- The server ESM preload path loads the root `.env.local` before Sentry
  initialization by using Node 26's built-in environment-file support from a
  small server-local env module. The loader is optional: missing `.env.local`
  keeps normal Sentry-disabled startup working.
- `apps/server/src/config/sentry-config.ts` parses `process.env` into a typed
  server Sentry config, including strict booleans and sample-rate numbers.
- Enabled flags use the literal string `true`. Missing, empty, or invalid flags
  are disabled. Sample-rate values must parse to numbers in the inclusive
  `0..1` range; invalid values fall back to the documented debug defaults
  without crashing local startup.

Sentry is disabled unless both the enabled flag and DSN are present. Disabled
mode must avoid importing or initializing expensive browser replay/runtime code
where practical and must behave like the current app.

### Source Maps And Release Metadata

The first implementation uses release naming plus local development source maps.
It does not add source-map upload infrastructure.

Production-like source-map upload is deferred until Azurite has a production-like
build/distribution slice. That later work should evaluate `@sentry/vite-plugin`,
Sentry auth tokens, organization/project slugs, build-only environment loading,
and uploaded artifact verification as one focused release-observability task.

### Fastify Initialization Boundary

Sentry must initialize before Fastify is imported or instrumented.

Use Sentry's official ESM `--import` preload path for the server dev/start
runtime. Add a committed server preload file such as
`apps/server/src/sentry-preload.mjs`, and document it as the required
external-tooling exception to Azurite's TypeScript-script preference. This
exception is justified because the file is loaded by Node before TypeScript app
modules and before Fastify can be imported.

Remove the dynamic-import-first framing from implementation. The server package
`dev` and `start` scripts must run through the real `tsx` path with the Sentry
preload installed, for example `tsx --import ./src/sentry-preload.mjs
src/index.ts`, unless implementation discovers the exact `tsx` flag shape needs
minor adjustment. Any adjustment must preserve the same preload ordering and be
recorded in the slice notes.

The accepted behavior is:

- Sentry-enabled server startup initializes Sentry before `fastify` is loaded.
- Sentry-disabled server startup does not require a DSN and preserves current
  startup behavior.
- Existing graceful shutdown behavior remains intact.
- Existing Fastify/Pino logging remains intact.
- Automated startup tests prove the real `tsx` dev/start path loads the preload
  before `apps/server/src/app.ts` imports Fastify.
- The required `.mjs` preload file is the only `.mjs` exception introduced by
  this slice and is documented where the file or package script is defined.

### Backend Shutdown Boundary

Graceful shutdown must give Sentry a short chance to send queued backend
telemetry without making Azurite hang forever.

Accepted shutdown behavior:

- Sentry-enabled shutdown closes or flushes the Sentry SDK after Fastify stops
  accepting work and before process exit.
- The flush/close timeout is bounded and short enough for local development,
  with an initial maximum of `1000ms`.
- Sentry-disabled shutdown follows the current Fastify/Pino behavior and does
  not import or await Sentry runtime work.
- Existing `SIGINT`/`SIGTERM` behavior and fallback exit protection remain
  intact.

### URL-Driven Dev Diagnostics Boundary

The web development test trigger remains URL-driven, but its URL state must be
part of the typed router contract instead of an incidental query string.

Accepted URL behavior:

- The preferred diagnostics URL is `/?note=index.md&azurite-dev=sentry-test`.
- TanStack Router search parsing explicitly accepts and exposes
  `azurite-dev=sentry-test`.
- Startup note selection, list-click note navigation, and browser-history note
  navigation preserve the `azurite-dev` value when it is present.
- Invalid or absent `azurite-dev` values are ignored without changing selected
  note behavior.
- The diagnostics panel renders only when `import.meta.env.DEV` is true,
  `VITE_SENTRY_TEST_EVENTS_ENABLED=true`, and the parsed dev diagnostics state
  is `sentry-test`.

### Trace And Correlation Contract

Sentry trace propagation alone is not enough for this slice. Azurite must add
stable semantic correlation IDs so desktop, mobile, frontend, backend, and
server route-boundary evidence can be joined even when a trace is missing or
sampled out.

Required correlation fields:

| Attribute                     | Owner                         | Purpose                                                              |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `app.surface`                 | web/server init               | Distinguish browser and API events.                                  |
| `sentry.environment`          | Sentry SDK                    | Group local, Tailscale, and future builds.                           |
| `sentry.release`              | Sentry SDK                    | Join frontend and backend events by build.                           |
| `azurite.request_id`          | web API client/server hook    | Join frontend fetches to backend requests.                           |
| `azurite.note_operation_id`   | web action/backend route      | Join read/save/conflict events for one note operation.               |
| `azurite.editor_session_id`   | web store/editor              | Join editor lifecycle, draft, and save events.                       |
| `azurite.ui_request_sequence` | web store                     | Distinguish local stale-response guards from API correlation IDs.    |
| `azurite.cluster_id`          | shared response/store/backend | Scope events to the current cluster identity.                        |
| `azurite.note_id`             | web/backend operation         | Scope events to the current note.                                    |
| `http.method`                 | web/server request helpers    | Identify request behavior without relying on raw logs.               |
| `http.route`                  | web/server request helpers    | Use route patterns, not only concrete URLs.                          |
| `azurite.route_source`        | router/store                  | Distinguish direct URL, list click, history, and fallback selection. |
| `azurite.api_error_code`      | API error handling            | Preserve shared error contract evidence.                             |
| `azurite.result_status`       | observability helpers         | Normalize started, succeeded, failed, stale, conflict, invalid.      |

Implementation requirements:

- The web API client generates or propagates `azurite.request_id` for each API
  call and sends it through an `x-azurite-request-id` header.
- The web note browser actions generate `azurite.note_operation_id` for note
  load and save workflows and pass it through the typed web API boundary.
- The web API client sends note operation IDs through an
  `x-azurite-note-operation-id` header when an operation exists.
- The typed `NoteBrowserApi` boundary must accept optional request metadata for
  correlation IDs instead of relying on hidden globals, module-level mutable
  state, or Sentry-only scope state.
- Shared correlation schemas define accepted ID format and length for request
  IDs and note operation IDs. Web-generated IDs use `crypto.randomUUID()` where
  available and a tested fallback only if needed.
- Backend request hooks accept only a single valid `x-azurite-request-id` header.
  Missing or invalid request IDs cause the server to generate a fresh server
  request ID for telemetry without changing API response bodies.
- Backend request hooks accept only a single valid
  `x-azurite-note-operation-id` header. Missing or invalid operation IDs are
  omitted from request-scoped observability context.
- Invalid, oversized, or duplicated correlation headers are recorded as
  diagnostic metadata, not trusted as canonical correlation IDs.
- Existing frontend numeric request counters remain local
  `azurite.ui_request_sequence` metadata for stale-response protection. They
  must not be used as `azurite.request_id`.
- `azurite.editor_session_id` must reuse the current editor-session identity
  where possible. If the existing `EditorSession.sessionKey` is renamed or
  wrapped, the implementation must avoid creating a parallel editor identity.
- Backend note routes attach request ID, operation ID, cluster ID, note ID,
  method, route pattern, result status, and error code to Sentry events/logs.
- Sentry browser tracing uses trace propagation targets that include the current
  same-origin `/api/*` path and local/Tailscale development API paths used by
  Azurite.
- Tests prove that request IDs and operation IDs are present in fetch headers,
  frontend helper calls, backend request context, and backend observability calls
  without changing API response bodies.
- Tests prove invalid, oversized, duplicated, and absent correlation headers do
  not weaken API behavior or pollute canonical request/operation IDs.

### Replay, Logs, And Tracing Configuration

Session Replay runs for every explicitly enabled local debug session during
this slice. The accepted replay behavior is diagnostic completeness, not privacy
minimization.

Replay requirements:

- note text in the Milkdown editor is visible in replay
- note text in the markdown textarea is visible in replay
- editor DOM, focus, selection-adjacent context, and block-menu state are
  visible enough to investigate the Milkdown block-menu QA finding
- media and icons are not blocked if seeing them helps debug layout or editor
  state
- replay sampling is `1.0` for explicitly enabled local debug sessions unless
  Daniel lowers it through env vars
- the implementation verifies current SDK option names through TypeScript types
  and configures unmasked text/input/media behavior accordingly
- manual Sentry UI verification confirms uploaded desktop and mobile replays
  actually show editor text, textarea text, relevant DOM state, and the
  Milkdown block-menu interaction context

Logs and tracing requirements:

- JavaScript logs are enabled through the installed SDK's log support.
- Semantic Azurite logs use `Sentry.logger` or the current SDK equivalent, not
  `console.log` as the primary event path.
- Browser tracing is enabled with an explicit trace sample rate.
- Backend tracing is enabled with an explicit trace sample rate.
- Trace/log sampling defaults are high for debug sessions, but configurable by
  env var so Sentry stays inspectable during long editing sessions.

Telemetry carrier mapping:

- Logs are the primary carrier for semantic Azurite lifecycle/result events.
  Prefer one wide, structured log per meaningful operation result over many thin
  logs that require manual reconstruction.
- Breadcrumbs are the lightweight chronological trail for route changes, editor
  mode/status changes, Milkdown lifecycle markers, draft attempts, save button
  intent, and recovery visibility. Breadcrumbs must help replay navigation
  without carrying every full payload.
- Spans measure operations with duration: frontend API calls, note load, draft
  read/write/delete, save, backend request handling, and server route-boundary
  work that calls into cluster metadata and filesystem-backed core helpers. Spans
  should attach request ID, operation ID, route, method, note ID, cluster ID,
  result status, and duration where available. This slice does not create direct
  spans inside `packages/core`.
- Tags carry low-cardinality filter dimensions such as `app.surface`,
  environment, release, route pattern, result status, editor mode, recovery
  kind, and test-event status.
- Context and structured attributes carry high-cardinality or rich diagnostic
  fields such as note ID, cluster ID, request ID, operation ID, content hashes,
  local filesystem paths, selected route values, markdown lengths, draft
  timestamps, and bounded payload summaries.
- Errors and captured exceptions are reserved for real failures, deliberate
  development test events, and error-boundary captures. Do not turn normal
  successful lifecycle events into fake exceptions just to make them visible.
- Sentry scopes may attach current request/editor context during one operation,
  but scopes must be cleared or isolated so note IDs, markdown, and operation
  IDs do not leak into unrelated events.

Payload carrier mapping:

- Structured logs are the searchable primary event record and carry payload
  metadata: payload kind, byte length, markdown length, content hash, truncation
  status, and the correlation IDs needed to find the related replay/trace/event.
- Breadcrumbs never carry full markdown or draft payloads.
- Full markdown and draft text can be sent only on eligible bounded debug events.
  The chosen carrier is a Sentry captured event context named
  `azurite.debug_payload` on a paired `captureMessage` or `captureException`
  event for that eligible debug event.
- Payload-bearing captured events must use the same event names, request IDs,
  operation IDs, note IDs, cluster IDs, release, environment, and result status
  as their structured log pair.
- Captured messages used for payload-bearing debug events are not fake failures.
  They are explicit debug payload carriers for allowed state transitions,
  deliberate test events, and real failure/conflict/recovery evidence.

### Telemetry Volume Contract

Uncensored does not mean noisy enough to become useless. The slice must define
when full payloads are sent.

Volume requirements:

- Lifecycle events such as `editor.milkdown.markdown_updated` record note ID,
  editor session ID, markdown length, dirty status, revision, and hashes by
  default.
- Full markdown snapshots can be attached only to bounded events where the
  payload explains the failure or state transition: note load success/failure,
  draft recovery visibility, save start, save conflict, save failure, and
  deliberate test events. Eligible does not mean mandatory for every event; the
  helper decides from event type, configured limit, and available payload.
- Full payload capture is bounded for event-size and usefulness reasons, not
  privacy minimization. The implementation must define shared debug payload
  limits with an initial default of 128 KiB per text payload. Payloads at or
  below the limit are sent whole in the `azurite.debug_payload` event context
  for eligible payload-bearing captured events. Larger payloads are represented
  with explicit `azurite.payload_truncated_for_size = true`, original byte
  length, content hash, and diagnostically useful leading/trailing text windows.
- Draft payloads are attached for draft read/write/delete failures and recovery
  states, not for every debounced successful write.
- Zustand snapshots are attached for explicit error, conflict, stale-response,
  recovery, or deliberate test events.
- Repeated high-frequency editor updates are rate-limited, coalesced, or logged
  with metadata-only attributes.
- `editor.milkdown.markdown_updated` emits at most one metadata-only log per
  editor session per second during continuous typing, plus explicit result
  events for save, conflict, recovery, mode changes, and deliberate test events.
- Observability helpers must never await Sentry network work inside Milkdown,
  Zustand, Dexie, or save-state mutation paths.
- Local buffers, timers, or coalescers must be cleared when the editor session
  changes so stale note content cannot be emitted under a new note ID.
- Normal editing must remain responsive during Sentry-enabled debug sessions.
- Manual QA must include editing a real large note for several minutes with
  Sentry enabled and confirming that the editor remains responsive, Sentry
  remains queryable, and Sentry does not drop the important load/save/conflict
  evidence because the session became too noisy.

### Instrumentation Boundary

Direct Sentry calls must stay behind small observability modules instead of
being scattered through feature code.

Required modules:

- web Sentry initialization
- web Azurite observability helpers
- server Sentry initialization
- server Azurite observability helpers
- shared event-name and attribute constants

The shared event vocabulary is mandatory. Put reusable event names and shared
attribute names in `packages/shared` so frontend and backend cannot drift.

Sentry debug mode is intentionally uncensored. Instrumentation may send rich
diagnostic context when Sentry is explicitly enabled, but it must not own
product decisions, editor state, draft state, route state, save behavior, or
cluster state.

### Core And Filesystem Boundary

`packages/core` remains Sentry-free in this slice.

The current user story needs backend-route evidence for filesystem-backed note
behavior, not a new core observer abstraction. Server routes should capture
useful evidence from core calls and caught core errors:

- request ID
- note operation ID when available
- note ID
- cluster ID when available
- route pattern and HTTP method
- duration
- result status
- shared API error code
- content hashes
- caught core error name, code, message, stack, and local filesystem path context
  where available

Do not add a core observer, hook, dependency injection surface, or Sentry import
to `packages/core` in this slice. Direct core-level observability is deferred
until a future slice introduces a second core runtime, background worker,
indexing service, or repeated need to inspect behavior below the server route
boundary.

### File-Line And Refactor Boundary

Several implementation targets are already near the 400-line hard limit. This
slice must split files before adding instrumentation where needed.

Known pressure points:

- `apps/server/src/notes-route.ts`
- `apps/web/src/state/note-browser-route-actions.ts`
- `apps/web/src/state/note-browser-editor-actions.ts`
- `apps/web/src/components/MilkdownEditor.tsx`

The implementation should extract focused helpers for route handlers,
observability emission, editor instrumentation, and store action instrumentation
instead of appending logs to already-large modules.

## Semantic Event Contract

### Shared Event Naming Rules

- Event names use lower-case dot-separated product vocabulary.
- Event names describe product behavior, not Sentry mechanics.
- Every started event has a matching succeeded, failed, stale, conflict,
  invalid, or visible result when that lifecycle exists.
- Event attributes use shared constants for common fields.
- Events carry full markdown only when the telemetry volume contract allows it.

### Frontend Events

| Event                                  | Required attributes                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| `route.note.changed`                   | `azurite.note_id`, `azurite.route_source`                        |
| `route.note.invalid`                   | `azurite.route_source`, invalid route value                      |
| `note.load.started`                    | `azurite.note_id`, `azurite.note_operation_id`                   |
| `note.load.succeeded`                  | note ID, operation ID, cluster ID, content hash, markdown length |
| `note.load.failed`                     | note ID, operation ID, API error code, request ID                |
| `note.load.stale_ignored`              | note ID, operation ID, stale request ID                          |
| `editor.milkdown.mounted`              | note ID, editor session ID, editor mode                          |
| `editor.milkdown.destroyed`            | note ID, editor session ID, destroy reason                       |
| `editor.milkdown.focus.changed`        | note ID, editor session ID, focus state                          |
| `editor.milkdown.selection.changed`    | note ID, editor session ID, selection summary                    |
| `editor.milkdown.transaction.observed` | note ID, editor session ID, transaction summary                  |
| `editor.milkdown.markdown_updated`     | note ID, editor session ID, revision, markdown length            |
| `editor.crepe.block_menu.opened`       | note ID, editor session ID, block-menu context when available    |
| `editor.crepe.block_menu.closed`       | note ID, editor session ID, close reason when available          |
| `editor.mode.changed`                  | note ID, editor session ID, previous mode, next mode             |
| `editor.status.changed`                | note ID, editor session ID, previous status, next status         |
| `draft.read.started`                   | note ID, cluster ID, editor session ID                           |
| `draft.read.succeeded`                 | note ID, cluster ID, draft presence, updated time when present   |
| `draft.read.failed`                    | note ID, cluster ID, persistence unavailable reason              |
| `draft.write.started`                  | note ID, cluster ID, editor session ID, dirty status             |
| `draft.write.succeeded`                | note ID, cluster ID, dirty status                                |
| `draft.write.failed`                   | note ID, cluster ID, persistence unavailable reason              |
| `draft.delete.started`                 | note ID, cluster ID                                              |
| `draft.delete.succeeded`               | note ID, cluster ID                                              |
| `save.started`                         | note ID, operation ID, editor session ID, expected content hash  |
| `save.succeeded`                       | note ID, operation ID, new content hash                          |
| `save.conflicted`                      | note ID, operation ID, expected content hash, API error code     |
| `save.failed`                          | note ID, operation ID, API error code or request failure reason  |
| `recovery.draft.visible`               | note ID, cluster ID, draft updated time                          |
| `recovery.degraded.visible`            | note ID when known, persistence unavailable reason               |
| `telemetry.web.test.triggered`         | request ID, release, environment, surface, test marker           |

### Backend Events

| Event                             | Required attributes                                                        |
| --------------------------------- | -------------------------------------------------------------------------- |
| `workspace.notes.list.started`    | request ID, route, method                                                  |
| `workspace.notes.list.succeeded`  | request ID, cluster ID, note count, duration                               |
| `workspace.notes.list.failed`     | request ID, API error code, duration, caught core error context            |
| `note.read.started`               | request ID, operation ID when present, note ID, route, method              |
| `note.read.succeeded`             | request ID, operation ID when present, note ID, cluster ID, content hash   |
| `note.read.not_found`             | request ID, operation ID when present, note ID, API error code             |
| `note.read.invalid`               | request ID, operation ID when present, API error code                      |
| `note.read.failed`                | request ID, operation ID when present, note ID when known, API error code  |
| `note.save.started`               | request ID, operation ID when present, note ID, expected content hash      |
| `note.save.succeeded`             | request ID, operation ID when present, note ID, cluster ID, new hash       |
| `note.save.conflicted`            | request ID, operation ID when present, note ID, expected hash, error code  |
| `note.save.invalid`               | request ID, operation ID when present, API error code                      |
| `note.save.failed`                | request ID, operation ID when present, note ID when known, API error code  |
| `cluster.metadata.read.succeeded` | request ID, operation ID when present, cluster ID                          |
| `cluster.metadata.created`        | request ID, operation ID when present, cluster ID                          |
| `cluster.metadata.failed`         | request ID, operation ID when present, filesystem path, error details      |
| `security.note_id.rejected`       | request ID, operation ID when present, rejected note ID, API error code    |
| `filesystem.boundary.rejected`    | request ID, operation ID when present, rejected path, API error code       |
| `telemetry.server.test.triggered` | request ID, release, environment, surface, test marker, payload test state |

## Implementation Plan

### 1. Create The Backend Sentry Project

Create `azurite-server` in the existing `Daniel Mulec` Sentry workspace.

Project setup requirements:

- Use Sentry's official Fastify setup path.
- Keep the new Sentry setup page available long enough to copy the backend DSN
  into Daniel's local environment.
- Do not commit the backend DSN.

### 2. Add Dependencies

Add Sentry packages to the owning workspaces:

- `@sentry/react` in `apps/web`
- `@sentry/node` in `apps/server`

Do not add `@sentry/vite-plugin` in this slice. Source-map upload belongs to a
future release-observability slice that can safely introduce Sentry auth token
handling.

### 3. Add Environment Documentation And Config Parsing

Add committed environment examples and typed config parsing without secrets.

The docs must show:

- that the preferred local workflow is one root `.env.local`
- that `.env.local` is untracked and real DSNs/auth tokens stay out of Git
- that `.env.example` is committed with placeholder values
- how Vite loads root `.env.local` through `envDir`
- how the server loads root `.env.local` before Sentry initialization
- how future non-local deployments can inject the same variables through their
  environment or secret system without using `.env.local`
- how to enable/disable Sentry locally
- which variables are required for web telemetry
- which variables are required for server telemetry
- how to set replay and trace sample rates for debug sessions
- how to enable deliberate test events
- that Azurite remains runnable without Sentry

Implementation requirements:

- create or update root `.gitignore` rules so `.env.local` remains untracked
- create root `.env.example`
- create web and server Sentry config modules with typed parsing and tests
- use literal `true` as the only enabled value for Sentry and test events
- default Sentry to disabled whenever DSN or enabled flag is missing

### 4. Add Shared Observability Constants

Create shared event-name, attribute, route, and correlation constants in
`packages/shared`.

Requirements:

- frontend and backend import event names from the same source
- attribute names for correlation IDs, note IDs, cluster IDs, route patterns,
  result statuses, hashes, and API error codes are shared
- `POST /__azurite/dev/sentry-test-event` is added to shared route constants and
  reference docs as a development-only route registered only when the server
  test-event env gate is enabled
- request ID and note operation ID validation schemas are shared
- exported constants include beginner-readable TSDoc
- tests prove event names do not drift from the documented contract

### 5. Initialize Web Sentry

Initialize Sentry before the React app renders.

Web requirements:

- initialize only from the parsed web Sentry config when
  `VITE_SENTRY_ENABLED=true` and `VITE_SENTRY_DSN` is present
- tag events with `app.surface = web`
- set `environment` and `release` from env/config
- enable React/browser error capture
- enable JavaScript logs through the installed SDK's log support
- enable Session Replay for every explicitly enabled debug session
- configure Replay so real editor text, textarea text, relevant DOM, and media
  are visible for debugging
- enable browser tracing with env-configurable sampling
- configure trace propagation targets for same-origin `/api/*`, localhost, and
  Tailscale/MagicDNS Azurite API paths used during development
- keep raw env reads inside `apps/web/src/config/sentry-config.ts` and Sentry
  initialization code
- add a React error boundary around the app shell or editor surface without
  changing normal UI behavior
- keep Sentry-disabled rendering behavior unchanged

### 6. Initialize Server Sentry

Initialize Sentry before Fastify is imported by using Sentry's official ESM
`--import` preload path.

Server requirements:

- load the root `.env.local` before instrumentation in local development
- initialize only from the parsed server Sentry config when
  `SENTRY_ENABLED=true` and `SENTRY_DSN` is present
- tag events with `app.surface = server`
- set `environment` and `release` from env/config
- use Sentry's Fastify integration
- enable backend structured logs where supported by the installed SDK
- keep raw env reads inside server option/config modules and Sentry
  initialization code
- keep existing Fastify/Pino logging intact
- capture unhandled backend errors
- capture route/request errors without weakening existing error responses
- update the real server `dev` and `start` scripts so the `tsx` startup path uses
  the Sentry preload before `src/index.ts`
- document the `.mjs` preload file as the required external-tooling exception to
  the repository's TypeScript-script preference
- add bounded Sentry flush/close behavior during graceful shutdown, with an
  initial timeout no longer than `1000ms`
- keep graceful shutdown behavior intact when Sentry is disabled
- verify that Sentry-disabled startup still works without a DSN
- verify that the Sentry-enabled real `tsx` startup path initializes Sentry before
  Fastify is imported

### 7. Add Request And Operation Correlation

Implement the Azurite correlation contract.

Requirements:

- web API requests include `x-azurite-request-id`
- web note load/save API requests include `x-azurite-note-operation-id`
- the `NoteBrowserApi` TypeScript boundary accepts optional correlation
  metadata for operations that need transport headers
- backend request hooks validate, read, or create `azurite.request_id`
- backend request hooks validate `x-azurite-note-operation-id` and attach
  `azurite.note_operation_id` to request-scoped observability context only when
  the header is valid
- invalid, oversized, duplicated, and absent correlation headers never change API
  response body shapes
- note load and save workflows create `azurite.note_operation_id`
- editor lifecycle uses `azurite.editor_session_id` by reusing or deliberately
  renaming the existing editor session identity instead of adding a duplicate
  identity shape
- local frontend stale-response counters remain
  `azurite.ui_request_sequence` metadata and are never used as
  `azurite.request_id`
- frontend and backend observability helpers attach shared release/environment,
  request ID, operation ID, note ID, cluster ID, route, method, result status,
  and API error code where applicable
- tests prove fetch headers, backend request context, observability calls, and
  API response body shapes all satisfy the contract

### 8. Add Frontend Semantic Observability

Add rich breadcrumbs/logs for the current editor workflow through focused helper
modules and store/action integration points.

Requirements:

- instrument route selection, invalid route handling, note loading,
  stale-response ignores, Milkdown mount/update/destroy/focus/selection,
  observable ProseMirror transaction summaries, Crepe block-menu open/close
  behavior when available, editor mode/status changes, draft read/write/delete,
  save success/failure/conflict, and recovery states
- map frontend semantic events to Sentry logs, breadcrumbs, spans, tags,
  contexts, and errors according to the telemetry carrier contract
- include full markdown, draft payloads, and Zustand snapshots only where the
  telemetry volume contract allows them
- keep high-frequency markdown update events metadata-only or coalesced
- avoid awaiting Sentry network work inside editor callbacks, store mutations,
  Dexie callbacks, or save state transitions
- do not let observability helpers mutate editor, draft, route, save, or
  cluster state

### 9. Add Backend Semantic Observability

Add rich breadcrumbs/logs for note and cluster operations through focused helper
modules and route integration points.

Requirements:

- instrument note list/read/save started, succeeded, invalid, not-found,
  conflicted, and failed states
- instrument cluster metadata read/create/failure behavior as observed from the
  server route boundary
- instrument note ID rejection and filesystem boundary rejection as route-level
  outcomes from existing core behavior
- map backend semantic events to Sentry logs, breadcrumbs, spans, tags,
  contexts, and errors according to the telemetry carrier contract
- include local filesystem paths, stack traces, request/response context, and
  full markdown only where useful for debugging and allowed by the telemetry
  volume contract
- capture useful route-level evidence from core outcomes/errors: request ID,
  operation ID, note ID, cluster ID when available, route/method, duration,
  result status, API error code, content hashes, and caught core error context
- keep `packages/core` Sentry-free; do not add core observer hooks, Sentry
  imports, or a new core telemetry contract in this slice
- avoid replacing or weakening existing Fastify/Pino logs; Sentry logs are an
  additional structured observability path
- preserve existing Fastify error response shapes and shared API error codes

### 10. Add Deliberate Test Events

Add development-only ways to prove telemetry works without throwing accidental
real product errors.

Requirements:

- web test events are available only when `import.meta.env.DEV` is true and
  `VITE_SENTRY_TEST_EVENTS_ENABLED=true`
- the web trigger is not part of the normal note workflow. Use an explicit
  URL-driven development diagnostics panel at
  `/?note=index.md&azurite-dev=sentry-test` that is hidden unless dev mode,
  test events, and the parsed `azurite-dev=sentry-test` state are all active.
  It requires an intentional click or command to send the event.
- `azurite-dev=sentry-test` is an explicitly parsed TanStack Router search param
  and startup note selection, note-list navigation, and browser-history note
  navigation preserve it when present
- server test events are available only when `NODE_ENV` is not `production` and
  `SENTRY_TEST_EVENTS_ENABLED=true`
- the server trigger is the development-only route
  `POST /__azurite/dev/sentry-test-event`, registered only when test events are
  enabled
- the server test-event route is defined in shared route constants and marked
  development-only in reference docs
- server test-event requests must require an explicit confirmation header such
  as `x-azurite-dev-test-event: sentry`
- test events are impossible to trigger accidentally in normal user workflows
- test events do not write notes, read or create cluster metadata, mutate draft
  state, or change route state
- test events include request ID, release, environment, surface, and a clearly
  marked `azurite.test_event = true` attribute
- test events exercise the same logs/breadcrumbs/spans/tags/context/error
  carrier mapping used by real observability events without pretending that a
  successful product workflow failed
- deliberate web and server test events include under-limit and over-limit
  payload cases proving the selected `azurite.debug_payload` carrier, whole-text
  capture, and truncation metadata behavior

### 11. Refactor Before Instrumenting Near-Limit Files

Split files before adding observability to modules that are already close to
the 400-line hard limit.

Requirements:

- keep every code file at 400 lines or fewer
- extract backend note route observability or handlers before expanding
  `notes-route.ts`
- extract frontend store/editor observability helpers before expanding route
  actions, editor actions, or `MilkdownEditor.tsx`
- preserve existing tests while adding focused tests for the extracted helpers

### 12. Verify With Real Runtime

Run automated validation and then verify through Sentry UI.

Required QA:

- Azurite starts without `.env.local` and behaves like the current Sentry-disabled
  app.
- Azurite starts with root `.env.local` and both parsed Sentry configs report
  enabled only when the enabled flag is `true` and the DSN is present.
- local desktop browser sends a web test event to `azurite-web`
- local backend sends a server test event to `azurite-server`
- loading a real note creates frontend and backend observability evidence with
  the same request ID and note operation ID
- saving a disposable note creates frontend and backend save evidence with the
  same request ID and note operation ID
- a forced or real conflict creates frontend and backend conflict evidence
- mobile/Tailscale browser session appears as a distinct web session
- the Milkdown block-menu reproduction attempt creates replay and editor
  breadcrumbs useful enough to guide the follow-up fix slice
- a several-minute edit session in a large real note stays responsive and keeps
  Sentry evidence queryable instead of flooding the investigation surface

## Negative Side-Effect Guardrails

This slice must preserve existing product behavior while adding observability.

Existing workflows that must keep working:

- note list loading
- selected-note URL navigation and browser history
- note read through the current shared API contracts
- Milkdown editor mount and mode switching
- manual save through the content-hash conflict contract
- Dexie draft persistence and recovery
- missing-note and degraded recovery states
- desktop local development
- mobile/Tailscale development with the backend local-only behind the Vite proxy

Persistence and recovery guarantees that must not regress:

- markdown files remain the canonical content source
- Sentry must not persist product state
- draft state remains browser-local and scoped by cluster ID and note ID
- save still requires the expected content hash
- conflict responses still prevent overwriting changed disk content
- failed draft persistence still produces visible degraded recovery state

Validation, security, and filesystem boundaries that must not weaken:

- note ID validation remains shared and enforced
- path traversal remains rejected
- filesystem boundary protections remain in core/server behavior
- `packages/core` remains free of Sentry imports, observer contracts, and
  telemetry-specific state
- existing API error codes and response body shapes remain stable unless tests
  and reference docs explicitly cover a deliberate change
- Sentry credentials, auth tokens, DSNs, and unrelated local credentials stay
  out of Git
- root `.env.local` stays untracked and root `.env.example` contains placeholders
  only
- Sentry debug payloads may include real note/debug content only when Sentry is
  explicitly enabled by local debug configuration
- payload-bearing debug events use the configured `azurite.debug_payload`
  carrier and bounded payload helper instead of ad hoc event context shapes

URL, state, cache, and storage behavior that must stay coherent:

- URL-owned selected-note state remains the route source of truth
- browser history behavior does not change
- `azurite-dev=sentry-test` remains a typed dev diagnostics search param and is
  preserved during startup note selection, note-list navigation, and
  browser-history navigation
- Zustand remains the note browser state owner
- Dexie remains the draft persistence owner
- Sentry does not become a cache, source of truth, or recovery mechanism
- request IDs and operation IDs are diagnostic metadata only
- development test telemetry triggers do not mutate notes, drafts, route state,
  cluster metadata, or filesystem content
- the backend development test route is registered only when the explicit
  test-event env gate is enabled

Degraded, error, and recovery states that must remain visible:

- API unreachable
- invalid workspace
- invalid note ID
- note not found
- stale note load ignored
- save conflict
- save failed
- draft database unavailable
- draft validation failed
- Milkdown creation failure

QA flows that must still pass:

- existing route, draft, save, conflict, and recovery tests
- Sentry-disabled app startup and note workflow
- Sentry-enabled app startup and note workflow
- desktop browser smoke test
- mobile/Tailscale smoke test
- `/opt/homebrew/bin/pnpm validate`

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
```

Run targeted automated tests for:

- root `.env.local` loading path and missing-file behavior
- web Sentry config parsing from `import.meta.env`
- server Sentry config parsing from `process.env`
- Sentry-disabled web initialization
- Sentry-enabled web initialization with mocked SDK calls
- web Replay config preserving unmasked editor/debug content behavior
- web trace propagation targets including `/api/*`
- web API request IDs and note operation IDs in headers without API response body
  changes
- local UI stale-response sequence IDs remaining separate from API request IDs
- Sentry-disabled server initialization
- Sentry-enabled real `tsx` server startup using the ESM `--import` preload
  before Fastify import
- server graceful shutdown flushes/closes Sentry with a bounded timeout when
  enabled and preserves existing disabled-mode shutdown behavior
- server request ID and note operation ID creation/propagation
- invalid, oversized, duplicated, and absent correlation headers
- Sentry-enabled server route instrumentation with mocked SDK calls
- web and server telemetry carrier mapping for logs, breadcrumbs, spans, tags,
  context, and errors
- development test-event triggers being unavailable when env flags are missing
  and available only in development when explicitly enabled
- router parsing and preserving `azurite-dev=sentry-test` during startup note
  selection, note-list navigation, and browser-history navigation
- shared route constants and reference docs for the development-only backend test
  event route
- frontend observability helpers preserving rich diagnostic payloads
- frontend payload helpers attaching under-limit markdown to
  `azurite.debug_payload` on eligible debug events
- frontend payload helpers replacing over-limit markdown with
  `azurite.payload_truncated_for_size`, original length, content hash, and
  leading/trailing text windows
- frontend observability helpers coalescing or summarizing high-frequency
  editor updates
- frontend observability helpers clearing coalesced editor buffers when the
  editor session changes
- backend observability helpers preserving rich diagnostic payloads
- backend payload helpers proving the same under-limit and over-limit payload
  carrier behavior through deliberate test events
- backend route-level observability capturing core outcomes/errors without adding
  Sentry imports or observer hooks to `packages/core`
- shared observability event and attribute constants
- existing route, draft, save, conflict, and recovery tests

Run manual/browser QA:

- Start Azurite locally without `.env.local` and confirm Sentry-disabled startup
  and note workflows behave like the current app.
- Create or update root `.env.local` with web and server Sentry env vars, then
  start Azurite locally.
- Open the Tailscale MagicDNS URL on desktop Chrome.
- Open `/?note=index.md&azurite-dev=sentry-test`, confirm the dev diagnostics
  panel appears only when the web test-event env gate is enabled, then navigate
  between notes and confirm the `azurite-dev` search param is preserved.
- Trigger the explicit web development test event and confirm it reaches
  `azurite-web` with `azurite.test_event = true`.
- Trigger the explicit server development test event with the confirmation
  header and confirm it reaches `azurite-server` with
  `azurite.test_event = true`.
- Confirm deliberate under-limit payload test content appears in Sentry under
  `azurite.debug_payload`.
- Confirm deliberate over-limit payload test content is represented with
  `azurite.payload_truncated_for_size`, original length, content hash, and useful
  leading/trailing text windows.
- Load the note from the Milkdown block-menu bug report.
- Confirm Sentry captures the browser session, console warnings/logs, API
  request path, request ID, note operation ID, note-load breadcrumbs, and
  backend note-read evidence.
- Confirm the same request ID appears in frontend and backend evidence for a
  note read.
- Confirm the same note operation ID appears in frontend load/save events,
  fetch headers, backend request context, and backend route evidence.
- Save a disposable note and confirm the same request ID and note operation ID
  appear in frontend and backend save evidence.
- Force a save conflict and confirm conflict evidence includes expected content
  hash and shared API error code.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Confirm replay in the Sentry UI shows enough unmasked editor text, textarea
  text, DOM, focus context, block-menu context, and event breadcrumbs to decide
  the next fix slice.
- Edit a large real note for several minutes and confirm normal editing remains
  responsive, high-frequency markdown updates are coalesced/rate-limited, and
  Sentry remains inspectable.
- Open the same MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.
- Confirm mobile replay includes unmasked note/editor context when Sentry debug
  mode is explicitly enabled.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.
- Stop the backend with Sentry enabled and confirm shutdown stays bounded while
  pending backend telemetry is flushed or closed.

## Acceptance Criteria

- `azurite-web` receives real telemetry from desktop Azurite.
- `azurite-web` receives real telemetry from mobile/Tailscale Azurite.
- `azurite-server` receives real telemetry from the local Fastify API.
- root `.env.example` documents the local Sentry workflow and root `.env.local`
  remains untracked.
- web and server Sentry config parsing is centralized behind typed config
  modules and Sentry stays disabled unless enabled flags and DSNs are present.
- Server Sentry initialization uses the official ESM `--import` preload under the
  real `tsx` dev/start path and initializes before Fastify imports.
- The `.mjs` preload file is documented as the required external-tooling
  exception to the repository's TypeScript-script preference.
- Sentry-enabled graceful backend shutdown flushes/closes queued Sentry telemetry
  with a bounded timeout, while Sentry-disabled shutdown behavior remains
  unchanged.
- Frontend and backend events include shared release/environment metadata.
- Frontend API calls and backend requests are trace-correlatable through Sentry
  where supported.
- Frontend API calls and backend requests are semantically correlatable through
  `azurite.request_id` even when Sentry trace propagation is incomplete.
- Note load and save workflows are correlatable through
  `azurite.note_operation_id`.
- Request IDs, note operation IDs, editor session IDs, and local UI request
  sequences remain distinct and are transported or scoped only where intended.
- Correlation headers are validated; invalid, oversized, duplicated, and absent
  headers do not change API response bodies or pollute canonical IDs.
- Development test telemetry triggers are dev-only, env-gated, impossible to
  reach through normal note workflows, and do not mutate notes, drafts, routes,
  or cluster metadata.
- `azurite-dev=sentry-test` is a typed router search param, uses the preferred
  URL `/?note=index.md&azurite-dev=sentry-test`, and is preserved during startup
  note selection, note-list navigation, and browser-history navigation.
- `POST /__azurite/dev/sentry-test-event` is defined in shared route constants,
  documented as development-only, and registered only when the server test-event
  env gate is enabled.
- The Milkdown block-menu bug report can be investigated with Sentry evidence
  instead of only terminal logs.
- Session Replay captures unmasked editor/debug context in explicitly enabled
  local debug sessions.
- Telemetry is mapped intentionally into logs, breadcrumbs, spans, tags, context,
  and errors.
- Eligible payload-bearing debug events use `azurite.debug_payload` as the
  payload carrier; under-limit markdown appears whole in Sentry, while over-limit
  markdown sends truncation metadata, original length, content hash, and useful
  leading/trailing text windows.
- Deliberate web and server test events prove the payload carrier, whole-payload
  path, and truncated-payload path.
- Bounded full-payload capture, rate-limited editor updates, and cleared
  coalescing buffers keep normal editing responsive and Sentry inspectable.
- Backend observability captures route-level evidence from core outcomes/errors,
  and `packages/core` remains Sentry-free with no new observer contract.
- Sentry-disabled Azurite behaves the same as before this slice.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Resolved Review Decisions

- This observability foundation is the next real slice. Slice numbering now
  moves create-new-notes later in the roadmap deliberately.
- Use one root untracked `.env.local` as the preferred local Sentry value
  source, with one committed root `.env.example`.
- Centralize Sentry config parsing behind web/server config modules so future
  deployments can inject the same variables through platform-managed
  environment variables or secrets without changing feature code.
- Use Sentry's Fastify setup path for the backend project. Use generic Node.js
  only as a documented fallback if Fastify setup is unavailable or blocked.
- Use Sentry's official ESM `--import` preload for Fastify/server startup. The
  required `.mjs` preload file is a justified external-tooling exception, and
  the dynamic-import-first framing is removed.
- Do not include source-map upload infrastructure in the first implementation.
  Use release naming plus local source maps now.
- Session Replay should run for every explicitly enabled local debug session,
  with env-configurable sampling and unmasked debug capture.
- Deliberate test telemetry triggers are required, but they must be
  development-only, env-gated, explicit, and non-mutating.
- The web test trigger stays URL-driven through the typed and preserved
  `azurite-dev=sentry-test` search param, with preferred URL
  `/?note=index.md&azurite-dev=sentry-test`.
- The backend test trigger is the shared, development-only
  `POST /__azurite/dev/sentry-test-event` route.
- `packages/core` remains Sentry-free in this slice. Route-level backend
  evidence is enough until a future runtime/worker/indexing need justifies direct
  core observability hooks.
- Backend shutdown gets bounded Sentry flushing/closing without changing
  Sentry-disabled shutdown behavior.
- Sentry debug mode remains uncensored, while full-payload capture and
  high-frequency editor telemetry must be bounded and mapped intentionally into
  logs, breadcrumbs, spans, tags, context, and errors.
- Full markdown can be sent only for eligible bounded debug events through the
  chosen `azurite.debug_payload` carrier. Test events must prove both
  under-limit full capture and over-limit truncation metadata.
