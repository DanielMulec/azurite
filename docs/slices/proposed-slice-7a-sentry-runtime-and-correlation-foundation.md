# Proposed Slice 7A: Sentry Runtime And Correlation Foundation

## Status

Proposed.

This slice is split from the master observability plan in
`docs/slices/proposed-end-to-end-sentry-observability-foundation.md`. The master
document remains the complete product architecture for Sentry observability.
Slice 7A implements the runtime, configuration, and correlation foundation that
Slice 7B builds on.

## Product Decision

Azurite adopts Sentry as the development observability backbone in two
reviewable implementation slices.

Slice 7A settles the runtime platform decision:

- `azurite-web` receives browser/runtime telemetry from the React app.
- `azurite-server` receives backend/runtime telemetry from the Fastify API.
- Web and server Sentry configuration is typed, local-debug gated, and safe when
  missing.
- Sentry-disabled startup avoids importing or initializing Sentry SDK and Replay
  runtime code; the current web and server entrypoints must gate those imports.
- Frontend API calls and backend route outcomes are joined by stable Azurite
  request IDs and note operation IDs.
- Session Replay, structured logs, and frontend-to-backend tracing are proven as
  runtime capabilities before Slice 7B depends on them for semantic editor
  diagnostics.
- The current note read/save/conflict workflow has real correlated evidence in
  Sentry before deeper editor and persistence instrumentation is added.

This slice deliberately does not hand-roll a custom logging or replay platform.
Sentry owns event capture, logs, tracing, replay, grouping, and investigation UI.
Azurite owns a thin runtime and correlation vocabulary that can support later
semantic diagnostics without scattering SDK calls through product code.

## User Story

When Daniel tests Azurite locally on desktop Chrome or from a phone over the
Tailscale MagicDNS URL, he can prove that Sentry is working and can follow a note
read, save, or conflict from the browser API call to the Fastify route outcome
using the same request ID and note operation ID.

When Sentry is not explicitly enabled, Azurite behaves like the current app:
note list loading, URL navigation, note reading, manual save, conflict handling,
draft recovery, and local/Tailscale development continue without requiring a
DSN.

## Why This Matters

The full Sentry observability plan is intentionally broad because Azurite's most
important current failures can span browser replay, React state, Milkdown,
Dexie, API requests, Fastify routes, and filesystem-backed note behavior.

Implementing all of that in one diff would combine SDK setup, environment
loading, server startup ordering, request contracts, route instrumentation,
editor internals, persistence diagnostics, payload bounds, coalescing, and
manual Sentry UI QA. That is where review slop hides.

Slice 7A creates the foundation that must be correct before the richer semantic
diagnostics can be trusted. After this slice, a Sentry-enabled Azurite session
has real web/server telemetry, dev-only test triggers, and note read/save
correlation. Slice 7B then adds the deeper editor, draft, replay, and payload
diagnostics on top of a proven runtime.

## Future Workflow Boundary

### Current Workflow

This slice covers the current local runtime and note request workflow:

1. Daniel starts the local Fastify API and Vite web app.
2. The web app may be opened on desktop Chrome or from a phone over the
   Tailscale MagicDNS URL while the backend stays local-only behind the Vite
   proxy.
3. Sentry remains disabled when the required enabled flag or DSN is missing.
4. When Sentry is explicitly enabled, the browser and API runtimes initialize
   before their app work begins.
5. The app lists notes from the configured filesystem cluster.
6. URL-owned route state selects a note.
7. The frontend reads that note through `/api/notes/content`.
8. Manual save writes markdown through the existing content-hash conflict
   contract.
9. The web API client sends an Azurite request ID on each API call and a note
   operation ID for note load/save workflows.
10. The backend validates or creates request-scoped correlation context without
    changing API response bodies.
11. Sentry shows web telemetry, backend route-boundary telemetry, and Azurite
    runtime events for the same note read/save/conflict operation.
12. Development-only test triggers prove web and server telemetry without
    mutating notes, drafts, route state, cluster metadata, or filesystem
    content.

The user story is complete only when a real desktop session, a real
mobile/Tailscale web session, and a local backend session can be seen in Sentry,
and a note read plus save/conflict can be joined across frontend and backend
evidence by `azurite.request_id` and `azurite.note_operation_id`.

### Future Workflows This Foundation Must Support

The runtime and correlation contract must be durable enough for:

- Slice 7B semantic editor and persistence diagnostics.
- create new markdown notes.
- recoverable delete or move-to-trash behavior.
- autosave policy and conflict resolution.
- file watching and external-edit detection.
- derived indexing, search, backlinks, and graph behavior.
- multi-cluster selection and cluster identity changes.
- PWA installability, service worker behavior, offline/degraded states, and
  mobile tab discard recovery.
- authentication and local/Tailscale hosting hardening.
- production-like release builds with source-map upload.

These future workflows should reuse the same surface, release, environment,
request ID, note operation ID, route, cluster, note, result, and API error
attributes instead of creating parallel telemetry shapes.

### Product Layers Participating Now

Slice 7A touches these current layers:

- repository docs and environment examples
- root `.env.example` and `.gitignore`
- `apps/web` Sentry config and initialization
- React app shell and error boundary
- TanStack Router search state for the dev diagnostics trigger
- web API client request headers
- note browser load/save actions only as needed to create and pass operation IDs
- Vite dev server root env loading and Tailscale/MagicDNS access path
- `packages/shared` route, observability, and correlation constants
- `apps/server` Sentry config, preload, startup scripts, lifecycle, request
  hooks, and Pino-preserving runtime behavior
