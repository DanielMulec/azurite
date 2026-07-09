# Proposed Slice 7B: Request Correlation And Note Route Evidence

## Status

Proposed.

This slice is split from the master observability plan in
`docs/slices/proposed-end-to-end-sentry-observability-foundation.md` and from the
pre-split 7A draft preserved at
`docs/slices/proposed-slice-7a-sentry-runtime-and-correlation-foundation.pre-7abc-split-backup.md`.

Slice 7B depends on Slice 7A: Sentry Runtime Delivery Foundation. It adds
Azurite request correlation and note route evidence on top of the proven runtime.
Slice 7C then adds semantic editor and persistence diagnostics.

The previous two-slice semantic diagnostics draft is preserved at
`docs/slices/proposed-slice-7b-semantic-editor-and-persistence-diagnostics.pre-7abc-split-backup.md`.
The active semantic diagnostics proposal now lives at
`docs/slices/proposed-slice-7c-semantic-editor-and-persistence-diagnostics.md`.

## Product Decision

Azurite adds a stable request and note-operation correlation contract on top of
the Slice 7A Sentry runtime.

Slice 7B settles the current note workflow observability decision:

- Frontend API calls receive stable Azurite request IDs.
- Note load and save workflows receive stable note operation IDs.
- Request IDs and note operation IDs are transported through typed web API
  metadata and validated backend headers.
- Backend request hooks create trusted request-scoped observability context.
- Frontend note load/save events and backend note list/read/save route outcomes
  use shared event names and attributes.
- Note read, save, and conflict workflows can be followed across browser and
  Fastify evidence even when Sentry trace propagation is missing or sampled out.
- Sentry scopes are isolated or cleared so request, note, operation, hash, and
  future payload context cannot leak into unrelated events.

This slice deliberately does not add deep editor, draft, payload, or coalescing
diagnostics. It proves the correlation backbone that Slice 7C will reuse.

## User Story

When Daniel loads a note, saves a note, or triggers a save conflict with Sentry
enabled, he can inspect Sentry and follow the workflow from the browser action to
the Fastify route outcome using the same `azurite.request_id` and
`azurite.note_operation_id`.

When Sentry is disabled, Azurite behaves like the current app: note list loading,
URL navigation, note reading, manual save, conflict handling, draft recovery,
desktop local development, and mobile/Tailscale development continue without
requiring Sentry or changing API response bodies.

## Why This Matters

Slice 7A proves that Sentry can run safely. That is necessary, but runtime
delivery alone does not explain whether a particular note read, save, or conflict
belongs to the same user workflow across the browser and backend.

The next useful delivery unit is correlation. It is narrow enough to review
carefully, but meaningful enough to unlock later semantic diagnostics. Slice 7B
ensures the app has durable request IDs, note operation IDs, shared event names,
route-level outcome evidence, and overlap-safe scope isolation before Slice 7C
adds Milkdown, Dexie, Zustand, payloads, and high-frequency editor events.

## Future Workflow Boundary

### Current Workflow

This slice covers the current correlated note request workflow:

1. Slice 7A Sentry runtime delivery is complete and verified.
2. Daniel starts the local Fastify API and Vite web app with Sentry explicitly
   enabled or disabled.
3. The web app may be opened on desktop Chrome or from a phone over the
   Tailscale MagicDNS URL while the backend stays local-only behind the Vite
   proxy.
4. The app lists notes from the configured filesystem cluster.
5. URL-owned route state selects a note.
6. The frontend reads that note through `/api/notes/content`.
7. Manual save writes markdown through the existing content-hash conflict
   contract.
8. The web API client sends an Azurite request ID on each API call.
9. The note browser load/save workflow creates and passes a note operation ID
   through the typed web API boundary.
10. The backend validates or creates request-scoped correlation context without
    changing API response bodies.
11. Frontend events, backend route events, and Sentry trace evidence include the
    same correlation metadata where applicable.
