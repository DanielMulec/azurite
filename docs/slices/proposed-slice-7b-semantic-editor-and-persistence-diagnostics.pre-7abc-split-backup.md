# Proposed Slice 7B: Semantic Editor And Persistence Diagnostics

## Status

Proposed.

This slice is split from the master observability plan in
`docs/slices/proposed-end-to-end-sentry-observability-foundation.md`. It depends
on Slice 7A: Sentry Runtime And Correlation Foundation.

Slice 7B completes the full semantic observability promise for the current
editor and persistence workflow after Slice 7A proves Sentry runtime delivery,
disabled-mode safety, and frontend/backend request correlation.

## Product Decision

Azurite builds rich editor and persistence diagnostics on top of the Slice 7A
Sentry runtime foundation.

Sentry remains the durable observability platform: event capture, structured
logs, session replay, error grouping, trace correlation, and investigation UI.
Azurite owns semantic instrumentation that explains product behavior inside the
current note editing workflow:

- Milkdown and Crepe lifecycle, focus, selection, transaction, markdown update,
  and block-menu context.
- Zustand note browser and editor session transitions.
- Dexie draft read/write/delete, recovery, degraded persistence, and validation
  states.
- save, conflict, stale-response, and recovery diagnostics with bounded rich
  payload context.
- editor responsiveness and telemetry volume control during real large-note
  editing sessions.

This settles that the Milkdown block-menu QA finding and future editor/persistence
failures should be investigated through replay plus semantic evidence, not by
guessing from terminal logs or one-off console prints.

## User Story

When Azurite feels wrong while Daniel is editing real notes, we can inspect the
actual session in Sentry and understand the editor and persistence path:

- browser replay with unmasked editor/debug content
- route and selected-note context
- Milkdown/Crepe lifecycle, focus, selection, transaction, and block-menu events
- markdown update summaries without high-frequency noise
- Zustand state transitions relevant to note load, save, conflict, recovery,
  and stale-response handling
- Dexie draft persistence and recovery evidence
- bounded full markdown, draft, or state payload context only where it explains
  a failure or meaningful state transition
- the same request ID and note operation ID established by Slice 7A

## Why This Matters

Slice 7A proves that Azurite can send web/server telemetry and correlate
requests. That is necessary, but it does not yet answer the hardest current
questions:

- Did Milkdown mount correctly?
- Did focus or selection move before the block menu appeared?
- Did Crepe expose enough block-menu state to explain the visual failure?
- Did a markdown update come from editor input, source mode, note switch, or
  stale async work?
- Did Dexie fail, recover stale data, or show degraded persistence?
- Did Zustand preserve the right conflict/recovery state?
- Did debug telemetry itself make editing a large note feel worse?

Slice 7B makes those questions answerable without creating a parallel product
state system or weakening the file-over-app persistence model.

## Future Workflow Boundary

### Current Workflow

This slice covers the semantic editor and persistence workflow on top of the
Slice 7A runtime foundation:

1. Daniel starts the local Fastify API and Vite web app with Sentry explicitly
   enabled through local debug configuration.
2. The web app may be opened on desktop Chrome or from a phone over the
   Tailscale MagicDNS URL while the backend stays local-only behind the Vite
   proxy.
3. URL-owned route state selects a note.
4. The frontend reads that note through the Slice 7A correlated API boundary.
5. The Milkdown editor mounts, switches modes, observes focus/selection and
   transaction context, emits markdown updates, and exposes Crepe block-menu
   context where available.
6. Zustand owns live note browser and editor session state.
7. Dexie owns browser-local draft persistence and recovery state.
8. Manual save writes markdown through the existing content-hash conflict
   contract.
9. Missing-note, degraded draft recovery, save failure, stale response, and
   conflict states remain visible and debuggable.
10. Sentry shows replay, logs, breadcrumbs, spans, tags, context, and bounded
    payload evidence for the same editor session, note, request, and operation.
11. Normal editing remains responsive during several minutes of large-note
    editing with Sentry enabled.

The user story is complete only when the Milkdown block-menu QA scenario can be
investigated through Sentry evidence and a real large-note editing session stays
responsive while preserving important load/save/conflict/recovery evidence.

### Future Workflows This Foundation Must Support

The semantic event vocabulary and payload helpers must be durable enough for:

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