- Fastify note list/read/save route-boundary evidence
- existing `packages/core` filesystem note behavior as surfaced by server route
  outcomes and caught errors
- Vitest unit/integration tests
- manual desktop, mobile, and Sentry UI verification

### Product Layers Predictably Needed Soon

Slice 7A leaves explicit seams for:

- Slice 7B editor, draft, payload, and replay diagnostics.
- note lifecycle operation IDs that span create, save, delete, and future
  recovery flows.
- file-watch and external-change events.
- derived index/search worker or backend service instrumentation.
- PWA/service-worker telemetry once that runtime exists.
- release/source-map upload for production-like builds.
- future auth and local-hosting decision telemetry.

### Deliberately Excluded Layers

These layers are excluded from Slice 7A:

- Milkdown/Crepe focus, selection, transaction, and block-menu instrumentation.
- Dexie draft read/write/delete semantic telemetry.
- Zustand state snapshots.
- full markdown and draft payload carrier machinery.
- under-limit and over-limit `azurite.debug_payload` proof.
- editor-update coalescing and rate limiting.
- several-minute large-note responsiveness QA with rich editor telemetry.
- fixing the Milkdown block-menu bug itself.
- mobile-native and desktop-native apps.
- service workers, sync workers, indexing workers, and background jobs that do
  not exist yet.
- public production telemetry policy.
- custom in-app log viewer.
- Sentry self-hosting or billing work.
- source-map upload automation that requires Sentry auth tokens.
- direct `packages/core` observability hooks, observer interfaces, or Sentry
  imports.

The exclusions are stable because Slice 7A delivers a complete runtime and
correlation foundation: Sentry-enabled sessions exist, note read/save/conflict
operations are correlated across browser and API, and Sentry-disabled behavior is
proved unchanged. Slice 7B can then focus on semantic editor and persistence
diagnostics without also proving basic SDK wiring, startup ordering, and request
correlation.

## Goals

- Create Sentry coverage for the current `apps/web` React browser surface.
- Create Sentry coverage for the current `apps/server` Fastify API surface.
- Create or confirm the `azurite-server` Sentry project without committing a
  DSN.
- Load local Sentry values from one root untracked `.env.local`.
- Keep typed web/server config parsing independent of the local value source.
- Keep Sentry disabled unless the enabled flag is the literal string `true` and
  a DSN is present.
- Keep Sentry-disabled startup free of Sentry SDK and Replay imports by gating
  those imports at the current web and server entrypoints.
- Initialize backend Sentry before Fastify is imported.
- Preserve Fastify/Pino logging and graceful shutdown behavior.
- Add bounded backend Sentry flushing or closing on shutdown when enabled.
- Add shared event-name, attribute, route, and correlation constants.
- Add request IDs and note operation IDs to frontend API calls and backend
  request context.
- Add route-level runtime evidence for note list/read/save/conflict outcomes.
- Add explicit development-only, env-gated test telemetry triggers.
- Configure Session Replay for uncensored local debug capture and prove desktop
  and mobile/Tailscale delivery, while leaving editor-specific replay usefulness
  to Slice 7B.
- Capture browser console warnings/errors in Sentry so third-party editor and
  runtime warnings are available before Slice 7B adds semantic editor events.
- Require Sentry SDK versions that support structured JavaScript logs through
  `enableLogs` and `Sentry.logger` or the installed SDK's current equivalent.
- Prove backend tracing uses the parsed server trace sample rate and can join
  sampled frontend `/api/*` calls to Fastify route work.
- Verify real desktop web, mobile/Tailscale web, and backend Sentry delivery.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Do not add deep Milkdown, Crepe, ProseMirror, Dexie, or Zustand diagnostics.
- Do not implement full debug payload bounds or `azurite.debug_payload`.
- Do not add high-frequency editor event coalescing.
- Do not fix the Milkdown block-menu bug.
- Do not add source-map upload infrastructure.
- Do not add Sentry to future native, worker, sync, or indexing surfaces.
- Do not create a public production telemetry policy.
- Do not create a custom in-app log viewer.
- Do not persist observability events as Azurite product state.
- Do not replace existing Fastify/Pino logs with Sentry.
- Do not add direct Sentry instrumentation, observer hooks, or telemetry
  contracts to `packages/core`.

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
model. Browser/runtime events and backend route-boundary outcomes are grouped
separately while remaining correlatable through Sentry trace IDs, Azurite
request IDs, note operation IDs, note IDs, release, and environment.

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
  web Sentry config.
- The web entrypoint checks the parsed config before importing Sentry browser
  SDK and Replay runtime modules. Sentry-disabled startup must not import
  `@sentry/react`, configure Replay, or initialize Sentry.
- The server ESM preload path loads the root `.env.local` before Sentry
  initialization by using Node 26's built-in environment-file support from a
  small server-local env module.
- Missing `.env.local` keeps normal Sentry-disabled startup working.
- `apps/server/src/config/sentry-config.ts` parses `process.env` into a typed
  server Sentry config.
- The server preload checks parsed server config before importing Sentry runtime
  modules. Sentry-disabled startup must not import `@sentry/node`, initialize
  Sentry, or await Sentry shutdown work.
- Enabled flags use the literal string `true`. Missing, empty, or invalid flags
  are disabled.
- Sample-rate values must parse to numbers in the inclusive `0..1` range.
  Invalid values fall back to documented debug defaults without crashing local
  startup.

### Source Maps And Release Metadata

Slice 7A uses release naming plus local development source maps. It does not add
source-map upload infrastructure.

