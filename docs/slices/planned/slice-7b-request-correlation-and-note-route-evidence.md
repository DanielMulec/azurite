# Slice 7B: Request Correlation And Note Route Evidence

## Status

Planned and implementation-ready after reconciliation on 2026-07-10. Keep this
document in `docs/slices/planned/` until Daniel reviews the revised decisions and
explicitly approves promotion. Promotion and implementation are separate from
this planning revision.

Slice 7A is complete and archived in
`docs/slices/archive/slice-7a-sentry-runtime-delivery-foundation.md`. Its desktop
and physical-phone runtime evidence is now an implemented dependency, not a
future prerequisite. Slice 7C remains planned in
`docs/slices/planned/slice-7c-semantic-editor-and-persistence-diagnostics.md`.

The physical-phone session also recorded the mobile Markdown newline reversion
and unexplained recovered-draft state in
`docs/qa/mobile-markdown-newline-reversion.md`. Slice 7B must preserve those
findings without diagnosing or fixing them. Mobile save-correlation QA will use
a disposable WYSIWYG edit because that path was proven to complete on the phone.

## Product Decision

Azurite will own semantic request and note-operation correlation independently
of Sentry trace sampling while continuing to use Sentry as the investigation
platform.

The durable boundary is:

- one Azurite request ID identifies one HTTP attempt;
- one note operation ID identifies one note-load or manual-save intent and can
  survive future retry attempts;
- existing numeric Zustand request counters remain UI stale-response sequences,
  not distributed correlation IDs;
- browser actions create explicit operation context and pass it through the
  typed API boundary;
- a Fastify request decoration owns validated server correlation context;
- web and server events carry correlation attributes explicitly rather than
  relying on mutable global Sentry scope;
- the existing Slice 7A tracing, Replay, preload, console, and shutdown runtime
  remains intact;
- note list, read, save, conflict, validation, and unexpected route outcomes are
  observable without changing API bodies or filesystem behavior.

Slice 7B does not instrument Milkdown, Crepe, Zustand snapshots, Dexie draft
semantics, or rich payloads. Slice 7C will add those layers on this correlation
contract.

## User Story

When Daniel loads or saves a note with Sentry debug mode enabled, he can take the
request ID and note operation ID from the browser evidence and find the matching
Fastify route evidence, even when the distributed Sentry trace is unavailable or
sampled out.

When requests overlap, a stale response remains attached to the operation that
created it. A later note, request, or unrelated runtime event does not inherit
the earlier operation's metadata.

When Sentry is disabled or correlation ID generation degrades, Azurite still
lists, reads, edits, saves, detects conflicts, recovers drafts, routes by URL,
and works through the Tailscale frontend proxy with the same product API
responses as before this slice.

## Why This Matters

Slice 7A proved delivery: Sentry can initialize only when enabled, receive real
web/server events and logs, show unmasked desktop and phone Replays, propagate
trace headers through Vite, and flush within a bounded shutdown path. Delivery
alone does not prove that a browser load, backend read, stale response, save, or
conflict belongs to one user intent.

Slice 7B supplies that missing semantic join. It also prevents Slice 7C from
inventing its own identity, scope, and route event shapes while diagnosing the
known Milkdown, Markdown source, Zustand, and IndexedDB behavior.

## Reconciled Implementation Baseline

This plan is based on the implemented repository rather than the pre-7A
proposal. The implementation must extend these facts:

- `packages/shared/src/runtime-observability.ts` owns the Sentry-free runtime
  event shape, scalar attribute shape, 7A event names, and common attributes.
- `apps/web/src/observability/web-runtime-observability.ts` and
  `apps/server/src/observability/server-runtime-observability.ts` are the only
  feature-facing Sentry adapters. Disabled mode is a synchronous no-op and spans
  execute their callback directly.
- Helper-emitted logs and errors use event-local `withScope` calls. The adapters
  add environment, release, and `app.surface`; record helpers emit a structured
  log plus breadcrumb, capture helpers emit an error log plus exception, and
  span helpers add scalar attributes.
- Browser initialization dynamically imports the enabled runtime before render.
  Replay is explicitly unmasked for local debug sessions.
- `apps/server/src/sentry-preload.mjs` gates the Node SDK import and initializes
  the supported Fastify 5 integration before Fastify is imported. Slice 7B does
  not add `setupFastifyErrorHandler` or a second initialization path.
- Vite already propagates `sentry-trace` and `baggage` through the relative API
  proxy. Those headers complement but do not replace Azurite IDs.
- Graceful shutdown closes Fastify before the enabled Sentry flush and preserves
  the implemented bounded flush/fallback budgets. Slice 7B adds no lifecycle
  work after shutdown begins.
- `apps/web/src/api-client.ts` is the centralized fetch and API-error boundary.
- `apps/web/src/state/note-browser-contracts.ts` defines the injected
  `NoteBrowserApi` boundary used by Zustand actions and tests.
- `noteRequestId` and `notesRequestId` in the note-browser runtime are numeric
  stale-response guards. Their current names are ambiguous and must be renamed
  before distributed request IDs are introduced.
- `packages/shared/src/cluster.ts` exposes only `ready` or `unavailable` cluster
  identity results. The server route cannot truthfully distinguish whether
  cluster metadata was read from disk or created during the call.