Future workflows should reuse the same event naming, request ID, operation ID,
editor session ID, route source, cluster, note, result, payload, and recovery
attributes instead of creating parallel telemetry shapes.

### Product Layers Participating Now

Slice 7B touches these current layers:

- repository docs and slice notes
- Slice 7A shared observability constants extended for semantic editor and
  persistence events
- `apps/web` observability helpers
- TanStack Router selected-note and dev diagnostics state where it affects
  semantic breadcrumbs
- Zustand note browser store actions and editor session state
- Dexie draft persistence and recovery paths
- Milkdown/Crepe editor lifecycle and markdown update hooks
- Saveable note editor status, conflict, and recovery state
- web payload bounds, snapshots, coalescing, and rate limiting
- backend route observability helpers only where bounded payload or richer
  failure context is needed for save/conflict/recovery evidence
- existing `packages/core` filesystem behavior as surfaced by server route
  return values and caught errors
- Vitest unit/integration tests
- manual desktop and mobile Sentry UI verification

### Product Layers Predictably Needed Soon

Slice 7B leaves explicit seams for:

- create/delete editor and route actions.
- autosave and future outbox diagnostics.
- file-watch and external-change evidence.
- derived index/search worker or backend service instrumentation.
- PWA/service-worker telemetry once that runtime exists.
- release/source-map upload for production-like builds.
- future auth and local-hosting decision telemetry.

### Deliberately Excluded Layers

These layers are excluded from Slice 7B:

- creating Sentry projects, adding SDK dependencies, or redoing runtime
  configuration already completed by Slice 7A
- replacing the Slice 7A Fastify preload, startup, shutdown, or config boundary
  unless Slice 7B discovers a correctness bug in that foundation
- fixing the Milkdown block-menu bug itself
- adding new note creation, delete, autosave, search, backlinks, graph, sync, or
  file-watch behavior
- mobile-native and desktop-native apps
- service workers, sync workers, indexing workers, and background jobs that do
  not exist yet
- public production telemetry policy
- custom in-app log viewer
- Sentry self-hosting or billing work
- source-map upload automation that requires Sentry auth tokens
- direct `packages/core` observability hooks, observer interfaces, or Sentry
  imports

The exclusions are stable because Slice 7B's current value is diagnostic
completeness for the existing browser editor, client state, draft persistence,
API, and server route-boundary workflow. It completes the current observability
promise without smuggling in new note lifecycle product behavior.

## Goals

- Instrument the current editor workflow with semantic Sentry logs,
  breadcrumbs, spans, tags, context, and errors.
- Reuse Slice 7A request IDs, note operation IDs, release, environment, surface,
  route, cluster, note, result, and API error attributes.
- Reuse or deliberately wrap the existing editor session identity instead of
  creating a parallel editor identity.
- Capture Milkdown mount, destroy, focus, selection, transaction, markdown
  update, and mode/status changes.
- Capture Crepe block-menu open/close behavior and useful context when the
  editor package exposes it.
- Capture Dexie draft read/write/delete, validation, degraded persistence, and
  recovery evidence.
- Capture Zustand snapshots for explicit error, conflict, stale-response,
  recovery, or deliberate test events.
- Add bounded payload helpers for markdown, drafts, request/response context,
  and state snapshots.
- Prove under-limit payloads appear whole in `azurite.debug_payload`.
- Prove over-limit payloads send truncation metadata, original length, content
  hash, and useful leading/trailing text windows.
- Coalesce or rate-limit high-frequency editor update telemetry.
- Clear local buffers, timers, or coalescers when the editor session changes.
- Verify replay shows enough unmasked editor/debug context to guide the
  Milkdown block-menu fix slice.
- Verify large-note editing stays responsive and Sentry remains inspectable.

## Non-Goals

- Do not recreate the Sentry projects, dependency decisions, env loading, or
  runtime startup foundation from Slice 7A.
- Do not fix the Milkdown block-menu bug in this slice.
- Do not add create, delete, autosave, file watching, search, backlinks, graph,
  sync, or offline write queue behavior.
- Do not make Sentry a cache, source of truth, recovery system, editor state
  owner, draft state owner, or cluster state owner.
- Do not redact, hash, mask, sanitize, or exclude Azurite debug data for privacy
  reasons when Sentry is explicitly enabled by local debug configuration.
- Do not send full markdown or draft payloads on every high-frequency editor
  update.
