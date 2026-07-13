# Slice 7E: Semantic Editor And Persistence Diagnostics

## Status

Planned and explicitly **not ready for promotion or implementation**.

Promotion to `docs/slices/active/` is a hard gate after Slice 7D implementation,
not a wording, renumbering, or status-edit pass. The person promoting this slice
must inspect the completed Slice 7C route owner and completed Slice 7D code,
tests, architecture, and QA evidence, then revise every affected semantic event,
attribute, state transition, file boundary, implementation task, and proof in
this document. If that evidence is not yet available, this slice stays planned.

The 2026-07-13 resequencing moved URL Selection And History Coherence to Slice
7C, Markdown Fidelity And Honest Dirty State to Slice 7D, this diagnostics work
to Slice 7E, and the immediately following diagnosed editor-correctness repair
to Slice 7F.

This slice depends on Slice 7A: Sentry Runtime Delivery Foundation, Slice 7B:
Request Correlation And Note Route Evidence, Slice 7C: URL Selection And History
Coherence, and Slice 7D: Markdown Fidelity And Honest Dirty State.

Slice 7E completes the full semantic observability promise for the current
editor and persistence workflow after Slice 7A proves Sentry runtime delivery
and disabled-mode safety, Slice 7B proves frontend/backend request correlation
and note route evidence, Slice 7C proves exact route-intent ownership, and Slice
7D distinguishes exact Markdown authority from editor projection while exposing
typed publication/admission, synchronization, durability, cleanup, Discard, and
editor-gate outcomes.

### Mandatory Post-7D Promotion Refresh

Before promotion, all of the following are required and reviewable in the diff:

1. Read Slice 7D completion evidence and inspect the actual exported result
   unions, store state, controller APIs, draft coordinator, Slice 7C gate/outcome
   integration, tests, and files. Do not implement names from this planned
   document when the code chose a different truthful boundary.
2. Replace the provisional semantic event table with events mapped to actual
   product transitions: raw Milkdown projection observation, accepted authority
   publication, immutable snapshot admission, commit, synchronization,
   durability, consistent draft read, draft disposition, cleanup retry, terminal
   Discard, editor gate, and Slice 7C route outcome.
3. Resolve correlation availability by lifecycle. `draft.read.started` occurs
   before editor-session creation and therefore must not require an editor
   session ID. Use the identities actually available at read time—cluster, note,
   route intent/operation, and a draft operation ID—then correlate the resulting
   editor session after creation.
4. Re-audit payload eligibility, coalescing, error capture, and state snapshots
   against exact Slice 7D failure variants. Telemetry must observe product truth;
   it must never convert a failed admission, cleanup, Discard, or gate into a
   successful product transition.
5. Re-run file-line counts and split plans against the post-7D tree. The current
   line estimates and module names below are planning evidence, not permission to
   push an implemented file past 400 lines.
6. Apply Scope Re-selection During Review if implementation introduced another
   capability, workflow, state owner, storage boundary, or independently useful
   outcome. Do not silently annex repair work to diagnostics.
7. Update dependencies, goals, non-goals, architecture, implementation plan,
   negative side-effect guardrails, verification, acceptance criteria, and the
   immediate Slice 7F handoff so they all describe the same implemented truth.
8. Obtain adversarial review of the refreshed document. Promotion is prohibited
   while any required event asks for unavailable identity, collapses raw
   observation into accepted authority, or contradicts Slice 7C/7D outcomes.

The promotion diff must contain substantive contract changes justified by
completion evidence. Changing only slice numbers, tense, file locations, or
status fails this gate.

## Product Decision

Azurite builds rich editor and persistence diagnostics on top of the Slice 7A
Sentry runtime foundation and the Slice 7B request-correlation foundation.

Sentry remains the durable observability platform: event capture, structured
logs, session replay, error grouping, trace correlation, and investigation UI.
Azurite owns semantic instrumentation that explains product behavior inside the
current note editing workflow:

- Milkdown and Crepe lifecycle, focus, selection, raw projection, accepted
  authority, synchronization, commit, and block-menu context.
- Zustand note browser and editor session transitions.
- Ordered draft read/admission/write/cleanup/Discard, exact disposition,
  degraded persistence, and validation states.
- save, conflict, stale-response, and recovery diagnostics with bounded rich
  payload context.
- editor responsiveness and telemetry volume control during real large-note
  editing sessions.

This settles that the Milkdown block-menu QA finding and future editor/persistence
failures should be investigated through replay plus semantic evidence, not by
guessing from terminal logs or one-off console prints.

The 2026-07-10 physical-phone session added a second concrete input:
`docs/qa/mobile-markdown-newline-reversion.md`. Android Enter briefly created a
source-mode newline and then the controlled value reverted it; the same session
also surfaced an unexplained recovered-draft state. Slice 7E must make those
transitions explainable without claiming to fix them.

## User Story

When Azurite feels wrong while Daniel is editing real notes, we can inspect the
actual session in Sentry and understand the editor and persistence path:

