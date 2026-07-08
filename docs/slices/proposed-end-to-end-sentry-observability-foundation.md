# Proposed Slice: End-To-End Sentry Observability Foundation

## Status

Revised after adversarial review.

This proposal intentionally avoids claiming the `Slice 7` number yet. Existing
project docs currently name note creation as Slice 7. If this proposal is
accepted as the next implementation slice, the slice ordering must be updated
deliberately so the roadmap stays coherent.

## Product Decision

Azurite adopts Sentry as the observability backbone for the current local web
app and local Fastify API runtime.

Sentry owns the durable observability platform role: event capture, structured
logs, session replay, error grouping, trace correlation, and investigation UI.
Azurite owns a thin semantic instrumentation layer that explains product events
such as note routing, editor updates, draft persistence, save conflicts, and
filesystem-backed note operations.

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
- backend structured logs for note list/read/save behavior
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
   request/error telemetry, and Azurite semantic events for the same session,
   note, request, and save operation.

The user story is complete only when a real desktop session and a real
mobile/Tailscale session can be followed from browser behavior through the API
request and filesystem-backed note operation.

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
- `packages/core` filesystem note read/write, note ID, path boundary, content
  hash, and cluster metadata behavior
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
- fixing the Milkdown block-menu bug itself

The exclusions are stable for this slice because the current product value is
development observability for the existing browser, API, and filesystem-backed
note workflow.

## Goals

- Create Sentry coverage for the current `apps/web` React browser surface.
- Create Sentry coverage for the current `apps/server` Fastify API surface.
- Verify that real desktop and mobile/Tailscale Azurite sessions reach Sentry.
- Capture frontend session replay for editor QA with unmasked debug content.
- Capture frontend logs, errors, breadcrumbs, and traces.
- Capture backend Fastify errors, request telemetry, structured logs, and
  note-operation breadcrumbs.
- Propagate trace context across frontend `/api/*` calls into the backend.
- Add Azurite request IDs and operation IDs so events remain correlatable even
  when Sentry trace propagation is incomplete.
- Establish shared event names and rich diagnostic attributes for Azurite
  observability.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Fixing the Milkdown block-menu bug in this slice.
- Adding Sentry to future mobile-native, desktop-native, worker, sync, or
  indexing surfaces that do not exist yet.
- Creating a public production telemetry policy.
- Creating a custom in-app log viewer.
- Persisting observability events as Azurite product state.
- Replacing existing Fastify/Pino logs with Sentry.
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
model. Browser/editor problems and backend/filesystem problems should be
grouped separately while still being correlatable through trace IDs, Azurite
request IDs, note operation IDs, note IDs, release, and environment.

### Configuration Boundary

Sentry must be configured through local environment variables.

Web:

- `VITE_SENTRY_ENABLED`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACE_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE`
- `VITE_SENTRY_TEST_EVENTS_ENABLED`

Server:

- `SENTRY_ENABLED`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_TRACE_SAMPLE_RATE`
- `SENTRY_TEST_EVENTS_ENABLED`

Example values belong in committed environment docs. Real DSNs, auth tokens, and
project credentials must stay out of Git.

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

The server entrypoint must not statically import `createServer` before Sentry
initialization. Use a dedicated server instrumentation module and dynamically
import the Fastify app after initialization, or use the current official Sentry
ESM preload path if it works with the repository's `tsx` dev command.

The accepted behavior is:

- Sentry-enabled server startup initializes Sentry before `fastify` is loaded.
- Sentry-disabled server startup does not require a DSN and preserves current
  startup behavior.
- Existing graceful shutdown behavior remains intact.
- Existing Fastify/Pino logging remains intact.

### Trace And Correlation Contract

Sentry trace propagation alone is not enough for this slice. Azurite must add
stable semantic correlation IDs so desktop, mobile, frontend, backend, and
filesystem evidence can be joined even when a trace is missing or sampled out.

Required correlation fields:

| Attribute                   | Owner                         | Purpose                                                              |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `app.surface`               | web/server init               | Distinguish browser and API events.                                  |
| `sentry.environment`        | Sentry SDK                    | Group local, Tailscale, and future builds.                           |
| `sentry.release`            | Sentry SDK                    | Join frontend and backend events by build.                           |
| `azurite.request_id`        | web API client/server hook    | Join frontend fetches to backend requests.                           |
| `azurite.note_operation_id` | web action/backend route      | Join read/save/conflict events for one note operation.               |
| `azurite.editor_session_id` | web store/editor              | Join editor lifecycle, draft, and save events.                       |
| `azurite.cluster_id`        | shared response/store/backend | Scope events to the current cluster identity.                        |
| `azurite.note_id`           | web/backend operation         | Scope events to the current note.                                    |
| `http.method`               | web/server request helpers    | Identify request behavior without relying on raw logs.               |
| `http.route`                | web/server request helpers    | Use route patterns, not only concrete URLs.                          |
| `azurite.route_source`      | router/store                  | Distinguish direct URL, list click, history, and fallback selection. |
| `azurite.api_error_code`    | API error handling            | Preserve shared error contract evidence.                             |
| `azurite.result_status`     | observability helpers         | Normalize started, succeeded, failed, stale, conflict, invalid.      |