- Do not add direct Sentry instrumentation, observer hooks, or telemetry
  contracts to `packages/core`.

## Dependency On Slice 7A

Slice 7B assumes Slice 7A has already delivered:

- `@sentry/react` and `@sentry/node` installed in the owning workspaces.
- Web and server Sentry initialization behind typed config modules.
- Root `.env.example` and untracked root `.env.local` workflow.
- Sentry-disabled startup and note workflows verified.
- `azurite-web` and `azurite-server` receiving real events.
- Request ID and note operation ID propagation through frontend API calls and
  backend request context.
- Shared observability constants and route constants in `packages/shared`.
- Direct Sentry calls contained behind web/server observability helpers.
- Basic note read/save/conflict route-boundary evidence.

If any of those foundations are missing, Slice 7B should stop and repair the 7A
foundation before adding deeper semantic instrumentation.

## Architecture

### Semantic Event Contract

Slice 7B extends the shared event vocabulary established in Slice 7A. Event
names remain lower-case dot-separated product vocabulary. Event names describe
Azurite behavior, not Sentry mechanics.

Every started event has a matching succeeded, failed, stale, conflict, invalid,
or visible result when that lifecycle exists. Event attributes use shared
constants for common fields.

Frontend semantic events:

| Event                                  | Required attributes                                            |
| -------------------------------------- | -------------------------------------------------------------- |
| `editor.milkdown.mounted`              | note ID, editor session ID, editor mode                        |
| `editor.milkdown.destroyed`            | note ID, editor session ID, destroy reason                     |
| `editor.milkdown.focus.changed`        | note ID, editor session ID, focus state                        |
| `editor.milkdown.selection.changed`    | note ID, editor session ID, selection summary                  |
| `editor.milkdown.transaction.observed` | note ID, editor session ID, transaction summary                |
| `editor.milkdown.markdown_updated`     | note ID, editor session ID, revision, markdown length          |
| `editor.crepe.block_menu.opened`       | note ID, editor session ID, block-menu context when available  |
| `editor.crepe.block_menu.closed`       | note ID, editor session ID, close reason when available        |
| `editor.mode.changed`                  | note ID, editor session ID, previous mode, next mode           |
| `editor.status.changed`                | note ID, editor session ID, previous status, next status       |
| `draft.read.started`                   | note ID, cluster ID, editor session ID                         |
| `draft.read.succeeded`                 | note ID, cluster ID, draft presence, updated time when present |
| `draft.read.failed`                    | note ID, cluster ID, persistence unavailable reason            |
| `draft.write.started`                  | note ID, cluster ID, editor session ID, dirty status           |
| `draft.write.succeeded`                | note ID, cluster ID, dirty status                              |
| `draft.write.failed`                   | note ID, cluster ID, persistence unavailable reason            |
| `draft.delete.started`                 | note ID, cluster ID                                            |
| `draft.delete.succeeded`               | note ID, cluster ID                                            |
| `recovery.draft.visible`               | note ID, cluster ID, draft updated time                        |
| `recovery.degraded.visible`            | note ID when known, persistence unavailable reason             |

Slice 7B may enrich Slice 7A note load/save/conflict events with payload context
where the volume contract allows it. It must not rename the Slice 7A events or
fork their attribute shapes.

Backend semantic events:

| Event                             | Required attributes                                                   |
| --------------------------------- | --------------------------------------------------------------------- |
| `note.read.succeeded`             | 7A attributes plus eligible markdown payload summary                  |
| `note.read.failed`                | 7A attributes plus caught core error context                          |
| `note.save.started`               | 7A attributes plus eligible markdown payload summary                  |
| `note.save.conflicted`            | 7A attributes plus expected hash, API error code, payload summary     |
| `note.save.failed`                | 7A attributes plus caught error context and payload summary when used |
| `cluster.metadata.failed`         | 7A attributes plus local filesystem path and error details            |
| `telemetry.server.test.triggered` | request ID, release, environment, surface, payload test state         |

### Replay Configuration Boundary

Session Replay runs for explicitly enabled local debug sessions. Slice 7A
installs the runtime Replay configuration. Slice 7B verifies and adjusts the
current SDK options, through TypeScript types, so replay is useful for editor
debugging.

Replay requirements:

- note text in the Milkdown editor is visible in replay
- note text in the markdown textarea is visible in replay
- editor DOM, focus, selection-adjacent context, and block-menu state are
  visible enough to investigate the Milkdown block-menu QA finding