- browser replay with unmasked editor/debug content
- route and selected-note context
- Milkdown/Crepe lifecycle, focus, selection, transaction, and block-menu events
- raw projection summaries without high-frequency noise plus uncoalesced
  accepted publication/admission and failure results
- Zustand state transitions relevant to note load, save, conflict, recovery,
  and stale-response handling
- Dexie draft persistence and recovery evidence
- bounded full markdown, draft, or state payload context only where it explains
  a failure or meaningful state transition
- the same request ID and note operation ID established by Slice 7B

## Why This Matters

Slice 7A proves that Azurite can send web/server telemetry. Slice 7B proves that
note reads, saves, and conflicts can be correlated across frontend and backend
route evidence. That is necessary, but it does not yet answer the hardest
current questions:

- Did Milkdown mount correctly?
- Did focus or selection move before the block menu appeared?
- Did Crepe expose enough block-menu state to explain the visual failure?
- Was a raw projection observation accepted as authority, rejected, restored to
  a checkpoint, or classified as synchronization?
- Did an Android source-mode input reach local editor state before a parent,
  editor lifecycle, Zustand, or Dexie transition replaced it?
- Did Dexie fail, recover stale data, or show degraded persistence?
- Did Zustand preserve the right content-dirty and draft-disposition state?
- Why did the phone display recovered-draft state for the newly created
  disposable cluster?
- Did debug telemetry itself make editing a large note feel worse?

Slice 7E makes those questions answerable without creating a parallel product
state system or weakening the file-over-app persistence model.

## Future Workflow Boundary

### Current Workflow

This slice covers the semantic editor and persistence workflow on top of the
Slice 7A runtime foundation and Slice 7B correlation foundation:

1. Daniel starts the local Fastify API and Vite web app with Sentry explicitly
   enabled through local debug configuration.
2. The web app may be opened on desktop Chrome or from a phone over the
   Tailscale MagicDNS URL while the backend stays local-only behind the Vite
   proxy.
3. URL-owned route state selects a note.
4. The frontend reads that note through the Slice 7B correlated API boundary.
5. The Milkdown editor mounts, switches modes, observes focus/selection and
   transaction context, distinguishes accepted source/WYSIWYG changes from
   synchronization projections, and exposes Crepe block-menu context where
   available.
6. Zustand owns live note browser and editor session state.
7. Dexie owns browser-local records while Slice 7D's coordinator orders reads
   and mutations and Zustand owns current-session draft disposition.
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
- a measured lightweight daily Sentry profile that may remain permanently
  enabled while full debug stays deliberate.
- production-like release builds with source-map upload.

Future workflows should reuse the same event naming, request ID, operation ID,
editor session ID, route source, cluster, note, result, payload, and recovery
attributes instead of creating parallel telemetry shapes.

Cluster identity remains the current ready-or-unavailable outcome contract. If
the fresh-cluster recovered-draft investigation cannot be explained without
knowing whether cluster metadata was created, reused, or copied, stop and revise
this slice to introduce the separate domain-level resolution result defined as
an early trigger in `docs/technical-architecture.md`. Otherwise leave that
provenance to the future Cluster Opening And Lifecycle Foundation; do not expose
an internal metadata `missing` state through current note responses.

### Product Layers Participating Now

Slice 7E touches these current layers:

- repository docs and slice notes
- Slice 7B shared observability constants extended for semantic editor and
  persistence events
- `apps/web` observability helpers
- TanStack Router selected-note and dev diagnostics state where it affects
  semantic breadcrumbs
- Zustand note browser store actions and editor session state
- Dexie draft persistence and recovery paths
- Milkdown/Crepe editor lifecycle, raw projection, and authority result hooks
- Saveable note editor status, conflict, cleanup, and draft disposition
- web payload bounds, snapshots, coalescing, and rate limiting
- backend route observability helpers only where bounded payload or richer
  failure context is needed for save/conflict/recovery evidence
- existing `packages/core` filesystem behavior as surfaced by server route
  return values and caught errors
- Vitest unit/integration tests
- manual desktop and mobile Sentry UI verification

### Product Layers Predictably Needed Soon

Slice 7E leaves explicit seams for:

- create/delete editor and route actions.
- autosave and future outbox diagnostics.
- file-watch and external-change evidence.
- derived index/search worker or backend service instrumentation.
- a Cluster Opening And Lifecycle Foundation for user-selected clusters,
  lifecycle provenance, metadata recovery and migration, copied identities,
  external or synced folders, and the workspace-to-cluster terminology
  migration.
- PWA/service-worker telemetry once that runtime exists.
- release/source-map upload for production-like builds.
- a Daily Observability Operating Profile that compares disabled, lightweight
  daily, and full-debug modes after the mandatory editor-correctness fix.
- future auth and local-hosting decision telemetry.

### Deliberately Excluded Layers

These layers are excluded from Slice 7E:

- creating Sentry projects, adding SDK dependencies, or redoing runtime
  configuration already completed by Slice 7A
- replacing the Slice 7A Fastify preload, startup, shutdown, config, Replay, or
  console-capture boundary unless Slice 7E discovers a correctness bug in that
  foundation
- replacing the Slice 7B request ID, note operation ID, request hook, route
  evidence, or scope-isolation boundary unless Slice 7E discovers a correctness
  bug in that foundation
- fixing the Milkdown block-menu bug itself
- fixing the mobile Markdown source-mode newline reversion itself
- lazy-loading, manually rechunking, or replacing the current Milkdown/Crepe
  editor dependency graph; the authoritative deferred loading boundary lives in
  `docs/technical-architecture.md`
- adding new note creation, delete, autosave, search, backlinks, graph, sync, or
  file-watch behavior
- changing the current cluster identity response or broadening core filesystem
  error reasons unless the recovered-draft evidence triggers the explicit early
  cluster-resolution boundary above
- mobile-native and desktop-native apps
- service workers, sync workers, indexing workers, and background jobs that do
  not exist yet
- public production telemetry policy
- enabling a permanent lightweight daily Sentry profile or settling its exact
  sampling, Replay, event, and payload configuration
- custom in-app log viewer
- Sentry self-hosting or billing work
- source-map upload automation that requires Sentry auth tokens
- direct `packages/core` observability hooks, observer interfaces, or Sentry
  imports

The exclusions are stable because Slice 7E's current value is diagnostic
completeness for the existing browser editor, client state, draft persistence,
API, and server route-boundary workflow. It completes the current observability
promise without smuggling in new note lifecycle product behavior.

## Goals

- Instrument the current editor workflow with semantic Sentry logs,
  breadcrumbs, spans, tags, context, and errors.
- Reuse Slice 7B request IDs, note operation IDs, release, environment, surface,
  route, cluster, note, result, and API error attributes.
- Reuse or deliberately wrap the existing editor session identity instead of
  creating a parallel editor identity.
- Capture Milkdown mount, destroy, focus, selection, transaction, raw projection,
  accepted authority publication/admission, synchronization, commit, and
  mode/status changes without collapsing them into one “markdown updated” fact.
- Capture Crepe block-menu open/close behavior and useful context when the
  editor package exposes it.
- Capture ordered draft read/admission/write/cleanup/retry/Discard, validation,
  disposition, and degraded persistence evidence.
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
- Record disabled-versus-full-debug responsiveness and event-volume evidence
  sufficient to design, but not enable, a future lightweight daily profile.

## Non-Goals

- Do not recreate the Sentry projects, dependency decisions, env loading, or
  runtime startup foundation from Slice 7A.
- Do not recreate the request ID, note operation ID, API metadata, backend
  request hook, or route-evidence foundation from Slice 7B.
- Do not fix the Milkdown block-menu bug in this slice.
- Do not fix the mobile Markdown source-mode newline reversion in this slice.
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

## Dependency On Slices 7A Through 7D

Slice 7E assumes Slice 7A has already delivered:

- `@sentry/react` and `@sentry/node` installed in the owning workspaces.
- Web and server Sentry initialization behind typed config modules.
- Root `.env.example` and untracked root `.env.local` workflow.
- Sentry-disabled startup and note workflows verified.
- `azurite-web` and `azurite-server` receiving real events.
- Desktop and mobile/Tailscale Replay delivery.
- Browser console warning/error capture.
- Custom server preload and bounded Sentry-enabled shutdown.
- Direct Sentry calls contained behind web/server observability helpers.

Slice 7E assumes Slice 7B has already delivered:

- Request ID and note operation ID propagation through frontend API calls and
  backend request context.
- Shared observability constants and route constants in `packages/shared`.
- Basic note read/save/conflict route-boundary evidence.
- Closure-owned browser operation context, decorated Fastify request context,
  explicit event attributes, and event-local Sentry scope isolation.
- Overlapping note-read and stale-response tests.

Slice 7E assumes Slice 7C has already delivered:

- unique identity for every route intent, including repeated same-note history;
- one latest-intent owner and exact-current continuation checks;
- selected-versus-rendered and active-load ownership predicates;
- typed pre-transition gate and terminal route outcomes; and
- deterministic overlap, cancellation, and URL-repair evidence.

Slice 7E assumes Slice 7D has already delivered:

- exact Markdown authority separated from Milkdown's serialized projection;
- typed raw projection, accepted change, publication/snapshot admission, commit,
  synchronization, durability, cleanup, Discard, and editor-gate seams;
- synchronization checkpoints that do not create dirty state or drafts;
- one shared dirty-comparison contract plus exact draft disposition;
- consistent ordered draft reads/mutations and terminal Discard ownership; and
- regression coverage for pristine mount, mode switching, rapid rich edits,
  source synchronization, partial publication, cleanup failure, stale editor
  instances, recovery, and Discard success/failure.