Implementation requirements:

- The web API client generates or propagates `azurite.request_id` for each API
  call and sends it through an `x-azurite-request-id` header.
- The web note browser actions create `azurite.note_operation_id` for note load
  and save workflows.
- Backend request hooks read `x-azurite-request-id` when present and generate a
  server request ID when absent.
- Backend note routes attach request ID, operation ID, cluster ID, note ID,
  method, route pattern, result status, and error code to Sentry events/logs.
- Sentry browser tracing uses trace propagation targets that include the current
  same-origin `/api/*` path and local/Tailscale development API paths used by
  Azurite.
- Tests prove that request IDs and operation IDs are present in frontend helper
  calls and backend observability calls without changing API response bodies.

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

Logs and tracing requirements:

- JavaScript logs are enabled through the installed SDK's log support.
- Semantic Azurite logs use `Sentry.logger` or the current SDK equivalent, not
  `console.log` as the primary event path.
- Browser tracing is enabled with an explicit trace sample rate.
- Backend tracing is enabled with an explicit trace sample rate.
- Trace/log sampling defaults are high for debug sessions, but configurable by
  env var so Sentry stays inspectable during long editing sessions.

### Telemetry Volume Contract

Uncensored does not mean noisy enough to become useless. The slice must define
when full payloads are sent.

Volume requirements:

- Lifecycle events such as `editor.milkdown.markdown_updated` record note ID,
  editor session ID, markdown length, dirty status, revision, and hashes by
  default.
- Full markdown snapshots are attached only to bounded events where the payload
  explains the failure or state transition: note load success/failure, draft
  recovery visibility, save start, save conflict, save failure, and deliberate
  test events.
- Draft payloads are attached for draft read/write/delete failures and recovery
  states, not for every debounced successful write.
- Zustand snapshots are attached for explicit error, conflict, stale-response,
  recovery, or deliberate test events.
- Repeated high-frequency editor updates are rate-limited, coalesced, or logged
  with metadata-only attributes.
- Normal editing must remain responsive during Sentry-enabled debug sessions.

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

| Event                              | Required attributes                                              |
| ---------------------------------- | ---------------------------------------------------------------- |
| `route.note.changed`               | `azurite.note_id`, `azurite.route_source`                        |
| `route.note.invalid`               | `azurite.route_source`, invalid route value                      |
| `note.load.started`                | `azurite.note_id`, `azurite.note_operation_id`                   |
| `note.load.succeeded`              | note ID, operation ID, cluster ID, content hash, markdown length |
| `note.load.failed`                 | note ID, operation ID, API error code, request ID                |
| `note.load.stale_ignored`          | note ID, operation ID, stale request ID                          |
| `editor.milkdown.mounted`          | note ID, editor session ID, editor mode                          |
| `editor.milkdown.markdown_updated` | note ID, editor session ID, revision, markdown length            |
| `editor.mode.changed`              | note ID, editor session ID, previous mode, next mode             |
| `editor.status.changed`            | note ID, editor session ID, previous status, next status         |
| `draft.read.started`               | note ID, cluster ID, editor session ID                           |
| `draft.read.succeeded`             | note ID, cluster ID, draft presence, updated time when present   |
| `draft.read.failed`                | note ID, cluster ID, persistence unavailable reason              |
| `draft.write.started`              | note ID, cluster ID, editor session ID, dirty status             |
| `draft.write.succeeded`            | note ID, cluster ID, dirty status                                |
| `draft.write.failed`               | note ID, cluster ID, persistence unavailable reason              |
| `draft.delete.started`             | note ID, cluster ID                                              |
| `draft.delete.succeeded`           | note ID, cluster ID                                              |
| `save.started`                     | note ID, operation ID, editor session ID, expected content hash  |
| `save.succeeded`                   | note ID, operation ID, new content hash                          |
| `save.conflicted`                  | note ID, operation ID, expected content hash, API error code     |
| `save.failed`                      | note ID, operation ID, API error code or request failure reason  |
| `recovery.draft.visible`           | note ID, cluster ID, draft updated time                          |
| `recovery.degraded.visible`        | note ID when known, persistence unavailable reason               |