- Current core-to-route error mapping exposes stable API outcomes, but does not
  preserve a distinct filesystem-boundary rejection subtype at the route.
- `packages/core` owns filesystem truth and remains Sentry-free.
- The phone uses the MagicDNS frontend over HTTP while Fastify remains bound to
  localhost. Browser UUID generation therefore cannot depend only on APIs that
  require a secure context.

## Future Workflow Boundary

| Boundary               | Required decision                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current workflow       | Correlate note list, URL-driven read, manual save, conflict, failure, and stale-response evidence from browser intent through the relative Vite API call to the Fastify route result.                                                            |
| Predictable extensions | Slice 7C editor/draft diagnostics and later retry, autosave, create, delete, file-watch, and indexing work reuse the request-attempt and operation-intent distinction.                                                                           |
| Participating layers   | Shared schemas/constants, browser correlation helper, Zustand note actions, typed `NoteBrowserApi`, web API client, web/server observability adapters, Fastify request hook and note routes, existing core results, tests, and desktop/phone QA. |
| Near-term seams        | Typed API metadata, immutable browser operation context, decorated Fastify request context, shared event/attribute vocabulary, and explicit event attributes leave room for editor session IDs and multiple request attempts per operation.      |
| Exclusions             | Editor/draft semantics, rich payloads, retries, autosave, new note lifecycle behavior, core observers, and runtime setup can wait because the current workflow gains a complete correlation join without them.                                   |

## Goals

- Establish shared UUID, header, correlation metadata, event, attribute, result,
  and route constants.
- Give every current web API attempt a fresh request ID when browser secure
  randomness is available.
- Give every note-read and manual-save intent a fresh note operation ID when
  browser secure randomness is available.
- Pass identifiers through explicit TypeScript parameters and HTTP headers.
- Validate correlation headers once in an early Fastify request hook and expose
  an immutable request-scoped context to routes.
- Generate a trusted server request ID when the client request ID is missing or
  invalid; never invent a semantic note operation ID on the server.
- Rename local numeric request counters so their UI sequencing purpose is
  unmistakable.
- Emit truthful frontend API, note load/save, stale, and route evidence.
- Emit truthful backend note list/read/save outcomes using the current shared
  API and cluster-identity contracts.
- Keep operation context isolated across overlapping requests and stale
  responses.
- Prove the same request and operation IDs in exact desktop and physical-phone
  Sentry evidence.
- Preserve all Sentry-disabled and existing product behavior.

## Non-Goals

- Do not reimplement or reconfigure Sentry initialization, projects, Replay,
  console capture, trace propagation, preload behavior, or shutdown flushing.
- Do not add a retry mechanism. The identity contract merely supports future
  retries without redesign.
- Do not fix the mobile Markdown newline reversion, recovered-draft observation,
  or existing Milkdown/Crepe interaction finding.
- Do not add Milkdown, ProseMirror, Crepe, Zustand snapshot, Dexie lifecycle, or
  editor-session instrumentation.
- Do not add full markdown, draft, request-body, response-body, or state payload
  carrier machinery. Slice 7C owns bounded rich payloads.
- Do not change note response schemas, error response schemas, status codes, or
  content-hash conflict behavior.
- Do not echo correlation IDs in response headers or bodies.
- Do not treat diagnostic IDs as authentication, authorization, idempotency,
  product identity, or persistence keys.
- Do not add Sentry imports, telemetry state, observer interfaces, or callbacks
  to `packages/core`.
- Do not add source-map upload, production telemetry policy, a custom log viewer,
  a service worker, or native-app telemetry.

## Dependency On The Finished Slice 7A Runtime

Slice 7B reuses the following proven 7A behavior exactly:

- `@sentry/react` and `@sentry/node` 10.64.0 in their owning workspaces;
- typed enabled-only web/server configuration and ignored root `.env.local`;
- enabled-only web dynamic import and server conditional ESM preload;
- supported Fastify 5 diagnostics-channel integration initialized before
  Fastify;
- web/server structured logs, event capture, spans, low-cardinality runtime
  tags, release, environment, and surface context;
- unmasked browser Replay and warning/error console capture;
- `sentry-trace` and `baggage` propagation through the Vite proxy;
- Fastify/Pino logging alongside Sentry;
- bounded server flush and shutdown ordering;
- shared Sentry-free runtime event contracts and typed helper extension surface;
- verified desktop, Tailscale, and physical-phone runtime delivery;
- a frontend bound only to the selected Tailscale interface for phone QA while
  Fastify stays on `127.0.0.1`.

If implementation discovers a real 7A correctness defect, stop and revise this
plan before changing that foundation. A desire for different helper ergonomics
is not permission to duplicate the runtime.

## Architecture

### Identity Semantics And Ownership

The three current identity classes are deliberately different:

| Identity                      | Format           | Owner                                                                                  | Lifetime                            | Meaning                                                                         |
| ----------------------------- | ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| `azurite.request_id`          | UUID v4          | Browser action for normal web calls; Fastify fallback for missing/invalid client input | One HTTP attempt                    | Joins browser API evidence to one Fastify request.                              |
| `azurite.note_operation_id`   | UUID v4          | Browser note load/save action                                                          | One note-read or manual-save intent | Joins all evidence for one semantic note operation and may span future retries. |
| `azurite.ui_request_sequence` | Positive integer | Zustand note-browser runtime                                                           | One local list/read sequencing step | Determines whether an async response is still current; never crosses HTTP.      |