12. Rapid note switches and stale-response guards keep distinct request IDs,
    operation IDs, note IDs, and UI request sequences without leaking context
    into unrelated events.

The user story is complete only when a real note read, a real save, and a forced
or real conflict can be joined across frontend and backend Sentry evidence by
`azurite.request_id` and `azurite.note_operation_id`, and disabled-mode behavior
remains unchanged.

### Future Workflows This Foundation Must Support

The correlation and event contract must be durable enough for:

- Slice 7C semantic editor and persistence diagnostics.
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

Future workflows should reuse the same release, environment, surface, request ID,
note operation ID, route, cluster, note, result, content hash, and API error
attributes instead of creating parallel telemetry shapes.

### Product Layers Participating Now

Slice 7B touches these current layers:

- repository docs and slice notes
- Slice 7A runtime observability helpers
- `packages/shared` route, observability, result, attribute, and correlation
  constants
- web API client request headers
- typed `NoteBrowserApi` metadata boundary
- note browser load/save actions that create and pass operation IDs
- TanStack Router selected-note state and route-source evidence
- Zustand note browser state only as needed to observe load/save/stale outcomes
- Fastify request hooks for correlation context
- Fastify note list/read/save routes
- existing `packages/core` filesystem note behavior as surfaced by server route
  outcomes and caught errors
- Vitest unit/integration tests
- manual desktop, mobile/Tailscale, and Sentry UI verification

### Product Layers Predictably Needed Soon

Slice 7B leaves explicit seams for:

- Slice 7C editor, draft, payload, snapshot, coalescing, and Replay-usefulness
  diagnostics.
- editor session IDs that join load/save/conflict to editor events.
- note lifecycle operation IDs that span create, save, delete, and future
  recovery flows.
- file-watch and external-change events.
- derived index/search worker or backend service instrumentation.
- PWA/service-worker telemetry once that runtime exists.
- release/source-map upload for production-like builds.
- future auth and local-hosting decision telemetry.

### Deliberately Excluded Layers

These layers are excluded from Slice 7B:

- creating Sentry projects, adding SDK dependencies, root env loading, Replay
  runtime setup, console capture, or server preload work already completed by
  Slice 7A
- replacing the Slice 7A Fastify preload, startup, shutdown, or config boundary
  unless Slice 7B discovers a correctness bug in that foundation
- Milkdown/Crepe focus, selection, transaction, and block-menu instrumentation
- Dexie draft read/write/delete semantic telemetry
- Zustand state snapshots
- full markdown and draft payload carrier machinery
- under-limit and over-limit `azurite.debug_payload` proof
- editor-update coalescing and rate limiting
- several-minute large-note responsiveness QA with rich editor telemetry
- fixing the Milkdown block-menu bug itself
- mobile-native and desktop-native apps
- service workers, sync workers, indexing workers, and background jobs that do
  not exist yet
- public production telemetry policy
- custom in-app log viewer
- Sentry self-hosting or billing work
- source-map upload automation that requires Sentry auth tokens
- direct `packages/core` observability hooks, observer interfaces, or Sentry
  imports

The exclusions are stable because Slice 7B delivers complete request and note
workflow correlation: current note list/read/save/conflict operations are
observable at the browser and server route boundary, correlation metadata is
validated and scope-safe, and API behavior is unchanged. Slice 7C can then focus
on editor and persistence semantics instead of repairing request correlation.

## Goals

- Reuse the Slice 7A Sentry runtime and observability helper surface.
- Add shared event-name, attribute, result-status, route, and correlation
  constants for the current note workflow.
- Add request ID and note operation ID validation schemas.
- Generate or propagate a request ID for each frontend API call.
- Generate note operation IDs for note load and save workflows.
- Transport correlation IDs through typed web API metadata, not hidden globals or
  Sentry-only scope state.
- Validate request ID and note operation ID headers in backend request hooks.
- Generate a fresh server request ID when the frontend omits or sends an invalid
  request ID.