Production-like source-map upload is deferred until Azurite has a
production-like build/distribution slice. That later work should evaluate
`@sentry/vite-plugin`, Sentry auth tokens, organization/project slugs,
build-only environment loading, and uploaded artifact verification as one
focused release-observability task.

### Fastify Initialization Boundary

Sentry must initialize before Fastify is imported or instrumented.

Use Sentry's official ESM `--import` preload path for the server dev/start
runtime. Add a committed server preload file such as
`apps/server/src/sentry-preload.mjs`, and document it as the required
external-tooling exception to Azurite's TypeScript-script preference. This
exception is justified because the file is loaded by Node before TypeScript app
modules and before Fastify can be imported.

The server package `dev` and `start` scripts must run through the real `tsx`
path with the Sentry preload installed, for example:

```sh
tsx --import ./src/sentry-preload.mjs src/index.ts
```

If implementation discovers the exact `tsx` flag shape needs adjustment, the
adjustment must preserve preload-before-Fastify ordering and be recorded in the
slice notes.

Accepted behavior:

- Sentry-enabled server startup initializes Sentry before `fastify` is loaded.
- Sentry-disabled server startup does not require a DSN and preserves current
  startup behavior without importing `@sentry/node`.
- Existing graceful shutdown behavior remains intact.
- Existing Fastify/Pino logging remains intact.
- Automated startup tests prove the real `tsx` dev/start path loads the preload
  before `apps/server/src/app.ts` imports Fastify.
- Automated disabled-mode startup tests prove the preload returns before Sentry
  SDK import or initialization when `SENTRY_ENABLED` is not `true` or the DSN is
  missing.
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
| `azurite.editor_session_id`   | web store/editor              | Reserved for Slice 7B editor diagnostics.                            |
| `azurite.ui_request_sequence` | web store                     | Distinguish stale-response guards from API request IDs.              |
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
- The typed `NoteBrowserApi` boundary accepts optional request metadata for
  correlation IDs instead of relying on hidden globals, module-level mutable
  state, or Sentry-only scope state.
- Shared correlation schemas define accepted ID format and length for request
  IDs and note operation IDs.
- Web-generated IDs use `crypto.randomUUID()` where available and a tested
  fallback only if needed.
- Backend request hooks accept only a single valid `x-azurite-request-id`
  header. Missing or invalid request IDs cause the server to generate a fresh
  server request ID for telemetry without changing API response bodies.
- Backend request hooks accept only a single valid
  `x-azurite-note-operation-id` header. Missing or invalid operation IDs are
  omitted from request-scoped observability context.
- Invalid, oversized, or duplicated correlation headers are recorded as
  diagnostic metadata, not trusted as canonical correlation IDs.
- Existing frontend numeric request counters remain local
  `azurite.ui_request_sequence` metadata for stale-response protection. They
  must not be used as `azurite.request_id`.
- Backend note routes attach request ID, operation ID, cluster ID, note ID,
  method, route pattern, result status, and error code to Sentry events/logs.
- Sentry browser tracing uses trace propagation targets that include the current
  same-origin `/api/*` path and local/Tailscale development API paths used by
  Azurite.
- Tests or browser QA prove Sentry's distributed-tracing headers
  `sentry-trace` and `baggage` are emitted on eligible frontend API requests and
  reach the Fastify request boundary through the Vite proxy. If implementation
  adds any direct cross-origin API path for local or Tailscale development, that
  path must document and verify the required CORS/header allowlist instead of
  relying on request IDs alone.
- Backend tracing uses the parsed `SENTRY_TRACE_SAMPLE_RATE` and participates in
  sampled Fastify route traces.
- Manual and automated verification prove that a sampled frontend `/api/*` call
  and its backend Fastify route work are trace-linked where the installed SDK
  supports it.
- Sentry scopes may attach current request or note context during one operation,
  but scopes must be cleared or isolated so request IDs, note IDs, operation IDs,
  route values, hashes, and later Slice 7B markdown context do not leak into
  unrelated events.
- Tests prove that request IDs and operation IDs are present in fetch headers,
  frontend helper calls, backend request context, and backend observability calls
  without changing API response bodies.
- Tests prove invalid, oversized, duplicated, and absent correlation headers do
  not weaken API behavior or pollute canonical request/operation IDs.

### Runtime Telemetry Carrier Boundary

Slice 7A establishes the carrier mapping but keeps payload-heavy diagnostics for
Slice 7B.

### Replay, Logs, And Tracing Runtime Proof

Session Replay is a Slice 7A runtime capability. Slice 7A must prove that replay
delivery works in desktop and mobile/Tailscale debug sessions; Slice 7B owns the
deeper proof that replay is semantically useful for Milkdown, Crepe, Dexie, and
Zustand debugging.

Accepted replay behavior:

- Replay initializes only when web Sentry is explicitly enabled with a DSN.
- Replay SDK imports are skipped when web Sentry is disabled.
- The default debug replay sample rates in `.env.example` make replay delivery
  visible for local Sentry-enabled sessions unless Daniel lowers them.
- The Replay integration is configured through TypeScript-supported SDK options.
- Slice 7A configures uncensored debug Replay defaults through the installed
  SDK's supported options, such as `maskAllText: false`,
  `maskAllInputs: false`, and `blockAllMedia: false` or the current equivalent.
  This is a runtime configuration responsibility, not a 7B retrofit.
- Tests prove the parsed Replay configuration uses the uncensored debug defaults
  when Sentry is explicitly enabled.