Fastify's built-in `request.id` remains a separate server logging identifier.
Slice 7C's `azurite.editor_session_id` remains a separate browser editor
identity. Cluster IDs, note IDs, content hashes, and draft keys retain their
existing product meanings.

The browser action creates an immutable context immediately before an API call:

```ts
type ApiRequestMetadata = {
  readonly requestId?: string;
  readonly noteOperationId?: string;
};
```

The action retains that same value in its async closure for lifecycle and stale
result events. The API client serializes it but does not read or mutate a hidden
module-global "current operation." Injected test APIs receive the same typed
metadata.

`listNotes` receives a request ID only. `readNote` and `saveNote` receive both a
request ID and a note operation ID. A future retry must create a new request ID
while retaining the originating operation ID.

### UUID Generation And Degraded Behavior

The web correlation helper uses this exact order:

1. Call `globalThis.crypto.randomUUID()` when it exists and is callable.
2. Otherwise create an RFC 4122 version-4 UUID from 16 bytes produced by
   `globalThis.crypto.getRandomValues()` and set the required version/variant
   bits.
3. Never use `Math.random`, timestamps, counters, note content, or hashes.
4. If no cryptographically secure browser source is available, return
   `undefined`, emit `correlation.id_generation.failed` when the runtime is
   enabled, and continue the product operation without the unavailable ID.

The `getRandomValues` fallback is required because the current MagicDNS phone
origin is HTTP and `randomUUID` is restricted to secure contexts, while
`getRandomValues` is available in insecure contexts in supporting browsers.

The server uses Node's `randomUUID()` for a missing or rejected request ID. It
does not use a counter or Fastify's request ID as a substitute. Failure to
generate a browser note operation ID degrades correlation only; it must never
block a read or save. The server never manufactures an operation ID because it
cannot know the client intent boundary.

### Shared Header And Validation Contract

Shared constants define:

```text
x-azurite-request-id
x-azurite-note-operation-id
```

One shared `z.uuidv4()` schema validates both ID values. Header parsing accepts
only one exact UUID-v4 string:

- `undefined` is missing;
- a `string[]` is duplicated and rejected;
- a comma-joined string is invalid and rejected by the UUID schema;
- whitespace, oversized text, non-UUID values, and non-v4 UUIDs are invalid;
- raw rejected header values are never copied into telemetry attributes;
- a valid client request ID is accepted as canonical for that request;
- a missing or rejected request ID is replaced with a fresh server UUID;
- a missing or rejected operation ID is omitted.

The server records bounded enum status rather than the rejected value:

| Attribute                          | Values                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| `azurite.request_id_source`        | `client`, `server_missing`, `server_invalid`, `server_duplicate` |
| `azurite.note_operation_id_status` | `accepted`, `missing`, `invalid`, `duplicate`                    |

Invalid correlation metadata never produces a `400`, changes a successful route
to a failure, changes an API body, or bypasses existing validation. Correlation
headers are request-only and are not returned in response headers. This keeps
the established API compatible and avoids a second response contract.

### Browser Operation Flow

The browser path is explicit and overlap-safe:

1. A list, route-driven note load, discard-and-reload, or manual save action
   obtains its UI sequence where the existing stale guard needs one.
2. A note load or save action creates its note operation ID.
3. Immediately before each API call, the action creates its request ID and
   immutable `ApiRequestMetadata`.
4. The action emits its semantic `started` event and passes the metadata to the
   injected `NoteBrowserApi` method.
5. The API client emits API request evidence, adds the shared headers that are
   present, and preserves the existing parsed response/error return contract.
6. The action emits the semantic result with the same closure-owned metadata.
7. If the UI sequence is stale, `note.load.stale_ignored` uses the stale
   closure's note ID, operation ID, request ID, and UI sequence—not current
   store state.

Rename the current runtime members and context methods before adding semantic
IDs:

- `noteRequestId` -> `noteRequestSequence`;
- `notesRequestId` -> `notesRequestSequence`;
- `nextNoteRequestId` -> `nextNoteRequestSequence`;
- `nextNotesRequestId` -> `nextNotesRequestSequence`;
- matching function parameters named `requestId` -> `requestSequence`.

These are behavior-preserving names. Existing stale-response tests must pass
before observability assertions are added.

### Route-Source Truth

Slice 7B records only route sources the current app can know honestly:

| Source                 | Emission point                                              | Meaning                                                               |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `note_list`            | List-selection action before navigation                     | Daniel requested navigation from the visible note list.               |
| `startup_fallback`     | Note-list load before replacing an absent/invalid selection | The app selected the first available note as its startup fallback.    |
| `url_sync`             | Route synchronization action                                | The store synchronized to the note ID currently owned by the URL.     |
| `draft_discard_reload` | Discard-and-reload action                                   | The app reread the selected disk note after deliberate draft discard. |

The plan does not claim `direct_url` versus `browser_history`: the current
router/store boundary does not preserve that distinction at the load action.
`azurite.route_source` is attached where one of the four facts is known and is
omitted otherwise. No router history behavior changes to create telemetry.

### Fastify Request Context

Add a Sentry-free server correlation module and Fastify type augmentation for:

```ts
type ServerRequestCorrelation = {
  readonly noteOperationId?: string;
  readonly noteOperationIdStatus:
    "accepted" | "duplicate" | "invalid" | "missing";
  readonly requestId: string;
  readonly requestIdSource:
    "client" | "server_duplicate" | "server_invalid" | "server_missing";
};
```

The Fastify plugin decorates requests with a `null` placeholder, then assigns a
fresh frozen correlation object in `onRequest`. It is registered before note
routes and before the current trace-evidence hook so every API handler sees the
context. A shared accessor returns the non-null context after the hook boundary.

Do not decorate the Fastify request prototype with a shared object. Do not store
current request context in a module global. The decorated request is the server
authority; Sentry scope is only a carrier.

The note-list handler must accept its `FastifyRequest` rather than discarding it.
Read/save handlers reuse their existing request. Route modules pass the immutable
context explicitly to observability helpers.

### Sentry Scope And Concurrency Boundary

Sentry's browser isolation scope is effectively global for the page. Slice 7B
therefore never places request ID, operation ID, note ID, content hash, API
error, or UI sequence on a browser global/isolation scope.

Every web event and span receives its attributes explicitly from the immutable
closure context. The 7A adapter continues to use event-local `withScope` for log
and exception context. It may add correlation IDs as event-local tags for error
searchability, but it must not call global `setTag`, `setContext`, or mutate a
long-lived current scope for operation data.

The Sentry Fastify integration may continue using its SDK-managed per-request
isolation for automatic tracing and errors. Azurite does not depend on that scope
as product state. Server route events and spans receive all correlation fields
explicitly from the decorated Fastify request; error capture uses the existing
event-local adapter scope.

Operation breadcrumbs remain chronological history by design and can therefore
appear on a later captured error in the same browser session. That is useful
investigation context, not scope inheritance. The isolation requirement applies
to the unrelated event's own tags, structured attributes, contexts, and span
attributes; those must not silently inherit a prior operation.

Tests run overlapping browser operations and concurrent Fastify injections,
then emit an unrelated event. They must prove exact attributes at every helper
call and absence of correlation residue on the unrelated event. Assertions must
not merely check that the last operation looks correct.

### API Compatibility Boundary

The typed API boundary becomes:

```ts
type NoteBrowserApi = {
  readonly listNotes: (
    metadata: ApiRequestMetadata,
  ) => Promise<ListNotesResponse>;
  readonly readNote: (
    noteId: string,
    metadata: ApiRequestMetadata,
  ) => Promise<ReadNoteResponse>;
  readonly saveNote: (
    input: SaveNoteInput,
    metadata: ApiRequestMetadata,
  ) => Promise<SaveNoteResponse>;
};
```

Metadata is required as a parameter so every caller makes ownership explicit;
its individual IDs remain optional for degraded generation. Test doubles must
assert or deliberately ignore this parameter. The API client's successful body
types and `WebApiError` contract remain unchanged.

Custom headers are sent only when their value is present. Existing `Accept` and
`Content-Type` behavior remains intact. Requests stay relative to the Vite
origin, so the phone continues through the existing proxy and the backend stays
local-only.

### Core, Cluster, And Filesystem Evidence Boundary

`packages/core` remains Sentry-free. Fastify route instrumentation observes
inputs, validated request context, returned shared values, mapped API outcomes,
duration, and caught errors.

The current `ClusterIdentity` value permits these truthful attributes:

- `azurite.cluster_identity_status = ready` plus `azurite.cluster_id`; or
- `azurite.cluster_identity_status = unavailable` plus
  `azurite.cluster_identity_reason`.

Slice 7B does not emit `cluster.metadata.read`, `cluster.metadata.created`, or a
standalone `cluster.metadata.failed` event because the current core return value
does not expose read-versus-created provenance. Cluster identity is context on
the note route result that actually observed it.

Likewise, Slice 7B does not emit `filesystem.boundary.rejected` or attach a
supposed rejected path. The current route mapping exposes `invalid_note_id`,
`note_not_found`, and other shared API results but not a reliable boundary
subtype or safe rejected path. Route outcome evidence records the known API code
and caught error context. A future core contract may add provenance when a real
product workflow needs it; 7B will not fabricate precision.

Expected invalid input, not-found, and conflict outcomes are structured result
events, not exceptions. Unexpected `5xx` failures capture the caught error once
at the route boundary while Fastify/Pino logging remains intact.

### File Decomposition Boundary

The following files are already close enough to the 400-line hard limit that
implementation must split responsibility before adding instrumentation:

- `apps/server/src/notes-route.ts`: separate route registration, list handler,
  content handlers, error mapping, and route-observability construction.
- `apps/web/src/state/note-browser-route-actions.ts`: separate list/navigation
  actions from note-read actions.
- `apps/web/src/state/note-browser-editor-actions.ts`: extract save actions and
  save-result mapping before adding save evidence.

The correlation generator, web API evidence, and Fastify correlation hook each
receive focused modules and tests. `MilkdownEditor.tsx` is untouched in Slice
7B. Every code file remains at or below 400 lines.

## Shared Correlation And Event Contract

### Attribute Vocabulary

Extend the existing shared attribute constants rather than creating web/server
copies:

| Attribute                          | Type or values              | Use                                                                                         |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `azurite.request_id`               | UUID string                 | One HTTP attempt.                                                                           |
| `azurite.request_id_source`        | bounded enum                | Client acceptance or server fallback reason.                                                |
| `azurite.note_operation_id`        | UUID string                 | One note load/save intent.                                                                  |
| `azurite.note_operation_id_status` | bounded enum                | Backend header disposition.                                                                 |
| `azurite.ui_request_sequence`      | number                      | Browser stale-response ordering only.                                                       |
| `azurite.note_id`                  | string                      | Validated or locally known note identity.                                                   |
| `azurite.cluster_id`               | UUID string                 | Ready cluster identity.                                                                     |
| `azurite.cluster_identity_status`  | `ready`, `unavailable`      | Current shared identity result.                                                             |
| `azurite.cluster_identity_reason`  | existing shared reason enum | Why identity is unavailable.                                                                |
| `azurite.route_source`             | four-value enum above       | Truthful browser navigation/load source.                                                    |
| `azurite.api_error_code`           | existing shared API code    | Stable route/client error result.                                                           |
| `azurite.content_hash`             | string                      | Returned note version.                                                                      |
| `azurite.expected_content_hash`    | string                      | Save precondition.                                                                          |
| `azurite.markdown_length`          | number                      | Non-payload content size context.                                                           |
| `azurite.note_count`               | number                      | Successful list result size.                                                                |
| `http.method`                      | `GET`, `PUT`                | Current API method.                                                                         |
| `http.route`                       | shared route pattern        | Route pattern, never an unbounded concrete URL.                                             |
| `http.response.status_code`        | number                      | Actual HTTP result where available.                                                         |
| `azurite.duration_ms`              | number                      | Measured operation duration.                                                                |
| `azurite.result_status`            | bounded lifecycle result    | `started`, `succeeded`, `failed`, `invalid`, `not_found`, `conflicted`, or `stale_ignored`. |

Environment, release, surface, trace-header evidence, and 7A test attributes
retain their existing names. Slice 7B does not rename 7A events.

### Frontend Event Vocabulary

| Event                              | Required operation-specific attributes                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `correlation.id_generation.failed` | ID kind and bounded failure reason; no fabricated ID                                                                               |
| `note.route.navigation_requested`  | note ID and `note_list` or `startup_fallback` source                                                                               |
| `note.route.synchronized`          | note ID when present and `url_sync` source                                                                                         |
| `api.request.started`              | request ID when available, operation ID when applicable, route, method, `started`                                                  |
| `api.request.succeeded`            | same IDs, route, method, status code, duration, `succeeded`                                                                        |
| `api.request.failed`               | same IDs, route, method, status when available, API code when available, duration, `failed`                                        |
| `notes.list.started`               | request ID when available, UI sequence, `started`                                                                                  |
| `notes.list.succeeded`             | request ID when available, UI sequence, cluster identity, note count, duration, `succeeded`                                        |
| `notes.list.failed`                | request ID when available, UI sequence, API code when available, duration, `failed`                                                |
| `notes.list.stale_ignored`         | stale request ID when available, stale UI sequence, duration, `stale_ignored`                                                      |
| `note.load.started`                | note ID, operation/request IDs when available, UI sequence, route source, `started`                                                |
| `note.load.succeeded`              | note ID, operation/request IDs when available, UI sequence, cluster identity, content hash, markdown length, duration, `succeeded` |
| `note.load.failed`                 | note ID, operation/request IDs when available, UI sequence, API code when available, duration, `failed`                            |
| `note.load.stale_ignored`          | stale note ID, operation/request IDs when available, stale UI sequence, duration, `stale_ignored`                                  |
| `note.save.started`                | note ID, operation/request IDs when available, expected hash, `started`                                                            |
| `note.save.succeeded`              | note ID, operation/request IDs when available, cluster identity, content hash, duration, `succeeded`                               |
| `note.save.conflicted`             | note ID, operation/request IDs when available, expected hash, API conflict code, duration, `conflicted`                            |
| `note.save.failed`                 | note ID, operation/request IDs when available, API code when available, duration, `failed`                                         |

`api.request.failed` owns capture of the normalized browser request error when it
is unexpected. The paired note result is recorded without capturing the same
exception again. Expected HTTP/API outcomes remain structured logs and
breadcrumbs rather than fake errors.

### Backend Event Vocabulary

| Event                  | Required operation-specific attributes                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `notes.list.started`   | request ID/source, header status, route, method, `started`                                                                         |
| `notes.list.succeeded` | request ID/source, cluster identity, note count, duration, status code, `succeeded`                                                |
| `notes.list.failed`    | request ID/source, API code, duration, status code, caught error context for unexpected failure, `failed`                          |
| `note.read.started`    | request ID/source, operation ID/status when accepted, note ID when valid, route, method, `started`                                 |
| `note.read.succeeded`  | same IDs, note ID, cluster identity, content hash, markdown length, duration, status code, `succeeded`                             |
| `note.read.invalid`    | request ID/source, operation status/ID when accepted, API code, duration, status code, `invalid`                                   |
| `note.read.not_found`  | request ID/source, operation ID when accepted, note ID, API code, duration, status code, `not_found`                               |
| `note.read.failed`     | request ID/source, operation ID when accepted, note ID when known, API code, duration, status code, caught error context, `failed` |
| `note.save.started`    | request ID/source, operation ID/status when accepted, note ID when valid, expected hash, route, method, `started`                  |
| `note.save.succeeded`  | same IDs, note ID, cluster identity, content hash, duration, status code, `succeeded`                                              |
| `note.save.invalid`    | request ID/source, operation status/ID when accepted, API code, duration, status code, `invalid`                                   |
| `note.save.not_found`  | request ID/source, operation ID when accepted, note ID, API code, duration, status code, `not_found`                               |
| `note.save.conflicted` | request ID/source, operation ID when accepted, note ID, expected hash, API code, duration, status code, `conflicted`               |
| `note.save.failed`     | request ID/source, operation ID when accepted, note ID when known, API code, duration, status code, caught error context, `failed` |