- Reject invalid, oversized, or duplicated correlation headers as canonical
  identifiers without changing API response bodies.
- Keep local frontend stale-response sequence counters separate from
  `azurite.request_id`.
- Add route-level runtime evidence for note list/read/save/conflict outcomes.
- Add route-level evidence for cluster metadata read/create/failure behavior as
  observed from the server route boundary.
- Add route-level evidence for note ID rejection and filesystem boundary
  rejection from existing core behavior.
- Preserve existing Fastify/Pino logging and shared API error response shapes.
- Keep `packages/core` Sentry-free with no new observer contract.
- Prove overlapping note loads, stale-response guards, and unrelated events do
  not leak Sentry scope context.
- Verify real desktop/mobile note read, save, and conflict correlation in Sentry.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Do not recreate Sentry runtime setup from Slice 7A.
- Do not change Slice 7A's Sentry projects, dependency choices, env loading,
  custom preload, Replay config, console capture, or shutdown boundary unless a
  correctness bug is discovered.
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

## Dependency On Slice 7A

Slice 7B assumes Slice 7A has already delivered:

- `@sentry/react` and `@sentry/node` installed in the owning workspaces.
- Web and server Sentry initialization behind typed config modules.
- Root `.env.example` and untracked root `.env.local` workflow.
- Sentry-disabled startup and note workflows verified.
- Custom server preload with enabled-only dynamic `@sentry/node` import.
- Bounded Sentry-enabled shutdown behavior.
- `azurite-web` and `azurite-server` receiving real events.
- Desktop and mobile/Tailscale web sessions visible in Sentry.
- Desktop and mobile/Tailscale Replay delivery visible in Sentry.
- Browser console warning/error capture visible in Sentry.
- Baseline `sentry-trace` and `baggage` propagation through the Vite proxy and
  Fastify boundary.
- Shared development test-event route constants and base runtime helper types in
  `packages/shared`.
- Direct Sentry calls contained behind web/server observability helpers.
- A typed runtime event/context surface that accepts controlled additional
  serializable attributes.

If any of those foundations are missing, Slice 7B should stop and repair the 7A
foundation before adding request correlation.

## Architecture

### Trace And Correlation Contract

Sentry trace propagation alone is not enough for this slice. Azurite must add
stable semantic correlation IDs so desktop, mobile, frontend, backend, and server
route-boundary evidence can be joined even when a trace is missing or sampled
out.

Required correlation fields:

| Attribute                     | Owner                         | Purpose                                                              |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `app.surface`                 | Slice 7A web/server init      | Distinguish browser and API events.                                  |
| `sentry.environment`          | Sentry SDK                    | Group local, Tailscale, and future builds.                           |
| `sentry.release`              | Sentry SDK                    | Join frontend and backend events by build.                           |
| `azurite.request_id`          | web API client/server hook    | Join frontend fetches to backend requests.                           |
| `azurite.note_operation_id`   | web action/backend route      | Join read/save/conflict events for one note operation.               |
| `azurite.editor_session_id`   | Slice 7C web store/editor     | Reserved for editor diagnostics.                                     |
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
- The web note browser actions generate `azurite.note_operation_id` for note load
  and save workflows and pass it through the typed web API boundary.
- The web API client sends note operation IDs through an
  `x-azurite-note-operation-id` header when an operation exists.
- The typed `NoteBrowserApi` boundary accepts optional request metadata for
  correlation IDs instead of relying on hidden globals, module-level mutable
  state, or Sentry-only scope state.
- Shared correlation schemas define accepted ID format and length for request
  IDs and note operation IDs.
- Web-generated IDs use `crypto.randomUUID()` where available and a tested
  fallback only if needed.
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
- Backend note routes attach request ID, operation ID, cluster ID, note ID,
  method, route pattern, result status, and error code to Sentry events/logs.
- Sentry browser tracing continues to use Slice 7A trace propagation targets, but
  Slice 7B's semantic request ID remains the reliable join key when trace
  propagation is incomplete.