Slice 7E must instrument accepted changes and synchronization truthfully. It
must not relabel a suppressed projection echo as user input or reintroduce a
parallel dirty-state decision for telemetry.

If any foundation is missing or differs materially, Slice 7E stays planned.
Apply the mandatory refresh and Scope Re-selection During Review; reopen the
owning prerequisite when it has a correctness defect rather than hiding repair
inside instrumentation.

## Architecture

### Semantic Event Contract

Slice 7E extends the shared event vocabulary established by Slice 7B on top of
the Slice 7A runtime helper surface. Event names remain lower-case dot-separated
product vocabulary. Event names describe Azurite behavior, not Sentry mechanics.

Every started event has a matching truthful terminal result when that lifecycle
exists. Event attributes use shared constants for common fields. Started/result
pairs map to actual Slice 7C/7D result variants; telemetry does not infer
success from a callback returning or a state value changing.

The following table is a **provisional semantic coverage map**, not an approved
implementation vocabulary. The mandatory post-7D refresh must replace names and
attributes with the actual exported contracts before promotion.

| Provisional event family               | Identity available at that lifecycle                                                                                 | Required semantic distinction                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `editor.milkdown.lifecycle.*`          | note ID, editor session ID, instance generation                                                                      | creating, ready, failed, destroyed, destroy reason                                                                                       |
| `editor.milkdown.focus_or_selection.*` | note ID, editor session ID                                                                                           | focus/selection summary without changing authority                                                                                       |
| `editor.milkdown.transaction.observed` | note ID, editor session ID                                                                                           | raw transaction observation only                                                                                                         |
| `editor.projection.observed`           | note ID, editor session ID, projection hash/length                                                                   | raw serialized projection; never synonymous with accepted edit                                                                           |
| `editor.authority.publication.*`       | note ID, editor session ID, origin, trigger, revision when admitted                                                  | acknowledged, no-change, rejected; state ownership and immutable snapshot admission are separate evidence fields                         |
| `editor.synchronization.*`             | note ID, editor session ID, synchronization cause                                                                    | synchronized, no-change, failed; never dirty by itself                                                                                   |
| `editor.commit.*`                      | note ID, editor session ID, commit cause                                                                             | acknowledged, no-change, failed projection/publication                                                                                   |
| `editor.mode.changed`                  | note ID, editor session ID                                                                                           | previous/next mode plus synchronization result                                                                                           |
| `editor.gate.*`                        | gate lease, outgoing note/session ID and gate cause; route intent only on Slice 7C's separate route event            | continue/cancel, per-lease settlement status/surface effect, and shared-operation correlation without making the editor gate route owner |
| `editor.crepe.block_menu.*`            | note ID, editor session ID                                                                                           | opened/closed and available menu context                                                                                                 |
| `draft.read.*`                         | cluster ID, note ID, draft operation ID, route/selection operation when available; **no required editor session ID** | consistent-read start/result, presence, validation, failure reason, later-created session correlation                                    |
| `draft.snapshot.admission.*`           | note ID, editor session ID, draft epoch, revision; cluster ID only when preparation reached a ready identity         | prepared/committed/cancelled or rejected before state mutation; subscriber-after-apply evidence                                          |
| `draft.write.*`                        | cluster ID, note ID, editor session ID, revision                                                                     | started, durable, superseded, failed                                                                                                     |
| `draft.durability.*`                   | cluster ID when available, note ID, editor session ID, revision, snapshot key, disposition                           | clean, durable, unavailable with exact Slice 7D reason                                                                                   |
| `draft.cleanup.*`                      | cluster ID, note ID, editor session ID, saved/generated revision                                                     | generated-clean or saved-snapshot cleanup; succeeded, superseded, failed/cleanup-required                                                |
| `draft.cleanup_retry.*`                | cluster ID, note ID, editor session ID, disposition                                                                  | completed, superseded, failed without filesystem Save                                                                                    |
| `draft.discard.*`                      | cluster ID, note ID, editor session ID when one exists, recovery kind                                                | terminal barrier admitted, delete completed, superseded, failed/no reload                                                                |
| `draft.disposition.changed`            | cluster ID, note ID, editor session ID                                                                               | exact previous/next disposition and cause                                                                                                |
| `recovery.visible`                     | note ID, cluster ID when available, editor session ID after creation                                                 | recovered, conflict, cleanup-required, or persistence-unavailable UI truth                                                               |

Slice 7E may enrich Slice 7B note load/save/conflict events with payload context
where the volume contract allows it. It must not rename the Slice 7B events or
fork their attribute shapes.

Backend semantic events:

| Event                             | Required attributes                                                   |
| --------------------------------- | --------------------------------------------------------------------- |
| `note.read.succeeded`             | 7B attributes plus eligible markdown payload summary                  |
| `note.read.failed`                | 7B attributes plus caught core error context                          |
| `note.save.started`               | 7B attributes plus eligible markdown payload summary                  |
| `note.save.conflicted`            | 7B attributes plus expected hash, API error code, payload summary     |
| `note.save.failed`                | 7B attributes plus caught error context and payload summary when used |
| `telemetry.server.test.triggered` | request ID, release, environment, surface, payload test state         |