- Runtime replay QA confirms a simple development diagnostics marker is visible
  in replay without default text masking. Slice 7B proves Milkdown-specific
  editor text, textarea text, selection, and block-menu usefulness.
- Runtime replay QA confirms one desktop replay and one mobile/Tailscale replay
  arrive in `azurite-web`.
- Slice 7A does not need to prove that editor text, textarea text, selection
  context, or block-menu context are useful in replay. Slice 7B proves and
  adjusts that semantic editor-debugging fidelity.

Accepted logs and tracing behavior:

- Web and server SDK versions support structured logs.
- Sentry initialization enables logs explicitly with `enableLogs` or the current
  SDK equivalent.
- Runtime lifecycle/result events use `Sentry.logger` or the current SDK
  equivalent as the primary structured log carrier.
- Frontend production code does not use `console.log` as the primary event path.
- Browser console warnings and errors are captured as Sentry breadcrumbs, logs,
  or SDK-supported console integration evidence so incidental third-party and
  browser runtime warnings are available in Sentry. This does not make
  `console.log` the primary Azurite event carrier.
- If the selected Sentry SDK only attaches scope attributes to logs in a newer
  version than the minimum structured-log version, the implementation either
  selects that version or passes required attributes directly on every
  `Sentry.logger` call. Request and note correlation must not depend on untested
  scoped-log behavior.
- Backend Sentry logs are additive and do not replace or weaken Fastify/Pino
  logs.
- Browser and backend tracing both use explicit parsed sample rates.
- Manual Sentry UI QA proves that a sampled API call can be inspected as a
  frontend-to-backend trace where the installed SDK supports it.

Runtime mapping:

- Logs are the primary carrier for runtime lifecycle/result events.
- Breadcrumbs are the lightweight chronological trail for route changes, note
  load/save intent, API request outcomes, browser console warnings/errors, and
  dev test triggers.
- Spans measure frontend API calls, note load/save actions, backend request
  handling, and server route-boundary work.
- Tags carry low-cardinality filter dimensions such as `app.surface`,
  environment, release, route pattern, result status, and test-event status.
- Context and structured attributes carry request IDs, operation IDs, note IDs,
  cluster IDs, API error codes, content hashes, route values, and durations.
- Errors and captured exceptions are reserved for real failures, deliberate
  development test events, and error-boundary captures.
- Breadcrumbs must not carry full markdown or draft payloads.
- Slice 7A test events may include small explicit marker payloads that prove
  event context delivery. They must not implement the full
  `azurite.debug_payload` under-limit and over-limit contract.

### Instrumentation Boundary

Direct Sentry calls must stay behind small observability modules instead of
being scattered through feature code.

Required modules:

- web Sentry initialization
- web runtime observability helpers
- server Sentry initialization
- server runtime observability helpers
- shared event-name, attribute, route, and correlation constants

The shared event vocabulary is mandatory. Put reusable event names and shared
attribute names in `packages/shared` so frontend and backend cannot drift.

The 7A observability helpers must expose a typed runtime event/context surface
that Slice 7B can extend with semantic editor, draft, payload, and snapshot
attributes without importing Sentry from feature code or forking the 7A event
shape. This means helper call signatures accept shared event names, common
correlation context, and additional serializable attributes in a controlled way.
Slice 7A does not need to implement the `azurite.debug_payload` carrier, but it
must not hard-code helper shapes that would force Slice 7B to bypass them.

Sentry debug mode is intentionally uncensored. Runtime instrumentation may send
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
- caught core error name, code, message, stack, and local filesystem path
  context where available

Do not add a core observer, hook, dependency injection surface, or Sentry import
to `packages/core` in this slice.

### File-Line And Refactor Boundary

Several implementation targets are already near the 400-line hard limit. Slice
7A must split files before adding runtime instrumentation where needed.

Known pressure points:

- `apps/server/src/notes-route.ts`
- `apps/web/src/state/note-browser-route-actions.ts`
- `apps/web/src/state/note-browser-editor-actions.ts`
- `apps/web/src/components/MilkdownEditor.tsx`

Slice 7A should not expand `MilkdownEditor.tsx` for deep instrumentation. If a
near-limit file must be touched for correlation metadata, extract focused helper
modules first and preserve existing tests.

## Runtime Event Contract

### Shared Event Naming Rules

- Event names use lower-case dot-separated product vocabulary.
- Event names describe product behavior, not Sentry mechanics.
- Every started event has a matching succeeded, failed, stale, conflict,
  invalid, or visible result when that lifecycle exists.
- Event attributes use shared constants for common fields.
- Slice 7A events carry metadata, hashes, IDs, and bounded marker context, not
  full markdown or draft payloads.

### Frontend Runtime Events

| Event                          | Required attributes                                              |
| ------------------------------ | ---------------------------------------------------------------- |
| `route.note.changed`           | `azurite.note_id`, `azurite.route_source`                        |
| `route.note.invalid`           | `azurite.route_source`, invalid route value                      |
| `api.request.started`          | request ID, route, method, operation ID when present             |
| `api.request.succeeded`        | request ID, route, method, status                                |
| `api.request.failed`           | request ID, route, method, API error code or request reason      |
| `note.load.started`            | note ID, operation ID                                            |
| `note.load.succeeded`          | note ID, operation ID, cluster ID, content hash, markdown length |
| `note.load.failed`             | note ID, operation ID, API error code, request ID                |
| `note.load.stale_ignored`      | note ID, operation ID, UI request sequence                       |
| `save.started`                 | note ID, operation ID, expected content hash                     |
| `save.succeeded`               | note ID, operation ID, new content hash                          |
| `save.conflicted`              | note ID, operation ID, expected content hash, API error code     |
| `save.failed`                  | note ID, operation ID, API error code or request failure reason  |
| `telemetry.web.test.triggered` | request ID, release, environment, surface, test marker           |