Workspace-not-configured and invalid-body/query outcomes use the matching route
event and existing API error code. A handler emits exactly one start and one
terminal result. It does not additionally emit speculative cluster or filesystem
events.

### Telemetry Carrier Mapping

- Structured logs are the primary record for every event above.
- `recordWebRuntimeEvent` and `recordServerRuntimeEvent` provide the matching
  chronological breadcrumb for non-exception lifecycle/results.
- Web API, note operation, and server route spans measure the work and carry the
  same explicit scalar attributes. Nested spans use distinct operation names;
  they do not replace semantic IDs.
- Event-local tags are limited to searchable identifiers and bounded dimensions:
  surface, route, result, request ID, operation ID when present, and API code
  when present. They are never installed globally.
- Event-local context and structured attributes carry note ID, cluster identity,
  hashes, UI sequence, duration, header status, and caught error context.
- Captured exceptions are reserved for ID-generation exceptions, unexpected web
  request failures, and unexpected server failures. Expected invalid input,
  not-found, and conflict states are not captured as exceptions.
- Full markdown, drafts, Zustand snapshots, request/response payloads, and local
  filesystem path enrichment remain Slice 7C work. Existing caught error stacks
  remain eligible diagnostic data.

## Implementation Plan

### 1. Lock The Shared Contract

- Extend `packages/shared/src/runtime-observability.ts` with the chosen event,
  attribute, result, header-status, and route-source constants.
- Add focused Sentry-free correlation types, header constants, and UUID schemas
  in shared modules rather than expanding one file toward the line limit.
- Reuse existing API route, API error, cluster, note, and save schemas.
- Add TSDoc for every exported type, schema, constant, and helper.
- Add shared tests for exact names, enum values, UUID acceptance/rejection, and
  header constants.

### 2. Add The Browser Correlation Helper

- Implement the `randomUUID` then `getRandomValues` UUID-v4 algorithm exactly as
  specified.
- Return immutable optional metadata and keep generation failure non-blocking.
- Test native generation, HTTP-compatible fallback bit formatting, unavailable
  crypto, and thrown crypto calls.
- Emit one bounded generation-failure event per failed requested identifier; do
  not retry in a loop or fall back to weak randomness.

### 3. Clarify Zustand Sequence Ownership

- Rename both runtime counters, context methods, action parameters, and tests
  from request IDs to request sequences.
- Prove existing list/read overlap and stale-result behavior before correlation
  events are added.
- Do not persist request, operation, or sequence values in Dexie or URL state.

### 4. Extend The Typed Browser API Boundary

- Make `ApiRequestMetadata` an explicit parameter on all three `NoteBrowserApi`
  methods.
- Update the default API, injected fakes, and all call sites.
- Add headers only for present validated metadata while preserving `Accept`,
  `Content-Type`, method, body, response parsing, and `WebApiError` behavior.
- Instrument the centralized API request start/result and span once so actions
  do not duplicate transport evidence.
- Test GET/PUT headers, missing degraded IDs, parsed success, every existing API
  error, network failure, and unchanged response/body types.

### 5. Add Browser Note And Route Evidence

- Split route and editor action modules before they approach 401 lines.
- Create note operation context in read/reload/save actions and retain it in the
  async closure.
- Emit the exact route, note-list, note-load, save, conflict, failure, and stale
  events.
- Preserve URL ownership, startup replacement, list navigation, browser history,
  `azurite-dev=sentry-test`, draft flushing, content-hash conflict protection,
  and existing visible UI states.
- Test rapid overlapping reads so stale evidence uses the stale closure rather
  than current Zustand state.

### 6. Add Fastify Request Correlation

- Implement shared-header parsing and server UUID fallback in a Sentry-free
  module.
- Register a request decorator with a `null` placeholder and create a fresh
  frozen context in `onRequest` before note routes and trace evidence.
- Add Fastify type augmentation and a checked accessor.
- Keep Fastify's request ID and SDK-managed request scope separate.
- Test missing, valid, invalid, non-v4, whitespace, oversized, comma-joined, and
  array-valued headers plus concurrent injected requests.

### 7. Split And Instrument Note Routes

- Decompose `notes-route.ts` by registration, handlers, errors, and evidence
  before adding behavior.
- Pass the Fastify request and decorated correlation context through list, read,
  and save handlers.
- Emit exactly one start and one truthful terminal route event with the current
  API error and cluster-identity contracts.
- Wrap route work in server spans and preserve Pino logs.
- Capture unexpected caught errors once; do not create fake cluster provenance,
  filesystem-boundary detail, or exceptions for expected results.
- Keep `packages/core` untouched unless a non-observability correctness defect
  is independently discovered and the plan is revised first.

### 8. Prove Carrier And Scope Isolation