Slice 7E enriches the truthful 7B note route result that observed a cluster or
filesystem failure. It does not reintroduce a standalone
`cluster.metadata.failed` event or invent filesystem provenance unavailable at
the route boundary.

### Replay Configuration Boundary

Session Replay runs for explicitly enabled local debug sessions. Slice 7A
installs the runtime Replay configuration. Slice 7E verifies and adjusts the
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

Spans measure operations with duration: note load, consistent draft read,
durability drain, write/cleanup/Discard, Save, frontend API calls, backend
request handling, and server route-boundary work that calls into cluster
metadata and filesystem-backed core helpers. Spans
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

Browser request, operation, and editor context stays closure- or session-owned
and is passed as explicit event attributes. It must never be installed on the
browser global/isolation scope. Backend request context remains owned by the
decorated Fastify request. Sentry `withScope` usage is event-local so note IDs,
markdown, and operation IDs cannot leak into unrelated events.

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

Uncensored does not mean noisy enough to become useless. Slice 7E defines when
full payloads are sent.

Volume requirements:

- High-frequency raw `editor.projection.observed` evidence records note ID,
  editor session ID, projection length/hash, and available transaction summary.
  It does not claim a product revision or dirty status before publication.
- Accepted publication/admission, commit, synchronization, disposition, cleanup,
  Discard, and gate outcomes bypass raw-projection coalescing because each is a
  meaningful product result.
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
- Draft payloads are attached for eligible consistent-read, admission, write,
  cleanup, retry, or Discard failures and recovery/disposition states, not for
  every successful scheduled write.
- Zustand snapshots are attached for explicit error, conflict, stale-response,
  recovery, or deliberate test events.
- Repeated high-frequency editor updates are rate-limited, coalesced, or logged
  with metadata-only attributes.
- `editor.projection.observed` emits at most one metadata-only log per
  editor session per second during continuous typing, plus explicit result
  events for publication/admission, synchronization, commit, Save, conflict,
  disposition, cleanup, Discard, gate, mode, and deliberate test events.
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
- Capture raw projection metadata with coalescing, then observe the Slice 7D
  typed publication/admission result separately. Never derive accepted authority
  from the raw listener event.
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
- Consistent read, snapshot admission, write, cleanup, cleanup retry, terminal
  Discard, disposition change, and durability outcomes record started/result
  evidence that matches Slice 7D's actual variants.
- Draft reads use cluster/note plus their operation/route identity. They do not
  require the editor session ID that is created only after the read settles.
- Draft validation failures and database-unavailable states remain visible in
  the UI and become visible in Sentry.
- Save/conflict/recovery diagnostics reuse the existing content-hash contract.
- Observability helpers do not mutate editor, draft, route, save, or cluster
  state.

### Core And Filesystem Boundary

`packages/core` remains Sentry-free in this slice.

Server routes may enrich Slice 7B route-level evidence from core calls and
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
7E must split files before adding semantic instrumentation where needed.

Pre-7C/7D planning-time pressure points, all of which must be recounted during
the hard promotion refresh:

- `apps/server/src/notes-route.ts`: 379 lines;
- `apps/web/src/components/MilkdownEditor.tsx`: 382;
- `apps/web/src/state/note-browser-route-actions.ts`: 314;
- `apps/web/src/state/note-browser-editor-actions.ts`: 314;
- `apps/web/src/state/note-browser-action-utils.ts`: 310;
- `apps/web/src/observability/web-runtime-observability.ts`: 299;
- `apps/web/src/state/note-browser-store.ts`: 271;
- `apps/web/src/persistence/draft-database.ts`: 243; and
- `apps/web/src/components/NoteEditorSurface.tsx`: 223.

The implementation should extract focused helpers for editor instrumentation,
draft instrumentation, state snapshots, payload bounds, coalescing, and backend
payload enrichment instead of appending logs to already-large modules.

## Implementation Plan

### 1. Execute The Promotion Refresh And Confirm Slices 7A Through 7D

Before adding semantic instrumentation, complete the mandatory post-7D promotion
refresh and confirm all four prerequisite foundations are present.

Implementation requirements:

- Verify web and server Sentry initialization modules exist and are used.
- Verify shared event, attribute, route, and correlation constants exist.
- Verify request ID and note operation ID propagation tests exist.
- Verify Sentry-disabled startup and note workflow tests exist.
- Verify runtime note read/save/conflict observability helpers exist.
- Verify overlapping note-read, concurrent server-request, stale-response, and
  unrelated-event context-isolation tests exist.
- Verify Slice 7C's route-intent, gate, terminal-outcome, and overlap tests exist.
- Inspect and record Slice 7D's actual exported result unions, draft disposition,
  coordinator operations, controller lifecycle, cleanup/Discard outcomes, and
  file ownership. Replace every provisional event below before promotion.