- media and icons are not blocked if seeing them helps debug layout or editor
  state
- replay sampling is `1.0` for explicitly enabled local debug sessions unless
  Daniel lowers it through env vars
- manual Sentry UI verification confirms uploaded desktop and mobile replays
  actually show editor text, textarea text, relevant DOM state, and the
  Milkdown block-menu interaction context

### Telemetry Carrier Mapping

Logs are the primary carrier for semantic Azurite lifecycle/result events.
Prefer one wide, structured log per meaningful operation result over many thin
logs that require manual reconstruction.

Breadcrumbs are the lightweight chronological trail for route changes, editor
mode/status changes, Milkdown lifecycle markers, draft attempts, save button
intent, recovery visibility, and block-menu observations. Breadcrumbs must help
replay navigation without carrying every full payload.

Spans measure operations with duration: note load, draft read/write/delete,
save, frontend API calls, backend request handling, and server route-boundary
work that calls into cluster metadata and filesystem-backed core helpers. Spans
should attach request ID, operation ID, route, method, note ID, cluster ID,
result status, and duration where available. This slice does not create direct
spans inside `packages/core`.

Tags carry low-cardinality filter dimensions such as `app.surface`,
environment, release, route pattern, result status, editor mode, recovery kind,
and test-event status.

Context and structured attributes carry high-cardinality or rich diagnostic
fields such as note ID, cluster ID, request ID, operation ID, editor session ID,
content hashes, local filesystem paths, selected route values, markdown lengths,
draft timestamps, bounded payload summaries, and state snapshot summaries.

Errors and captured exceptions are reserved for real failures, deliberate
development test events, and error-boundary captures. Do not turn normal
successful lifecycle events into fake exceptions just to make them visible.

Sentry scopes may attach current request/editor context during one operation,
but scopes must be cleared or isolated so note IDs, markdown, and operation IDs
do not leak into unrelated events.

### Payload Carrier Mapping

Structured logs are the searchable primary event record and carry payload
metadata: payload kind, byte length, markdown length, content hash, truncation
status, and the correlation IDs needed to find the related replay/trace/event.

Breadcrumbs never carry full markdown or draft payloads.

Full markdown and draft text can be sent only on eligible bounded debug events.
The chosen carrier is a Sentry captured event context named
`azurite.debug_payload` on a paired `captureMessage` or `captureException` event
for that eligible debug event.

Payload-bearing captured events must use the same event names, request IDs,
operation IDs, note IDs, cluster IDs, release, environment, and result status as
their structured log pair.

Captured messages used for payload-bearing debug events are not fake failures.
They are explicit debug payload carriers for allowed state transitions,
deliberate test events, and real failure/conflict/recovery evidence.

### Telemetry Volume Contract

Uncensored does not mean noisy enough to become useless. Slice 7B defines when
full payloads are sent.

Volume requirements:

- Lifecycle events such as `editor.milkdown.markdown_updated` record note ID,
  editor session ID, markdown length, dirty status, revision, and hashes by
  default.
- Full markdown snapshots can be attached only to bounded events where the
  payload explains the failure or state transition: note load success/failure,
  draft recovery visibility, save start, save conflict, save failure, and
  deliberate test events.
- Eligible does not mean mandatory for every event; the helper decides from
  event type, configured limit, and available payload.
- Full payload capture is bounded for event-size and usefulness reasons, not
  privacy minimization.
- The implementation defines shared debug payload limits with an initial default
  of 128 KiB per text payload.
- Payloads at or below the limit are sent whole in the
  `azurite.debug_payload` event context for eligible payload-bearing captured
  events.
- Larger payloads are represented with
  `azurite.payload_truncated_for_size = true`, original byte length, content
  hash, and diagnostically useful leading/trailing text windows.
- Draft payloads are attached for draft read/write/delete failures and recovery
  states, not for every debounced successful write.
- Zustand snapshots are attached for explicit error, conflict, stale-response,
  recovery, or deliberate test events.
- Repeated high-frequency editor updates are rate-limited, coalesced, or logged
  with metadata-only attributes.
- `editor.milkdown.markdown_updated` emits at most one metadata-only log per
  editor session per second during continuous typing, plus explicit result
  events for save, conflict, recovery, mode changes, and deliberate test events.