### Backend Runtime Events

| Event                             | Required attributes                                                       |
| --------------------------------- | ------------------------------------------------------------------------- |
| `workspace.notes.list.started`    | request ID, route, method                                                 |
| `workspace.notes.list.succeeded`  | request ID, cluster ID, note count, duration                              |
| `workspace.notes.list.failed`     | request ID, API error code, duration, caught core error context           |
| `note.read.started`               | request ID, operation ID when present, note ID, route, method             |
| `note.read.succeeded`             | request ID, operation ID when present, note ID, cluster ID, content hash  |
| `note.read.not_found`             | request ID, operation ID when present, note ID, API error code            |
| `note.read.invalid`               | request ID, operation ID when present, API error code                     |
| `note.read.failed`                | request ID, operation ID when present, note ID when known, API error code |
| `note.save.started`               | request ID, operation ID when present, note ID, expected content hash     |
| `note.save.succeeded`             | request ID, operation ID when present, note ID, cluster ID, new hash      |
| `note.save.conflicted`            | request ID, operation ID when present, note ID, expected hash, error code |
| `note.save.invalid`               | request ID, operation ID when present, API error code                     |
| `note.save.failed`                | request ID, operation ID when present, note ID when known, API error code |
| `cluster.metadata.read.succeeded` | request ID, operation ID when present, cluster ID                         |
| `cluster.metadata.created`        | request ID, operation ID when present, cluster ID                         |
| `cluster.metadata.failed`         | request ID, operation ID when present, filesystem path, error details     |
| `security.note_id.rejected`       | request ID, operation ID when present, rejected note ID, API error code   |
| `filesystem.boundary.rejected`    | request ID, operation ID when present, rejected path, API error code      |
| `telemetry.server.test.triggered` | request ID, release, environment, surface, test marker                    |

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

The selected package versions must support structured JavaScript logs through
`enableLogs` and `Sentry.logger` or the current SDK equivalent. If the newest
compatible SDK changes the public logging API, record that implementation
decision in the slice notes and keep structured Sentry logs as the primary
runtime event carrier.

The selected web SDK support must also cover the replay configuration and console
warning/error capture used by this slice. Do not rely on browser console output
as evidence unless the selected SDK sends that evidence to Sentry.

Do not add `@sentry/vite-plugin` in this slice. Source-map upload belongs to a
future release-observability slice that can safely introduce Sentry auth token
handling.

### 3. Add Environment Documentation And Config Parsing

Add committed environment examples and typed config parsing without secrets.

Implementation requirements:

- Create or update root `.gitignore` rules so `.env.local` remains untracked.
- Create root `.env.example` with placeholder values for every supported web and
  server Sentry variable.
- Document the preferred root `.env.local` workflow.
- Document that future non-local deployments can inject the same variables
  through their environment or secret system without using `.env.local`.
- Document how to enable and disable Sentry locally.
- Document which variables are required for web telemetry and server telemetry.
- Document how replay and trace sample rates affect local debug sessions.
- Document that local debug Replay is intentionally uncensored when Sentry is
  explicitly enabled, and that disabled mode skips Sentry SDK/Replay imports at
  the current web and server entrypoints.
- Document how to enable deliberate web and server test events.
- Document that Azurite remains runnable and fully functional without Sentry
  values.
- Add web and server Sentry config modules with typed parsing and tests.
- Use literal `true` as the only enabled value for Sentry and test events.
- Default Sentry to disabled whenever DSN or enabled flag is missing.
- Keep real DSNs, auth tokens, and unrelated local credentials out of Git.

### 4. Add Shared Observability Constants

Create shared event-name, attribute, route, and correlation constants in
`packages/shared`.

Implementation requirements:

- Frontend and backend import event names from the same source.
- Attribute names for correlation IDs, note IDs, cluster IDs, route patterns,
  result statuses, hashes, and API error codes are shared.
- `POST /__azurite/dev/sentry-test-event` is added to shared route constants and
  reference docs as a development-only route registered only when the server
  test-event env gate is enabled.
- Request ID and note operation ID validation schemas are shared.
- Exported constants include beginner-readable TSDoc.
- Tests prove event names do not drift from the documented Slice 7A contract.

### 5. Initialize Web Sentry

Initialize Sentry before the React app renders.

Implementation requirements:

- Initialize only from the parsed web Sentry config when
  `VITE_SENTRY_ENABLED=true` and `VITE_SENTRY_DSN` is present.
- Tag events with `app.surface = web`.
- Set `environment` and `release` from env/config.
- Enable React/browser error capture.
- Enable JavaScript logs through `enableLogs` and `Sentry.logger` or the current
  installed SDK equivalent.
- Enable Session Replay for explicitly enabled debug sessions.
- Configure Replay using the installed SDK's TypeScript options with uncensored
  debug defaults, including unmasked text/input and unblocked media options where
  supported, so Slice 7B can verify editor/debug usefulness without replacing the
  runtime setup.
- Set default debug replay sample rates in `.env.example` so a Sentry-enabled
  local session produces replay delivery unless Daniel lowers the values.
- Enable browser tracing with env-configurable sampling.
- Configure trace propagation targets for same-origin `/api/*`, localhost, and
  Tailscale/MagicDNS Azurite API paths used during development.