- Prove every proposed required identity exists at its event lifecycle,
  especially pre-session draft reads.
- Do not proceed by creating a parallel Sentry setup path.

### 2. Extend Shared Semantic Constants

Extend the shared observability vocabulary for editor, draft, recovery, payload,
and snapshot diagnostics.

Implementation requirements:

- After the hard-gate refresh, add shared event names for raw editor observation,
  accepted authority, synchronization, commit, gate outcomes, Crepe behavior,
  ordered draft persistence, disposition, cleanup, Discard, and recovery.
- Add shared attribute names for editor session ID, editor mode, focus state,
  selection summary, transaction summary, markdown length, payload kind, payload
  size, truncation status, snapshot kind, draft updated time, and persistence
  unavailable reason.
- Add shared result statuses only when they are reusable across web/server
  events.
- Add beginner-readable TSDoc for exported constants.
- Add tests proving semantic event names do not drift from the refreshed Slice
  7E contract or collapse distinct Slice 7C/7D outcomes.

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
- Reuse Slice 7B release, environment, surface, request ID, operation ID, note
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
- Observe actual Slice 7D raw projection, accepted publication/admission,
  synchronization, commit, editor-gate, and Slice 7C terminal route outcomes as
  separate result unions. Do not reconstruct those classifications from Zustand
  snapshots.
- Add tests proving instrumentation does not mutate editor state or break
  current mode switching.

### 6. Instrument Ordered Draft Persistence And Recovery

Add semantic diagnostics around draft persistence.

Implementation requirements:

- Emit consistent-read, snapshot-admission, write, cleanup, cleanup-retry,
  terminal-Discard, and disposition-change events from the implemented Slice 7D
  boundary.
- Emit recovery-visible events for recovered, conflict, cleanup-required, and
  unavailable states.
- Emit degraded recovery-visible events for database unavailable or validation
  failure states.
- Attach note ID, cluster ID, draft operation ID, draft presence, updated time,
  dirty status, disposition, base content hash, revision, and exact failure
  reason where available. Attach editor session ID only after one exists; link
  pre-session reads through route/selection/draft operation identity.
- Attach draft payloads only for eligible failure or recovery states according
  to the volume contract.
- Preserve Dexie as the draft persistence owner.
- Preserve UI visibility for degraded draft and validation states.
- Add tests for successful, superseded, and failed reads/mutations; cleanup
  required/retry; Discard no-reload failure; later session correlation; recovery
  visibility; and disabled Sentry behavior.

### 7. Instrument Milkdown And Crepe Behavior

Add semantic diagnostics around the editor package boundary.

Implementation requirements:

- Emit Milkdown mounted and destroyed events.
- Emit focus changed events.
- Emit selection changed summaries.
- Emit observable ProseMirror transaction summaries.
- Emit coalesced raw projection metadata and uncoalesced accepted
  publication/admission, synchronization, and commit results.
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

- Enrich Slice 7B save started/succeeded/conflicted/failed events with editor
  session ID and payload summary attributes.
- Attach full markdown only to eligible save start, save conflict, save failure,
  and deliberate test events according to the volume contract.
- Attach Zustand snapshots for explicit conflict, stale-response, recovery,
  cleanup-required, Discard failure, degraded, or deliberate test events.
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

- Reuse Slice 7B backend route events and correlation context.
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

- Raw `editor.projection.observed` emits at most one metadata-only log per
  editor session per second during continuous typing.
- Publication/admission, synchronization, commit, Save, conflict, disposition,
  cleanup, Discard, gate, mode, and deliberate test events bypass the
  high-frequency raw-projection coalescer.
- Coalesced buffers, timers, and pending metadata are cleared when the editor
  session changes.
- Stale note content cannot be emitted under a new note ID.
- Tests prove rate limiting and session-change cleanup.

### 12. Refactor Before Instrumenting Near-Limit Files

Split files before adding semantic observability to modules that are already
close to the 400-line hard limit.

Implementation requirements:

- Keep every code file at 400 lines or fewer.
- Recount the post-Slice-7D tree and replace the planning-time list above in the
  promotion diff. Allocate a named extraction for every touched file whose
  projected change would approach the limit.
- Extract frontend store/editor observability helpers before expanding route
  actions, editor actions, action utilities, store, draft database,
  `NoteEditorSurface`, `web-runtime-observability`, or `MilkdownEditor`.
- Extract backend payload enrichment helpers before expanding route handlers.
- Preserve existing tests while adding focused tests for extracted helpers.

### 13. Verify With Rich Runtime QA

Run automated validation and then verify through Sentry UI.

Required QA:

- Run the full desktop/Pixel 6, Vite-development/optimized-production,
  Sentry-disabled/full-debug eight-cell matrix through the shared Playwright
  runbook. Enabled cells require authenticated Sentry inspection; disabled cells
  require zero Sentry transport and identical product outcomes.