- Observability helpers never await Sentry network work inside Milkdown,
  Zustand, Dexie, or save-state mutation paths.
- Local buffers, timers, or coalescers are cleared when the editor session
  changes so stale note content cannot be emitted under a new note ID.
- Normal editing remains responsive during Sentry-enabled debug sessions.

### Editor Instrumentation Boundary

Milkdown and Crepe instrumentation must observe editor behavior without owning
editor behavior.

Implementation requirements:

- Reuse the current editor session identity where possible.
- If the existing `EditorSession.sessionKey` is renamed or wrapped, avoid
  creating a parallel editor identity.
- Capture mount and destroy events with reasons where available.
- Capture focus changes and selection summaries without sending full document
  snapshots through breadcrumbs.
- Capture observable ProseMirror transaction summaries.
- Capture markdown update metadata with coalescing.
- Capture mode/status transitions at the existing app-state boundary.
- Capture Crepe block-menu open/close behavior and context when the package
  exposes a stable hook or observable state.
- If Crepe block-menu state is not directly exposed, record the stable
  lifecycle/focus/selection/transaction evidence that explains what the
  implementation could observe, and document the limitation in the slice notes.

### Persistence Diagnostics Boundary

Dexie and Zustand instrumentation must observe persistence and state transitions
without changing ownership.

Implementation requirements:

- Zustand remains the note browser state owner.
- Dexie remains the durable browser persistence owner.
- Sentry does not become a cache, source of truth, or recovery mechanism.
- Draft read/write/delete attempts record started, succeeded, failed, and
  recovery-visible events.
- Draft validation failures and database-unavailable states remain visible in
  the UI and become visible in Sentry.
- Save/conflict/recovery diagnostics reuse the existing content-hash contract.
- Observability helpers do not mutate editor, draft, route, save, or cluster
  state.

### Core And Filesystem Boundary

`packages/core` remains Sentry-free in this slice.

Server routes may enrich Slice 7A route-level evidence from core calls and
caught core errors:

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
- bounded markdown payload context only where the volume contract allows it

Do not add a core observer, hook, dependency injection surface, or Sentry import
to `packages/core` in this slice.

### File-Line And Refactor Boundary

Several implementation targets are already near the 400-line hard limit. Slice
7B must split files before adding semantic instrumentation where needed.

Known pressure points:

- `apps/server/src/notes-route.ts`
- `apps/web/src/state/note-browser-route-actions.ts`
- `apps/web/src/state/note-browser-editor-actions.ts`
- `apps/web/src/components/MilkdownEditor.tsx`

The implementation should extract focused helpers for editor instrumentation,
draft instrumentation, state snapshots, payload bounds, coalescing, and backend
payload enrichment instead of appending logs to already-large modules.

## Implementation Plan

### 1. Confirm The Slice 7A Baseline

Before adding semantic instrumentation, confirm the Slice 7A foundation is
present.

Implementation requirements:

- Verify web and server Sentry initialization modules exist and are used.
- Verify shared event, attribute, route, and correlation constants exist.
- Verify request ID and note operation ID propagation tests exist.
- Verify Sentry-disabled startup and note workflow tests exist.
- Verify runtime note read/save/conflict observability helpers exist.
- Do not proceed by creating a parallel Sentry setup path.

### 2. Extend Shared Semantic Constants

Extend the shared observability vocabulary for editor, draft, recovery, payload,
and snapshot diagnostics.

Implementation requirements:

- Add shared event names for Milkdown, Crepe, editor mode/status, draft, and
  recovery events.
- Add shared attribute names for editor session ID, editor mode, focus state,
  selection summary, transaction summary, markdown length, payload kind, payload
  size, truncation status, snapshot kind, draft updated time, and persistence
  unavailable reason.
- Add shared result statuses only when they are reusable across web/server
  events.
- Add beginner-readable TSDoc for exported constants.
- Add tests proving semantic event names do not drift from this Slice 7B
  contract.

### 3. Add Bounded Payload Helpers

Add payload helpers behind observability modules.

Implementation requirements:

- Define the default text payload limit as 128 KiB.
- Calculate byte length in a deterministic way.
- Preserve full payload text at or below the configured limit on eligible
  payload-bearing events.
- For larger payloads, send truncation metadata, original byte length, content
  hash, and useful leading/trailing text windows.