- Capture browser console warnings/errors through the SDK-supported console
  integration, breadcrumb integration, log integration, or current equivalent.
- Use dynamic imports or an equivalent entrypoint split so Sentry-disabled web
  startup skips Sentry SDK and Replay runtime imports.
- Keep raw env reads inside `apps/web/src/config/sentry-config.ts` and Sentry
  initialization code.
- Add a React error boundary around the app shell or editor surface without
  changing normal UI behavior.
- Keep Sentry-disabled rendering behavior unchanged.

### 6. Initialize Server Sentry

Initialize Sentry before Fastify is imported by using Sentry's official ESM
`--import` preload path.

Implementation requirements:

- Load the root `.env.local` before instrumentation in local development.
- Initialize only from the parsed server Sentry config when
  `SENTRY_ENABLED=true` and `SENTRY_DSN` is present.
- Return from the preload before importing Sentry runtime modules when server
  Sentry is disabled.
- Tag events with `app.surface = server`.
- Set `environment` and `release` from env/config.
- Use Sentry's Fastify integration.
- Enable backend structured logs through `enableLogs` and `Sentry.logger` or the
  current installed SDK equivalent.
- Enable backend tracing with the parsed `SENTRY_TRACE_SAMPLE_RATE`.
- Keep raw env reads inside server option/config modules and Sentry
  initialization code.
- Keep existing Fastify/Pino logging intact.
- Capture unhandled backend errors.
- Capture route/request errors without weakening existing error responses.
- Update the real server `dev` and `start` scripts so the `tsx` startup path
  uses the Sentry preload before `src/index.ts`.
- Document the `.mjs` preload file as the required external-tooling exception to
  the repository's TypeScript-script preference.
- Add bounded Sentry flush/close behavior during graceful shutdown, with an
  initial timeout no longer than `1000ms`.
- Keep graceful shutdown behavior intact when Sentry is disabled.
- Verify that Sentry-disabled startup still works without a DSN.
- Verify that Sentry-disabled startup does not import or initialize
  `@sentry/node`.
- Verify that the Sentry-enabled real `tsx` startup path initializes Sentry
  before Fastify is imported.

### 7. Add Request And Operation Correlation

Implement the Azurite correlation contract.

Implementation requirements:

- Web API requests include `x-azurite-request-id`.
- Web note load/save API requests include `x-azurite-note-operation-id`.
- The `NoteBrowserApi` TypeScript boundary accepts optional correlation metadata
  for operations that need transport headers.
- Backend request hooks validate, read, or create `azurite.request_id`.
- Backend request hooks validate `x-azurite-note-operation-id` and attach
  `azurite.note_operation_id` to request-scoped observability context only when
  the header is valid.
- Invalid, oversized, duplicated, and absent correlation headers never change
  API response body shapes.
- Note load and save workflows create `azurite.note_operation_id`.
- Local frontend stale-response counters remain
  `azurite.ui_request_sequence` metadata and are never used as
  `azurite.request_id`.
- Frontend and backend observability helpers attach shared
  release/environment, request ID, operation ID, note ID, cluster ID, route,
  method, result status, and API error code where applicable.
- Frontend and backend observability helpers accept controlled additional
  serializable attributes so Slice 7B can extend runtime events without adding
  direct Sentry calls to feature code.
- Observability helpers isolate or clear Sentry scopes after request/note
  operations so correlation metadata cannot leak into unrelated events.
- Tests prove fetch headers, backend request context, observability calls, and
  API response body shapes all satisfy the contract.

### 8. Add Runtime Note Workflow Observability

Add basic runtime observability for route, note load, save, conflict, and
backend route outcomes.

Implementation requirements:

- Instrument route selection and invalid route handling at the existing router
  or store boundary.
- Instrument note load started, succeeded, failed, and stale ignored states.
- Instrument save started, succeeded, conflicted, and failed states.
- Instrument backend note list/read/save started, succeeded, invalid, not-found,
  conflicted, and failed states.
- Instrument cluster metadata read/create/failure behavior as observed from the
  server route boundary.
- Instrument note ID rejection and filesystem boundary rejection as route-level
  outcomes from existing core behavior.
- Map runtime events to Sentry logs, breadcrumbs, spans, tags, contexts, and
  errors according to the Slice 7A runtime carrier boundary.
- Preserve existing Fastify error response shapes and shared API error codes.
- Keep `packages/core` Sentry-free.
- Do not add Milkdown, Dexie, Zustand snapshot, full payload, or coalescing
  diagnostics in this slice.

### 9. Add Deliberate Test Events

Add development-only ways to prove telemetry works without throwing accidental
real product errors.

Implementation requirements:

- Web test events are available only when `import.meta.env.DEV` is true and
  `VITE_SENTRY_TEST_EVENTS_ENABLED=true`.
- The web trigger is not part of the normal note workflow. Use an explicit
  URL-driven development diagnostics panel at
  `/?note=index.md&azurite-dev=sentry-test` that is hidden unless dev mode,
  test events, and the parsed `azurite-dev=sentry-test` state are all active.
- The web trigger requires an intentional click or command to send the event.
- `azurite-dev=sentry-test` is an explicitly parsed TanStack Router search param
  and startup note selection, note-list navigation, and browser-history note
  navigation preserve it when present.
- Server test events are available only when `NODE_ENV` is not `production` and
  `SENTRY_TEST_EVENTS_ENABLED=true`.
- The server trigger is the development-only route
  `POST /__azurite/dev/sentry-test-event`, registered only when test events are
  enabled.