- Sentry scopes may attach current request or note context during one operation,
  but scopes must be cleared or isolated so request IDs, note IDs, operation IDs,
  route values, hashes, and later Slice 7C markdown context do not leak into
  unrelated events.
- Tests prove that request IDs and operation IDs are present in fetch headers,
  frontend helper calls, backend request context, and backend observability calls
  without changing API response bodies.
- Tests prove invalid, oversized, duplicated, and absent correlation headers do
  not weaken API behavior or pollute canonical request/operation IDs.

### Runtime Helper Extension

Slice 7B must reuse the Slice 7A runtime helper surface.

Implementation requirements:

- Do not import Sentry from feature code.
- Extend shared event and attribute constants instead of creating parallel
  frontend/backend telemetry shapes.
- Use controlled additional serializable attributes on the Slice 7A helper
  surface for request ID, operation ID, note ID, cluster ID, route source, hash,
  result, and API error context.
- If the 7A helper surface is too narrow, repair it as part of this slice before
  adding note workflow instrumentation.
- Keep helper APIs no-op safe when Sentry is disabled.

### Scope Isolation And Overlap Boundary

Request and note context cannot leak between operations.

Implementation requirements:

- Use per-operation scope isolation, direct structured-log attributes, or another
  tested SDK-supported mechanism that keeps correlation context local to the
  emitted event.
- Do not rely on one global mutable "current note" context for overlapping
  operations.
- Rapid note switches must keep distinct request IDs, note operation IDs, note
  IDs, and UI request sequences.
- A stale ignored response must emit the stale evidence under the stale
  operation's context, not the currently selected note's context.
- The next unrelated runtime event after a note operation must not inherit the
  prior note ID, operation ID, content hash, or API error code.
- Tests must simulate overlapping note reads and stale-response handling.

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
to `packages/core` in this slice.

### File-Line And Refactor Boundary

Several implementation targets are already near the 400-line hard limit. Slice
7B must split files before adding note workflow instrumentation where needed.

Known pressure points:

- `apps/server/src/notes-route.ts`
- `apps/web/src/state/note-browser-route-actions.ts`
- `apps/web/src/state/note-browser-editor-actions.ts`
- `apps/web/src/components/MilkdownEditor.tsx`

Slice 7B should not expand `MilkdownEditor.tsx` for deep instrumentation. If a
near-limit file must be touched for correlation metadata, extract focused helper
modules first and preserve existing tests.

## Correlated Runtime Event Contract

### Shared Event Naming Rules

- Event names use lower-case dot-separated product vocabulary.
- Event names describe product behavior, not Sentry mechanics.
- Every started event has a matching succeeded, failed, stale, conflict,
  invalid, or visible result when that lifecycle exists.
- Event attributes use shared constants for common fields.
- Slice 7B events carry metadata, hashes, IDs, and bounded marker context, not
  full markdown or draft payloads.

### Frontend Events

| Event                     | Required attributes                                              |
| ------------------------- | ---------------------------------------------------------------- |
| `route.note.changed`      | `azurite.note_id`, `azurite.route_source`                        |
| `route.note.invalid`      | `azurite.route_source`, invalid route value                      |
| `api.request.started`     | request ID, route, method, operation ID when present             |
| `api.request.succeeded`   | request ID, route, method, status                                |
| `api.request.failed`      | request ID, route, method, API error code or request reason      |
| `note.load.started`       | note ID, operation ID                                            |
| `note.load.succeeded`     | note ID, operation ID, cluster ID, content hash, markdown length |
| `note.load.failed`        | note ID, operation ID, API error code, request ID                |
| `note.load.stale_ignored` | note ID, operation ID, UI request sequence                       |
| `save.started`            | note ID, operation ID, expected content hash                     |
| `save.succeeded`          | note ID, operation ID, new content hash                          |
| `save.conflicted`         | note ID, operation ID, expected content hash, API error code     |
| `save.failed`             | note ID, operation ID, API error code or request failure reason  |