- Extend both 7A adapters only as needed for selected event-local tags and
  context; direct SDK calls remain inside the adapter modules.
- Assert logs, breadcrumbs, spans, tags, context, and exceptions against the
  exact event mapping.
- Run overlapping browser note lists, overlapping browser note reads, and two
  concurrent Fastify requests with different identifiers.
- Emit a runtime test event afterward and prove it contains no note, request,
  operation, sequence, hash, route-source, or API-error residue in its own tags,
  attributes, contexts, or span. Prior chronological breadcrumbs may remain as
  intentional history.
- Preserve all existing 7A helper, preload, tracing, Replay, and shutdown tests.

### 9. Run Desktop And Physical-Phone Acceptance QA

- Use a disposable two-note cluster and an explicit Sentry-enabled debug run.
- Keep Vite bound only to the selected Tailscale interface and Fastify on
  localhost for phone QA.
- Record exact event names and IDs in completion evidence rather than writing
  only "Sentry worked."
- Use WYSIWYG for the phone save marker. Do not use the known-broken Markdown
  newline path as a 7B completion gate.
- Re-run Sentry-disabled desktop behavior and the full repository validation.

## Negative Side-Effect Guardrails

The shared preservation baseline is
`docs/reference/product-guardrails.md`. Slice 7B adds only these correlation- and
observability-specific protections:

- Browser cryptographic-ID failure must degrade evidence, never block or alter a
  note request.
- A client-supplied correlation header is diagnostic input only; it must not
  authorize work, change note selection, bypass validation, select a workspace,
  or become an idempotency key.
- Invalid or duplicated header contents must not be copied into telemetry,
  response bodies, response headers, logs, or error messages.
- Request IDs, note operation IDs, UI sequences, Fastify request IDs, editor
  session IDs, cluster IDs, and content hashes must remain distinct types and
  meanings.
- No browser or server global mutable scope may retain operation context between
  overlapping or subsequent work.
- A stale response must report its original closure context and must not mutate
  the currently selected note.
- Each lifecycle emits at most one start and one terminal semantic result at its
  owning layer; nested API/operation/route evidence must not become an event
  storm.
- Route evidence must not claim cluster read/create provenance, filesystem
  rejection details, route-history source, or other facts unavailable at its
  boundary.
- Sentry failure, latency, or disabled state must not change API response
  shapes, status codes, filesystem writes, draft behavior, navigation, or
  conflict protection.
- Phone QA must preserve the current network boundary: frontend on the selected
  Tailscale interface, backend local-only behind the Vite proxy.
- The known mobile editor findings remain recorded and unfixed; a WYSIWYG save
  passing 7B must not be presented as editor correctness.

## Verification Plan

### Automated Verification

Run:

```sh
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

Targeted tests must prove:

- exact shared constants, schemas, result values, header names, and event names;
- UUID-v4 native generation and `getRandomValues` fallback formatting;
- no weak-randomness fallback and non-blocking unavailable-crypto behavior;
- sequence-counter renames preserve list/read staleness semantics;
- explicit `NoteBrowserApi` metadata at all production and test call sites;
- GET/PUT headers, existing request headers, body parsing, API errors, and
  unchanged successful return types;
- one request ID per call and one operation ID per load/save intent;
- route-source values only at truthful emission points;
- frontend start/result attributes for read, stale read, save, conflict, and
  failure, plus list success/failure/staleness;
- Fastify decoration ordering and fresh immutable context per request;
- valid, missing, invalid, duplicate, comma-joined, whitespace, oversized, and
  non-v4 correlation header handling;
- no API body/status change for any correlation-header case;
- server fallback request IDs and omission of untrusted operation IDs;
- backend list/read/save success, invalid, not-found, conflict, workspace, and
  unexpected-failure events;
- ready and unavailable cluster identity attributes without invented provenance;
- expected results produce no fake captured exception;
- unexpected errors are captured once and Pino behavior remains intact;
- overlapping browser operations and concurrent Fastify requests never exchange
  correlation context;
- the next unrelated runtime event has no residual operation tags, attributes,
  context, or span data while prior breadcrumbs remain valid history;
- direct Sentry imports remain confined to initialization/adapter modules;
- `packages/core` remains Sentry- and telemetry-free;
- all existing routing, draft, recovery, editor, save, conflict, 7A runtime,
  preload, Replay-config, trace, and shutdown tests remain green;
- all code files remain at or below 400 lines.

### Exact Desktop Sentry Evidence

Completion evidence must record one example value for each accepted request and
operation ID and show these joins:

| Workflow          | Required browser evidence                                                   | Required server evidence                       | Required Sentry proof                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note list         | `notes.list.started/succeeded`, `api.request.started/succeeded`             | `notes.list.started/succeeded`                 | Same request ID on browser list/API and server list; no note operation ID; note count, cluster identity, route/method/result, duration, and both surfaces visible.                        |
| Note read         | `note.load.started`, `api.request.started/succeeded`, `note.load.succeeded` | `note.read.started/succeeded`                  | Same request ID on browser API and server read; same operation ID on load, API, and server read; route/method/result, cluster ID, content hash, duration, and web/server surface visible. |
| Manual save       | `note.save.started`, `api.request.started/succeeded`, `note.save.succeeded` | `note.save.started/succeeded`                  | Same request and operation IDs across both surfaces; expected and returned hashes, `PUT`, status `200`, durations, and result visible.                                                    |
| Save conflict     | `note.save.started`, `api.request.failed`, `note.save.conflicted`           | `note.save.started/conflicted`                 | Same IDs across both surfaces; existing conflict API code, expected hash, status `409`, and no fake exception visible.                                                                    |
| Overlapping reads | Two distinct load/API contexts and one `stale_ignored` result               | Corresponding independent server read contexts | Stale event carries its original IDs/note/sequence; current operation remains distinct; unrelated test event has no residue.                                                              |

At least one sampled read or save should still show the 7A Sentry trace, but a
trace is corroborating evidence rather than the semantic acceptance key. Replay
must still load and remain unmasked; 7B does not require new editor-specific
Replay content.

### Exact Physical-Phone Sentry Evidence

Use the current MagicDNS URL on the Pixel 6/Android Chrome path and a disposable
note:

1. Open the disposable cluster and confirm browser/server `notes.list.succeeded`
   share a request ID and report no note operation ID.
2. Load `technical-architecture.md` or another named disposable note.
3. Confirm browser `note.load.succeeded` and server `note.read.succeeded` share
   the request and operation IDs.
4. Insert `PHONE-QA-7B-SAVED-2026-07-10` near the top through WYSIWYG and save.
5. Confirm browser/server save events share new request and operation IDs,
   status `200`, and expected/returned hashes.
6. Read the note again and confirm the marker persisted.
7. Confirm `sentry-trace` and `baggage` still reach Fastify and the phone Replay
   remains distinct and unmasked.
8. Confirm Fastify is not directly reachable through its Tailscale address.

The phone QA record must explicitly say that Markdown source Enter was not used
as the save path because its newline reversion remains scheduled for diagnosis
in 7C and repair immediately afterward.

### Sentry-Disabled Evidence

Start without enabled Sentry configuration and prove:

- no Sentry or Replay runtime is required for browser or server startup;
- correlation headers and Fastify context do not change note list/read/save
  results;
- note URL navigation, browser history, WYSIWYG/Markdown mode switching, manual
  save, conflict handling, draft recovery, and stale-response behavior match the
  pre-7B app;
- no correlation helper failure becomes visible product failure.

## Acceptance Criteria

- The identity ownership, UUID generation, header validation, API compatibility,
  route-source, Fastify decoration, event vocabulary, scope isolation, and
  carrier decisions in this document are implemented without unresolved
  alternatives.
- Every normal frontend API attempt has a UUID-v4 request ID; degraded browser
  generation remains non-blocking and the server supplies a trusted request ID.
- Every normal browser note read/save intent has a note operation ID that is
  transported unchanged to Fastify.
- Numeric Zustand counters are clearly named and remain local UI sequences.
- Correlation headers accept only one exact UUID-v4 value; missing/invalid
  request IDs get a server fallback and missing/invalid operation IDs are
  omitted.
- API response bodies, response headers, status codes, and shared error codes
  remain unchanged.
- Frontend and backend emit the exact shared lifecycle/result events with
  explicit correlation attributes.
- Cluster identity evidence reflects only `ready` or `unavailable`; no event
  invents read/create or filesystem-rejection provenance.
- Expected invalid, not-found, and conflict outcomes are not fake exceptions;
  unexpected failures are captured once with useful context.
- Overlapping browser operations, concurrent server requests, stale responses,
  and the next unrelated event prove correlation isolation.
- Existing 7A preload, tracing, Replay, console, shutdown, and disabled-mode
  behavior remains intact.
- Existing routing, save, conflict, draft, recovery, filesystem, and Tailscale
  behavior remains intact.
- Desktop and physical-phone Sentry QA produce the exact join evidence defined
  above.
- The mobile Markdown newline and recovered-draft findings remain explicitly
  unfixed and handed to 7C.
- `packages/core` remains Sentry-free and no code file exceeds 400 lines.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, and
  `git diff --check` pass.
- Completion evidence records the commands, test totals, concrete IDs, Sentry
  event names, desktop/phone outcomes, and any implementation-time plan change.
- The completed repository state is clean and pushed to `origin/main`.

## Handoff To Slice 7C

Slice 7C may rely on these completed 7B truths:

- request-attempt IDs, note-operation IDs, UI request sequences, Fastify request
  IDs, editor session IDs, cluster IDs, and hashes have distinct ownership;
- browser operation context is closure-owned and explicit, not global scope;
- backend correlation context is request-decorated, immutable, and validated;
- note read/save/conflict evidence joins browser and server by shared IDs;
- list/read/save route outcomes carry truthful cluster identity and API result
  context;
- event-local helper scopes and explicit attributes remain isolated under
  overlap;
- the canonical save event prefix is `note.save.*`, not `save.*`;
- 7C must enrich route failures rather than depend on a nonexistent
  `cluster.metadata.failed` event;
- full payload, editor session, Milkdown/Crepe, Zustand, Dexie, coalescing, and
  Replay-usefulness behavior remains intentionally unimplemented;
- the mobile Markdown newline reversion and recovered-draft observation remain
  active diagnostic targets, followed immediately by the required
  editor-correctness slice.

## Open Questions

None. If implementation evidence contradicts one of these decisions, pause,
update this planned slice with the new evidence, and obtain review before
changing the architecture.