- Attach payload context under `azurite.debug_payload`.
- Add explicit attributes for `azurite.payload_truncated_for_size`, payload
  kind, original byte length, markdown length when applicable, and content hash.
- Keep breadcrumbs metadata-only.
- Add frontend and backend tests for under-limit and over-limit payload behavior.

### 4. Add Frontend Semantic Observability Helpers

Create focused web helpers for editor, draft, state, payload, and coalescing
diagnostics.

Implementation requirements:

- Keep direct Sentry calls inside web observability modules.
- Reuse Slice 7A release, environment, surface, request ID, operation ID, note
  ID, cluster ID, route, result, and API error attributes.
- Provide helper APIs that feature code can call without importing Sentry.
- Provide no-op behavior when Sentry is disabled.
- Avoid awaiting Sentry network work in editor, store, Dexie, or save-state
  mutation paths.
- Add tests with mocked Sentry calls for carrier mapping and disabled behavior.

### 5. Instrument Editor Session And State Transitions

Instrument editor session identity and visible editor status changes.

Implementation requirements:

- Reuse or deliberately wrap the existing editor session identity.
- Emit `editor.mode.changed` when the user switches between WYSIWYG and markdown
  source mode.
- Emit `editor.status.changed` for meaningful editor status transitions.
- Attach note ID, cluster ID when available, editor session ID, route source,
  dirty status, content hash, and UI request sequence where applicable.
- Add tests proving instrumentation does not mutate editor state or break
  current mode switching.

### 6. Instrument Dexie Draft Persistence And Recovery

Add semantic diagnostics around draft persistence.

Implementation requirements:

- Emit draft read/write/delete started, succeeded, and failed events.
- Emit recovery-visible events for recovered drafts.
- Emit degraded recovery-visible events for database unavailable or validation
  failure states.
- Attach note ID, cluster ID, editor session ID, draft presence, draft updated
  time, dirty status, base content hash, and persistence unavailable reason
  where applicable.
- Attach draft payloads only for eligible failure or recovery states according
  to the volume contract.
- Preserve Dexie as the draft persistence owner.
- Preserve UI visibility for degraded draft and validation states.
- Add tests for successful draft flows, failure flows, recovery-visible events,
  and disabled Sentry behavior.

### 7. Instrument Milkdown And Crepe Behavior

Add semantic diagnostics around the editor package boundary.

Implementation requirements:

- Emit Milkdown mounted and destroyed events.
- Emit focus changed events.
- Emit selection changed summaries.
- Emit observable ProseMirror transaction summaries.
- Emit coalesced markdown update metadata.
- Emit Crepe block-menu opened and closed events when available.
- Include block-menu context that helps investigate the current QA finding when
  the editor package exposes it.
- If block-menu state is not directly exposed, record the stable observable
  context and document the limitation.
- Keep full document text out of high-frequency breadcrumbs.
- Add tests for mount/destroy/update behavior where current test harness support
  allows it, and document any manual-only assertions.

### 8. Enrich Save, Conflict, Stale, And Recovery Diagnostics

Add rich diagnostics to the existing save and recovery workflow.

Implementation requirements:

- Enrich Slice 7A save started/succeeded/conflicted/failed events with editor
  session ID and payload summary attributes.
- Attach full markdown only to eligible save start, save conflict, save failure,
  and deliberate test events according to the volume contract.
- Attach Zustand snapshots for explicit conflict, stale-response, recovery,
  degraded, or deliberate test events.
- Preserve `expectedContentHash` as the save authority.
- Preserve conflict responses and UI behavior.
- Preserve stale-response guards and keep UI request sequence separate from API
  request ID.
- Add tests for payload attachment, snapshot attachment, conflict preservation,
  stale-response preservation, and disabled Sentry behavior.

### 9. Enrich Backend Payload And Error Diagnostics

Extend backend observability helpers where route-level payload or filesystem
error context improves the current workflow.

Implementation requirements:

- Reuse Slice 7A backend route events and correlation context.
- Add bounded markdown payload summaries for note read/save/conflict/failure
  events where the volume contract allows it.
- Add caught error context for route-boundary failures: error name, code,
  message, stack, API error code, and local filesystem path where available.
- Keep Fastify/Pino logging intact.
- Preserve existing API error response shapes.
- Keep `packages/core` Sentry-free.
- Add tests proving backend payload helpers preserve under-limit and over-limit
  behavior and do not alter API responses.