- Apply the semantic-event and Replay inspection bullets below to enabled cells.
  In disabled cells, repeat the same product workflows and assert zero Sentry
  transport instead of expecting telemetry.
- In every cell run the same scripted large-note input workload after readiness:
  at least three two-minute trials, identical edit count/content, and the same
  CPU/device profile. Record input-to-next-paint p50/p95, long tasks, heap delta,
  Sentry request bytes/count, raw-projection event count, and uncoalesced product
  result count.
- Full debug passes responsiveness when the median of its three trial p95
  input-to-next-paint values is no more than 20 ms higher and no more than 25%
  above the matching disabled median, stays below 100 ms on desktop and 150 ms
  on synthetic Pixel 6, adds no telemetry-attributable long task above 100 ms,
  and preserves every accepted product result. If browser
  timing support cannot measure the named metric reliably, pause and refresh the
  metric/threshold before promotion rather than replacing it with “felt fine.”
- Prove raw projection evidence respects the one-per-session-per-second contract
  while accepted publication, commit, synchronization, cleanup, Discard, gate,
  save, conflict, and failure results are not lost to coalescing.
- Load the note from the Milkdown block-menu bug report.
- Load a disposable note from the mobile Markdown newline QA report.
- Confirm Sentry captures the browser session, console warnings/logs, API
  request path, request ID, note operation ID, note-load evidence, and backend
  note-read evidence inherited from Slice 7B.
- Confirm replay shows unmasked editor text, markdown textarea text, relevant
  DOM state, focus context, selection context, and block-menu context where
  available.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Reproduce or attempt to reproduce Android Enter being reverted in Markdown
  source mode and confirm the semantic evidence identifies the state transition
  that replaced it.
- Reproduce or rule out recovered-draft state for a fresh cluster identity
  before a deliberate edit.
- Confirm editor breadcrumbs and logs are useful enough to decide the next fix
  slice.
- Confirm consistent reads, snapshot admission, writes, cleanup/retry, Discard,
  and disposition/recovery states appear in Sentry with lifecycle-valid IDs.
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
  responsive, high-frequency raw projection observations are
  coalesced/rate-limited, accepted results remain intact, and Sentry remains
  inspectable.
- Open the same configured origin in the synthetic Pixel 6 browser context and
  confirm its enabled Replay is distinct and includes unmasked note/editor
  context. A physical Android or Tailscale run remains optional supplemental
  evidence Daniel may request.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

Slice 7E must preserve existing product behavior while adding semantic
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
- Slice 7B request ID and note operation ID correlation

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
- Slice 7A runtime tests
- Slice 7B correlation tests
- Sentry-disabled app startup and note workflow
- Sentry-enabled app startup and note workflow
- full desktop/Pixel 6 development/production enabled/disabled browser matrix
- `/opt/homebrew/bin/pnpm validate`
- `/opt/homebrew/bin/pnpm build`
- `git diff --check`

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
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
- ordered draft read/admission/write/cleanup/Discard success, supersession, and
  failure observability
- draft disposition, recovery, cleanup-required, and degraded persistence
  observability
- Zustand snapshot capture for explicit error, conflict, stale-response,
  recovery, and deliberate test events
- save/conflict/recovery payload attachment without changing UI or API behavior
- backend route-level payload/error enrichment capturing core outcomes/errors
  without adding Sentry imports or observer hooks to `packages/core`
- development test events proving under-limit and over-limit payload behavior
- existing route, draft, save, conflict, and recovery tests
- Slice 7A runtime tests
- Slice 7B correlation tests

Run the Step 13 eight-cell manual/browser QA and responsiveness protocol; the
following semantic checks apply within that matrix:

- Start Azurite with Slice 7A Sentry env vars enabled or explicitly disabled for
  the current matrix cell.
- Open the configured desktop or synthetic Pixel 6 origin in Vite development
  and optimized production as required by the cell.
- In enabled cells, perform the Sentry event, payload, and Replay assertions
  below. In disabled cells, repeat the product workflows while asserting zero
  Sentry transport and identical product outcomes.
- Load the note from the Milkdown block-menu bug report.
- Load a disposable note from the mobile Markdown newline QA report.
- Confirm Sentry captures browser replay, API path, request ID, note operation
  ID, note-load breadcrumbs/logs, and backend note-read evidence.
- Confirm replay shows unmasked Milkdown editor text and markdown textarea text.
- Confirm replay shows relevant DOM, focus, selection, and block-menu context
  when available.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Reproduce or attempt to reproduce Android Enter being reverted in Markdown
  source mode and inspect the source-input, editor lifecycle, Zustand, and Dexie
  evidence around the reversion. Synthetic Pixel 6 emulation is the completion
  gate but does not claim to reproduce a physical Android IME.
- Reproduce or rule out recovered-draft state for a fresh cluster identity
  before a deliberate edit.
- Confirm editor semantic breadcrumbs/logs are useful enough to guide required
  Slice 7F.