- The server test-event route is defined in shared route constants and marked
  development-only in reference docs.
- Server test-event requests require an explicit confirmation header such as
  `x-azurite-dev-test-event: sentry`.
- Test events are impossible to trigger accidentally in normal user workflows.
- Test events do not write notes, read or create cluster metadata, mutate draft
  state, or change route state.
- Test events include request ID, release, environment, surface, and a clearly
  marked `azurite.test_event = true` attribute.
- Test events exercise the same runtime logs/breadcrumbs/spans/tags/context
  carrier mapping used by real Slice 7A observability events.
- Web test events include a simple visible diagnostics marker that manual replay
  QA can use to confirm runtime Replay text is not masked in local debug mode.
- Test events do not implement the full Slice 7B under-limit and over-limit
  debug payload contract.

### 10. Refactor Before Instrumenting Near-Limit Files

Split files before adding observability to modules that are already close to the
400-line hard limit.

Implementation requirements:

- Keep every code file at 400 lines or fewer.
- Extract backend note route observability or handlers before expanding
  `notes-route.ts`.
- Extract frontend request/correlation/runtime observability helpers before
  expanding route actions or editor actions.
- Avoid adding deep instrumentation to `MilkdownEditor.tsx` in this slice.
- Preserve existing tests while adding focused tests for extracted helpers.

### 11. Verify With Real Runtime

Run automated validation and then verify through Sentry UI.

Required QA:

- Azurite starts without `.env.local` and behaves like the current
  Sentry-disabled app.
- Azurite starts with root `.env.local` and both parsed Sentry configs report
  enabled only when the enabled flag is `true` and the DSN is present.
- A local desktop browser sends a web test event to `azurite-web`.
- The local backend sends a server test event to `azurite-server`.
- Loading a real note creates frontend and backend observability evidence with
  the same request ID and note operation ID.
- Saving a disposable note creates frontend and backend save evidence with the
  same request ID and note operation ID.
- A forced or real conflict creates frontend and backend conflict evidence.
- A mobile/Tailscale browser session appears as a distinct web session.
- Sentry-disabled startup and note workflow remain unchanged.

## Negative Side-Effect Guardrails

Slice 7A must preserve existing product behavior while adding the Sentry runtime
and correlation foundation.

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
- root `.env.local` stays untracked and root `.env.example` contains
  placeholders only
- Sentry-disabled startup does not import or initialize Sentry SDK modules, Replay
  runtime modules, or Sentry shutdown work because the current web and server
  entrypoints gate those imports
- development test telemetry triggers remain explicit, env-gated, dev-only, and
  non-mutating
- Sentry SDK versions support the structured log API used by the implementation
  instead of silently falling back to console output as the primary event path
- Sentry scopes are cleared or isolated so request, route, note, operation, hash,
  and future payload context cannot leak into unrelated events

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
- Sentry-disabled web initialization without importing `@sentry/react` or Replay
  runtime modules
- Sentry-enabled web initialization with mocked SDK calls
- web Replay config using the installed SDK's supported option names
- web Replay config using uncensored debug defaults when explicitly enabled
- web Replay sample-rate defaults that produce replay delivery in explicitly
  enabled local debug sessions unless Daniel lowers them
- browser console warning/error capture through the selected SDK integration or
  equivalent Sentry evidence path
- web trace propagation targets including `/api/*`
- eligible frontend API requests carrying `sentry-trace` and `baggage` headers
  through the Vite proxy to the Fastify request boundary
- web API request IDs and note operation IDs in headers without API response
  body changes
- local UI stale-response sequence IDs remaining separate from API request IDs
- Sentry-disabled server initialization without importing `@sentry/node`
- Sentry-enabled real `tsx` server startup using the ESM `--import` preload
  before Fastify import
- server graceful shutdown flushes/closes Sentry with a bounded timeout when
  enabled and preserves existing disabled-mode shutdown behavior
- server tracing using the parsed `SENTRY_TRACE_SAMPLE_RATE`
- server request ID and note operation ID creation/propagation
- invalid, oversized, duplicated, and absent correlation headers
- Sentry scope isolation/clearing after request and note operations
- Sentry-enabled server route instrumentation with mocked SDK calls
- web and server runtime carrier mapping for logs, breadcrumbs, spans, tags,
  context, and errors
- web and server structured log helpers using `Sentry.logger` or the current SDK
  equivalent, not `console.log`, as the primary event path
- structured log helpers attaching required request/note attributes directly or
  through tested SDK scope-log support
- web and server runtime observability helpers accepting controlled additional
  serializable attributes so Slice 7B can extend events without direct Sentry
  calls from feature code
- development test-event triggers being unavailable when env flags are missing
  and available only in development when explicitly enabled
- router parsing and preserving `azurite-dev=sentry-test` during startup note
  selection, note-list navigation, and browser-history navigation
- shared route constants and reference docs for the development-only backend
  test event route
- backend route-level observability capturing core outcomes/errors without
  adding Sentry imports or observer hooks to `packages/core`
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
- Confirm the diagnostics marker text is visible in the resulting replay without
  default text masking.
- Trigger or observe a browser console warning/error and confirm it appears in
  Sentry as SDK-supported console evidence.
- Trigger the explicit server development test event with the confirmation
  header and confirm it reaches `azurite-server` with
  `azurite.test_event = true`.
- Confirm Sentry captures the browser session, API request path, request ID,
  note operation ID, note-load breadcrumbs/logs, and backend note-read evidence.