### Backend Events

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

## Implementation Plan

### 1. Confirm The Slice 7A Baseline

Before adding correlation, confirm the runtime foundation is present.

Implementation requirements:

- Verify web and server Sentry initialization modules exist and are used.
- Verify the custom server preload gates `@sentry/node` imports when disabled.
- Verify root `.env.example` and root `.env.local` workflow exist.
- Verify Sentry-disabled startup and note workflow tests exist.
- Verify web and server Sentry projects receive real test events.
- Verify desktop and mobile/Tailscale Replay delivery is documented and proven.
- Verify baseline trace headers reach Fastify through the Vite proxy.
- Verify direct Sentry calls are contained behind helper modules.
- Verify the typed runtime helper extension surface exists.
- Do not proceed by creating a parallel Sentry setup path.

### 2. Add Shared Observability And Correlation Constants

Extend shared event-name, attribute, route, result, and correlation constants in
`packages/shared`.

Implementation requirements:

- Frontend and backend import event names from the same source.
- Attribute names for correlation IDs, note IDs, cluster IDs, route patterns,
  route source, result statuses, hashes, and API error codes are shared.
- Request ID and note operation ID header names are shared.
- Request ID and note operation ID validation schemas are shared.
- Event names in this proposal are represented as shared constants.
- Exported constants include beginner-readable TSDoc.
- Tests prove event names do not drift from the Slice 7B contract.

### 3. Add Request And Operation Correlation

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
- Invalid, oversized, duplicated, and absent correlation headers never change API
  response body shapes.
- Note load and save workflows create `azurite.note_operation_id`.
- Local frontend stale-response counters remain
  `azurite.ui_request_sequence` metadata and are never used as
  `azurite.request_id`.
- Frontend and backend observability helpers attach shared release/environment,
  request ID, operation ID, note ID, cluster ID, route, method, result status,
  and API error code where applicable.
- Observability helpers isolate or clear Sentry scopes after request/note
  operations so correlation metadata cannot leak into unrelated events.
- Tests prove fetch headers, backend request context, observability calls, and
  API response body shapes all satisfy the contract.

### 4. Add Frontend Note Workflow Evidence

Add basic runtime observability for route selection, note load, stale-response,
save, and conflict states.

Implementation requirements:

- Instrument route selection and invalid route handling at the existing router or
  store boundary.
- Instrument note load started, succeeded, failed, and stale ignored states.
- Instrument save started, succeeded, conflicted, and failed states.
- Instrument frontend API request started, succeeded, and failed states.
- Attach request ID, operation ID, note ID, cluster ID, route source, route,
  method, result status, API error code, UI request sequence, and content hashes
  where applicable.
- Preserve URL-owned selected-note state.
- Preserve stale-response guards and UI request sequence semantics.
- Do not add Milkdown, Dexie, Zustand snapshot, full payload, or coalescing
  diagnostics in this slice.

### 5. Add Backend Route Evidence

Add route-boundary observability for note and cluster operations through focused
helper modules and route integration points.

Implementation requirements:

- Instrument backend note list/read/save started, succeeded, invalid, not-found,
  conflicted, and failed states.
- Instrument cluster metadata read/create/failure behavior as observed from the
  server route boundary.
- Instrument note ID rejection and filesystem boundary rejection as route-level
  outcomes from existing core behavior.
- Map backend events to Sentry logs, breadcrumbs, spans, tags, contexts, and
  errors according to the Slice 7A runtime carrier boundary.
- Include local filesystem paths, stack traces, request/response context, and
  caught core error context where useful for debugging.
- Do not attach full markdown payloads; Slice 7C owns payload helpers.
- Preserve existing Fastify error response shapes and shared API error codes.
- Keep Fastify/Pino logging intact.
- Keep `packages/core` Sentry-free.

### 6. Add Scope Isolation And Overlap Tests

Prove correlation context cannot leak between overlapping operations.