- Confirm ordered draft read/admission/write/cleanup/Discard and disposition
  evidence appears in Sentry.
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
  responsive, high-frequency raw projection observations are
  coalesced/rate-limited, accepted results remain intact, and Sentry remains
  inspectable.
- Confirm the synthetic Pixel 6 context appears as a distinct enabled Sentry web
  session and its Replay includes unmasked note/editor context.
- Confirm the backend remains local-only while the frontend proxies API
  requests. A physical Android or Tailscale run remains optional supplemental
  evidence Daniel may request.

## Acceptance Criteria

- Slice 7A runtime startup, config, and disabled-mode behavior, plus Slice 7B
  correlation behavior, remain intact.
- The Milkdown block-menu bug report can be investigated with Sentry evidence
  instead of only terminal logs.
- The mobile Markdown newline reversion and fresh-cluster recovered-draft
  observation can be investigated with Sentry evidence instead of inference
  from the visible UI alone.
- Session Replay captures unmasked editor/debug context in explicitly enabled
  local debug sessions.
- Editor lifecycle, focus, selection, raw projection, accepted
  publication/admission, synchronization, commit, gate, block-menu, mode, and
  status events are emitted through refreshed shared semantic event names.
- Ordered draft read/admission/write/cleanup/retry/Discard, disposition,
  recovery, degraded persistence, and validation states are observable.
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
- Completion evidence satisfies the Step 13 A/B thresholds and records raw
  measurements plus the disabled-versus-full-debug event-volume baseline needed
  to evaluate a future lightweight daily mode.
- Backend observability enriches route-level evidence from core outcomes/errors,
  and `packages/core` remains Sentry-free with no new observer contract.
- Sentry-disabled Azurite preserves the completed Slice 7A through Slice 7D
  behavior exactly.
- The eight-cell desktop/Pixel 6, development/optimized-production,
  disabled/full-debug matrix passes with authenticated enabled evidence and zero
  disabled transport.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, and
  `git diff --check` pass.
- The repository is clean and pushed on `main`.

## Immediate Handoff To Slice 7F Editor Correctness

Slice 7F, the first product slice after 7E, must fix the mobile Markdown
source-mode newline reversion recorded in
`docs/qa/mobile-markdown-newline-reversion.md`. No unrelated feature slice
should intervene.

Slice 7F must:

- use the Slice 7A runtime, Slice 7B request/note-operation correlation, Slice
  7C route owner/gate/outcomes, and Slice 7D Markdown-authority contract together
  with Slice 7E editor, Zustand, Dexie, payload, and Replay evidence;
- convert the observed state-transition evidence into a durable ownership and
  lifecycle correction rather than a mobile-keyboard special case;
- satisfy the acceptance boundary and negative side-effect guardrails in the QA
  report;
- prove the repair with automated controlled-state tests, desktop regression
  tests, and synthetic Pixel 6 Playwright QA; any physical Android session is
  optional supplemental evidence Daniel may request; and
- preserve manual-save conflicts, draft durability, WYSIWYG/Markdown
  round-tripping, URL navigation, and Sentry-disabled behavior.

The exact Slice 7F implementation plan must be written from the evidence
captured by 7E. This committed sequence sets the priority and outcome now
without guessing at the root cause before the diagnostic foundation exists.

Slice 7E must observe and measure the current statically loaded editor lifecycle
rather than introduce the deferred lazy-loading boundary in
`docs/technical-architecture.md`. Its evidence should leave mount and readiness
timing understandable so a later focused performance slice can compare the
loading architectures after the required correctness fix.

If the evidence shows that created, reused, or copied cluster identity
participates in the recovered-draft failure, the responsible 7E revision or
immediate Slice 7F fix must establish and test the separate resolution contract
before claiming the behavior is understood. If it does not participate, cluster
lifecycle provenance remains deferred to its dedicated foundation.

## Completion Note

When Slice 7E is complete, Sentry observability is functionally delivered for
the current browser, API, editor, client state, IndexedDB draft, and
filesystem-backed note workflow. Future
observability work should be framed around the next product capability it
serves, such as create/delete, autosave, file watching, indexing/search,
PWA/service-worker behavior, hosting hardening, or release/source-map upload.
The immediate editor-correctness handoff above takes priority over those later
capabilities.

After that mandatory fix, a focused Daily Observability Operating Profile may
use the 7E evidence to compare disabled, lightweight daily, and full-debug
configuration. It may keep the lightweight profile permanently enabled for
Daniel only when measured editor responsiveness, memory, network, and event
volume are negligible in daily use. Full debug remains deliberate and
exhaustive; completely disabled startup remains a supported baseline.

The first create/rename/move/delete/trash, file-watch/indexing, or multi-cluster
filesystem capability must also introduce the richer stable core/shared error
taxonomy required for its distinct recovery and security outcomes. This work
must precede hardened multi-device or authenticated path-affecting operations
and must not be implemented as telemetry-only classification.