### 10. Extend Deliberate Test Events For Payload Proof

Extend Slice 7A development-only test events so they prove payload behavior.

Implementation requirements:

- Deliberate web and server test events include under-limit and over-limit
  payload cases.
- Under-limit payload test content appears whole in Sentry under
  `azurite.debug_payload`.
- Over-limit payload test content is represented with
  `azurite.payload_truncated_for_size`, original length, content hash, and
  useful leading/trailing text windows.
- Test events remain development-only, env-gated, explicit, and non-mutating.
- Test events continue to require the Slice 7A confirmation mechanisms.

### 11. Add Coalescing And Cleanup

Add telemetry volume controls for high-frequency editor updates.

Implementation requirements:

- `editor.milkdown.markdown_updated` emits at most one metadata-only log per
  editor session per second during continuous typing.
- Save, conflict, recovery, mode change, and deliberate test events bypass the
  high-frequency update coalescer when they are meaningful result events.
- Coalesced buffers, timers, and pending metadata are cleared when the editor
  session changes.
- Stale note content cannot be emitted under a new note ID.
- Tests prove rate limiting and session-change cleanup.

### 12. Refactor Before Instrumenting Near-Limit Files

Split files before adding semantic observability to modules that are already
close to the 400-line hard limit.

Implementation requirements:

- Keep every code file at 400 lines or fewer.
- Extract frontend store/editor observability helpers before expanding route
  actions, editor actions, or `MilkdownEditor.tsx`.
- Extract backend payload enrichment helpers before expanding route handlers.
- Preserve existing tests while adding focused tests for extracted helpers.

### 13. Verify With Rich Runtime QA

Run automated validation and then verify through Sentry UI.

Required QA:

- Load the note from the Milkdown block-menu bug report.
- Confirm Sentry captures the browser session, console warnings/logs, API
  request path, request ID, note operation ID, note-load evidence, and backend
  note-read evidence inherited from Slice 7A.
- Confirm replay shows unmasked editor text, markdown textarea text, relevant
  DOM state, focus context, selection context, and block-menu context where
  available.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Confirm editor breadcrumbs and logs are useful enough to decide the next fix
  slice.
- Confirm draft read/write/delete and recovery states appear in Sentry.
- Save a disposable note and confirm save evidence includes editor session ID,
  operation ID, request ID, content hashes, and payload metadata.
- Force a save conflict and confirm conflict evidence includes expected content
  hash, shared API error code, payload metadata, and relevant state snapshot.
- Confirm deliberate under-limit payload test content appears in Sentry under
  `azurite.debug_payload`.
- Confirm deliberate over-limit payload test content is represented with
  `azurite.payload_truncated_for_size`, original length, content hash, and
  useful leading/trailing text windows.
- Edit a large real note for several minutes and confirm normal editing remains
  responsive, high-frequency markdown updates are coalesced/rate-limited, and
  Sentry remains inspectable.
- Open the same MagicDNS URL on mobile.
- Confirm mobile replay includes unmasked note/editor context when Sentry debug
  mode is explicitly enabled.

## Negative Side-Effect Guardrails

Slice 7B must preserve existing product behavior while adding semantic
diagnostics.

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
- Slice 7A Sentry-disabled and Sentry-enabled runtime behavior
- Slice 7A request ID and note operation ID correlation

Persistence and recovery guarantees that must not regress:

- markdown files remain the canonical content source
- Sentry must not persist product state
- draft state remains browser-local and scoped by cluster ID and note ID
- save still requires the expected content hash
- conflict responses still prevent overwriting changed disk content
- failed draft persistence still produces visible degraded recovery state
- recovered drafts remain visible and protected
- stale async responses remain ignored

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
- request IDs, operation IDs, editor session IDs, and UI request sequences are
  diagnostic metadata only
- development test telemetry triggers do not mutate notes, drafts, route state,
  cluster metadata, or filesystem content
- coalescing buffers are cleared on editor session changes

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
- Slice 7A runtime and correlation tests
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

- shared semantic observability event and attribute constants
- frontend observability helpers preserving rich diagnostic payloads
- frontend payload helpers attaching under-limit markdown to
  `azurite.debug_payload` on eligible debug events
- frontend payload helpers replacing over-limit markdown with
  `azurite.payload_truncated_for_size`, original length, content hash, and
  leading/trailing text windows