Implementation requirements:

- Add tests for two rapid overlapping note reads with different note IDs.
- Prove each read has a distinct request ID and note operation ID.
- Prove stale ignored evidence carries the stale operation context.
- Prove the currently selected note does not inherit stale operation metadata.
- Prove the next unrelated runtime/test event after a note operation has no note
  ID, operation ID, hash, or API error residue.
- Prove backend request contexts for concurrent requests stay isolated.
- Keep UI request sequence metadata separate from API request IDs.

### 7. Refactor Before Instrumenting Near-Limit Files

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

### 8. Verify With Real Note Workflows

Run automated validation and then verify through Sentry UI.

Required QA:

- Azurite starts without `.env.local` and behaves like the current
  Sentry-disabled app.
- Azurite starts with Slice 7A Sentry env vars enabled.
- A local desktop browser can load notes normally.
- Loading a real note creates frontend and backend observability evidence with
  the same request ID and note operation ID.
- Saving a disposable note creates frontend and backend save evidence with the
  same request ID and note operation ID.
- A forced or real conflict creates frontend and backend conflict evidence.
- A rapid note-switch/stale-response scenario preserves distinct request IDs,
  note operation IDs, note IDs, and UI request sequences.
- The next unrelated runtime event does not inherit prior note context.
- A mobile/Tailscale browser session can load and save through the same local
  backend proxy path while evidence remains correlated.
- Sentry-disabled startup and note workflow remain unchanged.

## Negative Side-Effect Guardrails

Slice 7B must preserve existing product behavior while adding request
correlation and note route evidence.

Existing workflows that must keep working:

- Slice 7A Sentry-enabled and Sentry-disabled runtime behavior
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
- stale async responses remain ignored

Validation, security, and filesystem boundaries that must not weaken:

- note ID validation remains shared and enforced
- path traversal remains rejected
- filesystem boundary protections remain in core/server behavior
- `packages/core` remains free of Sentry imports, observer contracts, and
  telemetry-specific state
- existing API error codes and response body shapes remain stable unless tests
  and reference docs explicitly cover a deliberate change
- Sentry credentials, auth tokens, DSNs, and unrelated local credentials stay out
  of Git
- root `.env.local` stays untracked and root `.env.example` contains placeholders
  only
- correlation headers are diagnostic metadata only and cannot change product API
  behavior
- invalid or duplicated correlation headers are not trusted as canonical IDs
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
- local UI request sequences remain separate from API request IDs

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

- Slice 7A runtime tests
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

- Slice 7A runtime baseline still passing
- shared event, attribute, result, and correlation constants
- request ID and note operation ID validation schemas
- web API request IDs and note operation IDs in headers without API response body
  changes
- typed `NoteBrowserApi` metadata boundary
- local UI stale-response sequence IDs remaining separate from API request IDs
- backend request ID and note operation ID creation/propagation
- invalid, oversized, duplicated, and absent correlation headers
- Sentry scope isolation/clearing after request and note operations
- overlapping note reads with distinct request IDs, operation IDs, note IDs, and
  UI request sequences
- stale ignored evidence preserving stale operation context
- unrelated events not inheriting prior note context
- Sentry-enabled server route instrumentation with mocked SDK calls
- web and server correlated carrier mapping for logs, breadcrumbs, spans, tags,
  context, and errors
- route selection and invalid route observability
- note load started/succeeded/failed/stale ignored observability
- save started/succeeded/conflicted/failed observability
- backend note list/read/save route outcome observability
- cluster metadata read/create/failure route-boundary evidence
- note ID rejection and filesystem boundary rejection evidence
- backend route-level observability capturing core outcomes/errors without adding
  Sentry imports or observer hooks to `packages/core`
- existing route, draft, save, conflict, and recovery tests

Run manual/browser QA:

- Start Azurite with Slice 7A Sentry env vars enabled.
- Open the local desktop URL on desktop Chrome.
- Load a real note and confirm Sentry captures the browser session, API request
  path, request ID, note operation ID, note-load breadcrumbs/logs, and backend
  note-read evidence.
- Confirm the same request ID appears in frontend and backend evidence for a
  note read.
- Confirm the same note operation ID appears in frontend load/save events, fetch
  headers, backend request context, and backend route evidence.
- Save a disposable note and confirm the same request ID and note operation ID
  appear in frontend and backend save evidence.
- Force a save conflict and confirm conflict evidence includes expected content
  hash and shared API error code.
- Rapidly switch notes and confirm stale ignored evidence stays tied to the stale
  operation while the current note keeps its own context.
- Trigger an unrelated runtime/test event after a note operation and confirm no
  previous note context leaks into it.
- Open the same MagicDNS URL on mobile through the Slice 7A Tailscale path.
- Confirm a mobile/Tailscale note read and save remain correlated through the
  local backend proxy path.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.
- Start Azurite without `.env.local` and confirm Sentry-disabled startup and note
  workflows behave like the current app.

## Acceptance Criteria

- Slice 7A runtime startup, config, disabled-mode import gating, custom preload,
  shutdown, Replay, console, trace, and Tailscale behavior remain intact.
- Shared observability event, attribute, result, route, and correlation constants
  exist.
- Request ID and note operation ID validation schemas exist.
- Frontend API calls include `x-azurite-request-id`.
- Note load and save API calls include `x-azurite-note-operation-id`.
- `NoteBrowserApi` accepts typed optional correlation metadata.
- Backend request hooks validate, read, or create request IDs.
- Backend request hooks validate note operation IDs and attach only valid IDs to
  request-scoped observability context.
- Correlation headers are validated; invalid, oversized, duplicated, and absent
  headers do not change API response bodies or pollute canonical IDs.
- Frontend API calls and backend requests remain trace-correlatable through
  Sentry where supported and semantically correlatable through
  `azurite.request_id` even when trace propagation is incomplete.
- Note load and save workflows are correlatable through
  `azurite.note_operation_id`.
- Request IDs, note operation IDs, and local UI request sequences remain
  distinct and are transported or scoped only where intended.
- Sentry scopes isolate or clear request/note context so correlation metadata
  cannot leak into unrelated events.
- Overlapping note loads and stale-response handling preserve distinct
  correlation context.
- Frontend route, API request, note load, stale ignored, save, conflict, and
  failure events are emitted through shared names and attributes.
- Backend note list/read/save, cluster metadata, note ID rejection, and
  filesystem boundary outcomes are emitted through shared names and attributes.
- Backend observability captures route-level evidence from core outcomes/errors,
  and `packages/core` remains Sentry-free with no new observer contract.
- Existing Fastify/Pino logs, API error codes, and response body shapes remain
  intact.
- Sentry-disabled Azurite behaves the same as before Slice 7A and Slice 7B.
- Slice 7C can add semantic editor and persistence diagnostics without changing
  the runtime startup, config, project, preload, shutdown, Replay, console,
  trace, request ID, operation ID, or route evidence foundations established
  here.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Handoff To Slice 7C

Slice 7C may begin only after Slice 7B proves:

- Slice 7A runtime behavior remains intact.
- Shared event and attribute constants exist for runtime and note workflow
  evidence.
- Direct Sentry calls are contained behind web/server observability helpers.
- Request IDs and note operation IDs propagate through frontend API calls and
  backend request context.
- Invalid, oversized, duplicated, and absent correlation headers are handled
  without API response body changes.
- Note read/save/conflict workflows are correlated by request ID and note
  operation ID.
- Route-level backend evidence exists for note list/read/save, cluster metadata,
  note ID rejection, filesystem boundary rejection, and caught core errors.
- Request/note Sentry scope context is isolated or cleared between operations.
- Overlapping note reads and stale-response guards preserve distinct correlation
  context.
- The existing note, save, draft, recovery, and routing behavior remains intact.