### Backend Events

| Event                             | Required attributes                                         |
| --------------------------------- | ----------------------------------------------------------- |
| `workspace.notes.list.started`    | request ID, route, method                                   |
| `workspace.notes.list.succeeded`  | request ID, cluster ID, note count, duration                |
| `workspace.notes.list.failed`     | request ID, API error code, duration                        |
| `note.read.started`               | request ID, note ID, route, method                          |
| `note.read.succeeded`             | request ID, note ID, cluster ID, content hash, duration     |
| `note.read.not_found`             | request ID, note ID, API error code                         |
| `note.read.invalid`               | request ID, API error code                                  |
| `note.read.failed`                | request ID, note ID when known, API error code, duration    |
| `note.save.started`               | request ID, note ID, expected content hash                  |
| `note.save.succeeded`             | request ID, note ID, cluster ID, new content hash, duration |
| `note.save.conflicted`            | request ID, note ID, expected content hash, API error code  |
| `note.save.invalid`               | request ID, API error code                                  |
| `note.save.failed`                | request ID, note ID when known, API error code, duration    |
| `cluster.metadata.read.succeeded` | request ID, cluster ID                                      |
| `cluster.metadata.created`        | request ID, cluster ID                                      |
| `cluster.metadata.failed`         | request ID, filesystem path, error details                  |
| `security.note_id.rejected`       | request ID, rejected note ID, API error code                |
| `filesystem.boundary.rejected`    | request ID, rejected path, API error code                   |

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

### 3. Add Environment Documentation

Add committed environment examples without secrets.

The docs must show:

- how to enable/disable Sentry locally
- which variables are required for web telemetry
- which variables are required for server telemetry
- how to set replay and trace sample rates for debug sessions
- how to enable deliberate test events
- that Azurite remains runnable without Sentry
- that real DSNs and auth tokens stay in untracked local env files

### 4. Add Shared Observability Constants

Create shared event-name and attribute constants in `packages/shared`.

Requirements:

- frontend and backend import event names from the same source
- attribute names for correlation IDs, note IDs, cluster IDs, route patterns,
  result statuses, hashes, and API error codes are shared
- exported constants include beginner-readable TSDoc
- tests prove event names do not drift from the documented contract

### 5. Initialize Web Sentry

Initialize Sentry before the React app renders.

Web requirements:

- initialize only when `VITE_SENTRY_ENABLED` and `VITE_SENTRY_DSN` allow it
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
- add a React error boundary around the app shell or editor surface without
  changing normal UI behavior
- keep Sentry-disabled rendering behavior unchanged

### 6. Initialize Server Sentry

Initialize Sentry before Fastify is imported.

Server requirements:

- initialize only when `SENTRY_ENABLED` and `SENTRY_DSN` allow it
- tag events with `app.surface = server`
- set `environment` and `release` from env/config
- use Sentry's Fastify integration
- enable backend structured logs where supported by the installed SDK
- keep existing Fastify/Pino logging intact
- capture unhandled backend errors
- capture route/request errors without weakening existing error responses
- keep graceful shutdown behavior intact
- verify that Sentry-disabled startup still works without a DSN

### 7. Add Request And Operation Correlation

Implement the Azurite correlation contract.

Requirements:

- web API requests include `x-azurite-request-id`
- backend request hooks read or create `azurite.request_id`
- note load and save workflows create `azurite.note_operation_id`
- editor lifecycle uses `azurite.editor_session_id`
- frontend and backend observability helpers attach shared release/environment,
  request ID, operation ID, note ID, cluster ID, route, method, result status,
  and API error code where applicable
- tests prove API response body shapes do not change

### 8. Add Frontend Semantic Observability

Add rich breadcrumbs/logs for the current editor workflow through focused helper
modules and store/action integration points.

Requirements:

- instrument route selection, invalid route handling, note loading,
  stale-response ignores, Milkdown mount/update, editor mode/status changes,
  draft read/write/delete, save success/failure/conflict, and recovery states
- include full markdown, draft payloads, and Zustand snapshots only where the
  telemetry volume contract allows them
- keep high-frequency markdown update events metadata-only or coalesced
- do not let observability helpers mutate editor, draft, route, save, or
  cluster state

### 9. Add Backend Semantic Observability

Add rich breadcrumbs/logs for note and cluster operations through focused helper
modules and route integration points.

Requirements:

- instrument note list/read/save started, succeeded, invalid, not-found,
  conflicted, and failed states
- instrument cluster metadata read/create/failure behavior
- instrument note ID rejection and filesystem boundary rejection
- include local filesystem paths, stack traces, request/response context, and
  full markdown only where useful for debugging and allowed by the telemetry
  volume contract
- preserve existing Fastify error response shapes and shared API error codes

### 10. Add Deliberate Test Events

Add development-only ways to prove telemetry works without throwing accidental
real product errors.

Requirements:

- web test events are available only in development and only when
  `VITE_SENTRY_TEST_EVENTS_ENABLED` is enabled
- server test events are available only in development and only when
  `SENTRY_TEST_EVENTS_ENABLED` is enabled
- test events are impossible to trigger accidentally in normal user workflows
- test events do not write notes or mutate cluster metadata
- test events include request ID, release, environment, surface, and a clearly
  marked `azurite.test_event = true` attribute

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
- existing API error codes and response body shapes remain stable unless tests
  and reference docs explicitly cover a deliberate change
- Sentry credentials, auth tokens, DSNs, and unrelated local credentials stay
  out of Git
- Sentry debug payloads may include real note/debug content only when Sentry is
  explicitly enabled by local debug configuration

URL, state, cache, and storage behavior that must stay coherent:

- URL-owned selected-note state remains the route source of truth
- browser history behavior does not change
- Zustand remains the note browser state owner
- Dexie remains the draft persistence owner
- Sentry does not become a cache, source of truth, or recovery mechanism
- request IDs and operation IDs are diagnostic metadata only

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

- Sentry-disabled web initialization
- Sentry-enabled web initialization with mocked SDK calls
- web Replay config preserving unmasked editor/debug content behavior
- web trace propagation targets including `/api/*`
- web API request IDs without API response body changes
- Sentry-disabled server initialization
- Sentry-enabled server initialization before Fastify import
- server request ID creation and propagation
- Sentry-enabled server route instrumentation with mocked SDK calls
- frontend observability helpers preserving rich diagnostic payloads
- frontend observability helpers coalescing or summarizing high-frequency
  editor updates
- backend observability helpers preserving rich diagnostic payloads
- shared observability event and attribute constants
- existing route, draft, save, conflict, and recovery tests

Run manual/browser QA:

- Start Azurite locally with web and server Sentry env vars.
- Open the Tailscale MagicDNS URL on desktop Chrome.
- Trigger the web development test event and confirm it reaches `azurite-web`.
- Trigger the server development test event and confirm it reaches
  `azurite-server`.
- Load the note from the Milkdown block-menu bug report.
- Confirm Sentry captures the browser session, console warnings/logs, API
  request path, request ID, note operation ID, note-load breadcrumbs, and
  backend note-read evidence.
- Confirm the same request ID appears in frontend and backend evidence for a
  note read.
- Save a disposable note and confirm the same request ID and note operation ID
  appear in frontend and backend save evidence.
- Force a save conflict and confirm conflict evidence includes expected content
  hash and shared API error code.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Confirm replay shows enough editor text, DOM, focus context, and event
  breadcrumbs to decide the next fix slice.
- Open the same MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.

## Acceptance Criteria

- `azurite-web` receives real telemetry from desktop Azurite.
- `azurite-web` receives real telemetry from mobile/Tailscale Azurite.
- `azurite-server` receives real telemetry from the local Fastify API.
- Frontend and backend events include shared release/environment metadata.
- Frontend API calls and backend requests are trace-correlatable through Sentry
  where supported.
- Frontend API calls and backend requests are semantically correlatable through
  `azurite.request_id` even when Sentry trace propagation is incomplete.
- Note load and save workflows are correlatable through
  `azurite.note_operation_id`.
- The Milkdown block-menu bug report can be investigated with Sentry evidence
  instead of only terminal logs.
- Session Replay captures unmasked editor/debug context in explicitly enabled
  local debug sessions.
- Telemetry volume is controlled enough that normal editing remains responsive
  and Sentry remains inspectable.
- Sentry-disabled Azurite behaves the same as before this slice.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Resolved Review Decisions

- This observability foundation should become the next numbered slice if Daniel
  accepts it, moving create-new-notes later in the roadmap.
- Use Sentry's Fastify setup path for the backend project. Use generic Node.js
  only as a documented fallback if Fastify setup is unavailable or blocked.
- Do not include source-map upload infrastructure in the first implementation.
  Use release naming plus local source maps now.
- Session Replay should run for every explicitly enabled local debug session,
  with env-configurable sampling and unmasked debug capture.