- backend payload helpers proving the same under-limit and over-limit payload
  carrier behavior through deliberate test events
- web and server telemetry carrier mapping for semantic logs, breadcrumbs,
  spans, tags, context, and errors
- frontend observability helpers coalescing or summarizing high-frequency editor
  updates
- frontend observability helpers clearing coalesced editor buffers when the
  editor session changes
- editor mode/status instrumentation preserving current mode switching
- Milkdown mount/destroy/update instrumentation where current test harness
  support allows it
- Dexie draft read/write/delete success and failure observability
- recovery and degraded persistence observability
- Zustand snapshot capture for explicit error, conflict, stale-response,
  recovery, and deliberate test events
- save/conflict/recovery payload attachment without changing UI or API behavior
- backend route-level payload/error enrichment capturing core outcomes/errors
  without adding Sentry imports or observer hooks to `packages/core`
- development test events proving under-limit and over-limit payload behavior
- existing route, draft, save, conflict, and recovery tests
- Slice 7A runtime and correlation tests

Run manual/browser QA:

- Start Azurite with Slice 7A Sentry env vars enabled.
- Open the Tailscale MagicDNS URL on desktop Chrome.
- Load the note from the Milkdown block-menu bug report.
- Confirm Sentry captures browser replay, API path, request ID, note operation
  ID, note-load breadcrumbs/logs, and backend note-read evidence.
- Confirm replay shows unmasked Milkdown editor text and markdown textarea text.
- Confirm replay shows relevant DOM, focus, selection, and block-menu context
  when available.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Confirm editor semantic breadcrumbs/logs are useful enough to guide the
  follow-up fix slice.
- Confirm draft read/write/delete and recovery evidence appears in Sentry.
- Save a disposable note and confirm save evidence includes editor session ID,
  operation ID, request ID, content hashes, and payload metadata.
- Force a save conflict and confirm conflict evidence includes expected content
  hash, shared API error code, payload metadata, and a relevant state snapshot.
- Trigger deliberate under-limit web and server payload test events and confirm
  whole payloads appear under `azurite.debug_payload`.
- Trigger deliberate over-limit web and server payload test events and confirm
  truncation metadata, original length, content hash, and leading/trailing text
  windows appear.
- Edit a large real note for several minutes and confirm normal editing remains
  responsive, high-frequency markdown updates are coalesced/rate-limited, and
  Sentry remains inspectable.
- Open the same MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.
- Confirm mobile replay includes unmasked note/editor context when Sentry debug
  mode is explicitly enabled.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.

## Acceptance Criteria

- Slice 7A runtime startup, config, disabled-mode, and correlation behavior
  remains intact.
- The Milkdown block-menu bug report can be investigated with Sentry evidence
  instead of only terminal logs.
- Session Replay captures unmasked editor/debug context in explicitly enabled
  local debug sessions.
- Editor lifecycle, focus, selection, transaction, markdown update, block-menu,
  mode, and status events are emitted through shared semantic event names.
- Draft read/write/delete, recovery, degraded persistence, and validation states
  are observable.
- Save, conflict, stale-response, and recovery diagnostics include the
  correlation IDs and semantic context needed to inspect failures.
- Telemetry is mapped intentionally into logs, breadcrumbs, spans, tags, context,
  and errors.
- Eligible payload-bearing debug events use `azurite.debug_payload` as the
  payload carrier.
- Under-limit markdown appears whole in Sentry.
- Over-limit markdown sends truncation metadata, original length, content hash,
  and useful leading/trailing text windows.
- Deliberate web and server test events prove the payload carrier,
  whole-payload path, and truncated-payload path.
- Bounded full-payload capture, rate-limited editor updates, and cleared
  coalescing buffers keep normal editing responsive and Sentry inspectable.
- Backend observability enriches route-level evidence from core outcomes/errors,
  and `packages/core` remains Sentry-free with no new observer contract.
- Sentry-disabled Azurite behaves the same as before Slice 7A and Slice 7B.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Completion Note

When Slice 7B is complete, the original end-to-end Sentry observability master
plan is functionally delivered for the current browser, API, editor, client
state, IndexedDB draft, and filesystem-backed note workflow. Future
observability work should be framed around the next product capability it
serves, such as create/delete, autosave, file watching, indexing/search,
PWA/service-worker behavior, hosting hardening, or release/source-map upload.