- Confirm a desktop Session Replay appears in `azurite-web`.
- Confirm a sampled frontend `/api/*` call can be inspected as a
  frontend-to-backend trace where the installed SDK supports it.
- Confirm eligible frontend API requests include `sentry-trace` and `baggage`
  headers and the headers reach the Fastify request boundary through the Vite
  proxy.
- Confirm the same request ID appears in frontend and backend evidence for a
  note read.
- Confirm the same note operation ID appears in frontend load/save events, fetch
  headers, backend request context, and backend route evidence.
- Save a disposable note and confirm the same request ID and note operation ID
  appear in frontend and backend save evidence.
- Force a save conflict and confirm conflict evidence includes expected content
  hash and shared API error code.
- Open the same MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.
- Confirm a mobile/Tailscale Session Replay appears in `azurite-web`.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.
- Stop the backend with Sentry enabled and confirm shutdown stays bounded while
  pending backend telemetry is flushed or closed.

## Acceptance Criteria

- `azurite-web` receives real telemetry from desktop Azurite.
- `azurite-web` receives real telemetry from mobile/Tailscale Azurite.
- `azurite-server` receives real telemetry from the local Fastify API.
- Root `.env.example` documents the local Sentry workflow and root `.env.local`
  remains untracked.
- Local Sentry documentation covers enable/disable behavior, required web and
  server variables, replay and trace sample rates, deliberate test-event flags,
  and Sentry-disabled startup behavior.
- Web and server Sentry config parsing is centralized behind typed config
  modules and Sentry stays disabled unless enabled flags and DSNs are present.
- Sentry-disabled web startup does not import `@sentry/react` or Replay runtime
  modules, and Sentry-disabled server startup does not import `@sentry/node`.
- Web and server Sentry package versions support structured logs through
  `enableLogs` and `Sentry.logger` or the current SDK equivalent.
- Structured log helpers attach required request/note attributes directly or
  through tested SDK scope-log support; correlation does not depend on untested
  scoped-log behavior.
- Server Sentry initialization uses the official ESM `--import` preload under
  the real `tsx` dev/start path and initializes before Fastify imports.
- The `.mjs` preload file is documented as the required external-tooling
  exception to the repository's TypeScript-script preference.
- Sentry-enabled graceful backend shutdown flushes/closes queued Sentry
  telemetry with a bounded timeout, while Sentry-disabled shutdown behavior
  remains unchanged.
- Frontend and backend events include shared release/environment metadata.
- Desktop and mobile/Tailscale Session Replay delivery is proven in
  `azurite-web`; Slice 7B owns proving editor-specific replay usefulness.
- Replay uses uncensored local debug defaults when explicitly enabled, and a
  diagnostics marker is visible without default text masking.
- Browser console warnings/errors are captured in Sentry so incidental editor or
  runtime warnings are available to Slice 7B.
- Runtime lifecycle/result events use structured Sentry logs as the primary
  event carrier instead of frontend `console.log`.
- Frontend API calls and backend requests are trace-correlatable through Sentry
  where supported.
- Backend tracing uses the parsed server trace sample rate, and sampled
  frontend `/api/*` calls can be joined to Fastify route work where the installed
  SDK supports it.
- Eligible frontend API requests emit `sentry-trace` and `baggage` headers and
  those headers reach the Fastify boundary through the Vite proxy. Any direct
  cross-origin local/Tailscale API path documents and verifies the required
  CORS/header allowlist.
- Frontend API calls and backend requests are semantically correlatable through
  `azurite.request_id` even when Sentry trace propagation is incomplete.
- Note load and save workflows are correlatable through
  `azurite.note_operation_id`.
- Request IDs, note operation IDs, and local UI request sequences remain
  distinct and are transported or scoped only where intended.
- Sentry scopes isolate or clear request/note context so correlation metadata
  cannot leak into unrelated events.
- Web and server observability helpers expose a typed runtime event/context
  surface that accepts controlled additional serializable attributes, so Slice 7B
  can add semantic editor, draft, payload, and snapshot diagnostics without
  direct Sentry imports or event-shape forks.
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
- Backend observability captures route-level evidence from core outcomes/errors,
  and `packages/core` remains Sentry-free with no new observer contract.
- Sentry-disabled Azurite behaves the same as before this slice.
- Slice 7B can add semantic editor and persistence diagnostics without changing
  the runtime startup, config, project, or correlation foundations established
  here.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Handoff To Slice 7B

Slice 7B may begin only after Slice 7A proves:

- Sentry-enabled and Sentry-disabled startup both work.
- Sentry-disabled startup skips Sentry SDK and Replay runtime imports at the
  current web and server entrypoints.
- Web and server Sentry projects receive real events.
- Desktop and mobile/Tailscale web sessions are visible in Sentry.
- Desktop and mobile/Tailscale Session Replay delivery is visible in Sentry.
- Replay debug defaults are uncensored at the runtime configuration layer, with
  editor-specific usefulness left to 7B.
- Browser console warning/error capture is visible in Sentry.
- Structured Sentry logs and sampled frontend-to-backend tracing work as runtime
  carriers.
- `sentry-trace` and `baggage` propagation is verified through the Vite proxy and
  Fastify request boundary.
- Note read/save/conflict workflows are correlated by request ID and note
  operation ID.
- Request/note Sentry scope context is isolated or cleared between operations.
- Shared event and attribute constants exist.
- Direct Sentry calls are contained behind web/server observability helpers.
- Those helpers expose a typed extension surface for 7B semantic attributes.
- The existing note, save, draft, recovery, and routing behavior remains intact.
