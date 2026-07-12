# Slice 7B: Request Correlation And Note Route Evidence

## Status

Complete and archived on 2026-07-12. Daniel approved implementation after
reconciliation on 2026-07-10 and two focused adversarial contract reviews on
2026-07-11. Implementation, both save-integrity review repairs, automated
verification, desktop and Pixel 6 acceptance across development and production
with Sentry enabled and disabled, authenticated Sentry proof, and the local-only
backend boundary all passed.

The Back/sidebar divergence was decisively reproduced in the exact pre-7B tree
with real API responses under controlled latency. It is a pre-existing
route-selection race, not a 7B regression, and is ordered separately as Slice
7F. No route repair was annexed to 7B or 7C.

The authoritative implementation and QA record is
`docs/qa/slice-7b-request-correlation.md`. Keep concrete commands, IDs, hashes,
event joins, findings, and the closing synthetic matrix there rather than
duplicating them through this plan.

The review repair gate is also authoritative in that QA record. The final
closing synthetic QA run must follow both save-integrity repairs and route
classification; the 2026-07-12 baseline run was explicitly authorized early to
surface mobile evidence, not to waive those gates.

Slice 7A is complete and archived in
`docs/slices/archive/slice-7a-sentry-runtime-delivery-foundation.md`. Its desktop
and historical physical-phone runtime evidence is now an implemented dependency,
not a future prerequisite. Slice 7C is the next active product slice in
`docs/slices/active/slice-7c-markdown-fidelity-and-honest-dirty-state.md`.
Slice 7D remains planned after it in
`docs/slices/planned/slice-7d-semantic-editor-and-persistence-diagnostics.md`.

The historical physical-phone session recorded the mobile Markdown newline
reversion and unexplained recovered-draft state in
`docs/qa/mobile-markdown-newline-reversion.md`. Slice 7B must preserve those
findings without diagnosing or fixing them. Synthetic mobile save-correlation QA
uses a disposable WYSIWYG edit because source-mode Enter remains outside 7B's
acceptance path.

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
- observability adapters fail open without changing product return values,
  errors, callbacks, requests, writes, or state transitions;
- the browser accepts at most one in-flight manual save per note, while the core
  serializes concurrent Azurite writes to the same resolved note path across
  hash validation and atomic replacement;
- the existing Slice 7A tracing, Replay, preload, console, and shutdown runtime
  remains intact;
- note list, read, save, conflict, validation, and unexpected route outcomes are
  observable without changing API bodies, error codes, filesystem boundaries,
  or successful single-write semantics.

Slice 7B does not instrument Milkdown, Crepe, Zustand snapshots, Dexie draft
semantics, or rich payloads. Slice 7D will add those layers on this correlation
contract.

## User Story

When Daniel loads or saves a note with Sentry debug mode enabled, he can take the
request ID and note operation ID from the browser evidence and find the matching
Fastify route evidence, even when the distributed Sentry trace is unavailable or
sampled out.

When requests overlap, a stale response remains attached to the operation that
created it. A later note, request, or unrelated runtime event does not inherit
the earlier operation's metadata.

When Daniel keeps editing while a manual save is in flight, his newer markdown
remains dirty and safe without enabling a second concurrent write to the same
note. When two Azurite clients submit the same old content hash concurrently,
one write succeeds and the other receives the existing conflict response.

When Sentry is disabled, correlation ID generation degrades, or an enabled
Sentry carrier throws, Azurite still lists, reads, edits, saves, detects
conflicts, recovers drafts, routes by URL, and works through the Tailscale
frontend proxy with the same product API responses as before this slice.

## Why This Matters

Slice 7A proved delivery: Sentry can initialize only when enabled, receive real
web/server events and logs, show unmasked desktop and phone Replays, propagate
trace headers through Vite, and flush within a bounded shutdown path. Delivery
alone does not prove that a browser load, backend read, stale response, save, or
conflict belongs to one user intent.

Slice 7B supplies that missing semantic join. It also prevents Slice 7D from
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
- Enabled adapter calls are not currently guarded against synchronous SDK
  failures. Record, capture, or span setup can therefore throw into feature code,
  and a naive span fallback could invoke product work twice. Slice 7B owns the
  fail-open repair before those helpers surround real note workflows.
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
- The note-list success path ignores stale results, but the failure path does
  not. A late older list failure can currently replace a newer ready list with
  an error. Slice 7B owns this correctness repair because it adds exact list
  stale-result evidence.
- Startup fallback replaces the URL before its first-note load finishes. The
  route effect can observe that replacement and request the same note again
  while it is already loading. Slice 7B must coalesce that duplicate system
  reaction into the original startup intent before assigning operation IDs.
- Editing while a save is in flight currently resets `saveStatus` from
  `saving` to `idle`, enabling another same-note save with the same expected
  hash. Older and newer save responses can then update the browser baseline out
  of user-intent order.
- `writeWorkspaceNote` currently reads and validates the expected hash before
  its separate atomic replacement. Concurrent Azurite requests can both validate
  the same old hash and both succeed. A focused 2026-07-11 reproduction produced
  two successes in all 40 concurrent same-hash trials. Slice 7B owns in-process,
  per-note write serialization because truthful save/conflict evidence depends
  on the content-hash contract remaining true under current multi-client use.
- `apps/web/src/observability/web-sentry-test-events.ts` deliberately uses a
  separate direct `fetch` for the Slice 7A development diagnostic POST. It is
  not a note-browser API attempt and remains outside browser correlation-header
  generation in this slice.
- Fastify 5 and Node normalize duplicate custom HTTP headers before the request
  hook normally sees them. A repeated or injected array value can arrive as a
  comma-joined string, so Slice 7B must classify the observable value as invalid
  rather than claim independently observable duplicate provenance.
- `packages/shared/src/cluster.ts` exposes only `ready` or `unavailable` cluster
  identity results. The server route cannot truthfully distinguish whether
  cluster metadata was read from disk or created during the call.
- This outcome-oriented identity contract deliberately omits transient
  metadata-read state and successful resolution provenance. A future Cluster
  Opening And Lifecycle Foundation owns a separate existing, created, migrated,
  repaired, or copied-identity resolution contract. Slice 7B does not add a
  transient `missing` state to note responses.
- Current core-to-route error mapping exposes stable API outcomes, but does not
  preserve a distinct filesystem-boundary rejection subtype at the route.
- `packages/core` owns filesystem truth and remains Sentry-free.
- The phone uses the MagicDNS frontend over HTTP while Fastify remains bound to
  localhost. Browser UUID generation therefore cannot depend only on APIs that
  require a secure context.

## Future Workflow Boundary

| Boundary               | Required decision                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Correlate note list, URL-driven read, manual save, conflict, failure, and stale-response evidence from browser intent through the relative Vite API call to the Fastify route result, while keeping telemetry fail-open and same-note manual saves ordered.                                                                                   |
| Predictable extensions | Slice 7D editor/draft diagnostics and later retry, autosave, create, delete, file-watch, and indexing work reuse the request-attempt and operation-intent distinction. Future multi-process hosting may extend the same-note write coordinator beyond the current single Azurite server process.                                              |
| Participating layers   | Shared schemas/constants, browser correlation helper, Zustand note actions and active-save ownership, narrow Dexie draft reconciliation after save, typed `NoteBrowserApi`, web API client, fail-open web/server observability adapters, Fastify request hook and note routes, core per-note write coordination, tests, and desktop/phone QA. |
| Near-term seams        | Typed API metadata, immutable browser operation context, ephemeral per-note load/save records, decorated Fastify request context, bounded span descriptors, explicit event attributes, and a keyed core write coordinator leave room for editor session IDs, retries, autosave, and multiple request attempts per operation.                  |
| Exclusions             | Rich editor/draft instrumentation, payloads, retries, autosave, new note lifecycle behavior, cluster-resolution provenance, richer filesystem errors, core observers, cross-process/advisory locking, and runtime initialization can wait because the current workflow gains a complete in-process correlation and save-ordering boundary.    |

## Goals

- Establish shared UUID, header, correlation metadata, event, attribute, result,
  and route constants.
- Give every note-browser API attempt a fresh request ID when browser secure
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
- Prevent stale note-list successes and failures from mutating newer list state.
- Coalesce startup fallback and the resulting same-note URL synchronization into
  one note-load intent, operation ID, request, and in-flight result.
- Make enabled observability helpers fail open while invoking product span work
  exactly once and preserving its original return value or error.
- Accept at most one in-flight browser manual save per note, preserve edits made
  during that save, and retain closure-owned correlation evidence for its result.
- Serialize concurrent writes to the same resolved note path inside the current
  Azurite process so same-hash requests produce one success and one conflict
  while different notes remain independent.
- Emit truthful frontend API, note load/save, stale, and route evidence.
- Emit truthful backend note list/read/save outcomes using the current shared
  API and cluster-identity contracts.
- Keep operation context isolated across overlapping requests and stale
  responses.
- Prove the same request and operation IDs in exact desktop and synthetic Pixel
  6 Sentry evidence.
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
  carrier machinery. Slice 7D owns bounded rich payloads.
- Do not change note response schemas, error response schemas, status codes, or
  error codes. Slice 7B strengthens the existing content-hash conflict guarantee
  under concurrent Azurite writes without inventing a new API outcome.
- Do not add cross-process or advisory filesystem locks. Slice 7B makes requests
  handled by the current single Azurite server process obey the content-hash
  contract; arbitrary external programs remain outside Azurite's coordination
  protocol and continue to be observed through the existing hash check.
- Do not echo correlation IDs in response headers or bodies.
- Do not treat diagnostic IDs as authentication, authorization, idempotency,
  product identity, or persistence keys.
- Do not add Sentry imports, telemetry state, observer interfaces, or callbacks
  to `packages/core`.
- Do not add cluster-resolution provenance or expose an internal metadata
  `missing` state through current note responses. The future cluster-lifecycle
  foundation owns that domain contract unless Slice 7D evidence requires it
  earlier.
- Do not broaden core filesystem errors solely to restore speculative telemetry
  events. The first create/delete/move, file-watch/indexing, or multi-cluster
  filesystem capability that needs distinct recovery owns the richer stable
  taxonomy.
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

The adversarial review identified one 7A extension-surface defect that becomes a
product risk in 7B: enabled helper calls are not fail-open. This slice repairs
that adapter contract before feature instrumentation is added. Any additional
7A correctness defect still requires a plan revision; a desire for different
helper ergonomics is not permission to duplicate the runtime.

## Architecture

### Identity Semantics And Ownership

The three current identity classes are deliberately different:

| Identity                      | Format           | Owner                                                                          | Lifetime                            | Meaning                                                                         |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| `azurite.request_id`          | UUID v4          | Browser note-browser action; Fastify fallback for missing/invalid client input | One HTTP attempt                    | Joins browser API evidence to one Fastify request.                              |
| `azurite.note_operation_id`   | UUID v4          | Browser note load/save action                                                  | One note-read or manual-save intent | Joins all evidence for one semantic note operation and may span future retries. |
| `azurite.ui_request_sequence` | Positive integer | Zustand note-browser runtime                                                   | One local list/read sequencing step | Determines whether an async response is still current; never crosses HTTP.      |

Fastify's built-in `request.id` remains a separate server logging identifier.
Slice 7D's `azurite.editor_session_id` remains a separate browser editor
identity. Cluster IDs, note IDs, content hashes, and draft keys retain their
existing product meanings.

Shared schemas use one UUID-v4 validator with distinct TypeScript brands so a
request ID and note operation ID cannot be swapped accidentally:

```ts
const correlationUuidV4Schema = z.uuidv4();
const requestIdSchema = correlationUuidV4Schema.brand<"RequestId">();
const noteOperationIdSchema =
  correlationUuidV4Schema.brand<"NoteOperationId">();

type RequestId = z.infer<typeof requestIdSchema>;
type NoteOperationId = z.infer<typeof noteOperationIdSchema>;

type ApiRequestMetadata = {
  readonly requestId?: RequestId;
  readonly noteOperationId?: NoteOperationId;
};
```

Only the shared validated generator and parser produce these branded values.
`NoteBrowserApi` and the API client do not accept arbitrary correlation strings.

The browser action creates an immutable metadata value immediately before an
API call.

The action retains that same value in its async closure for lifecycle and stale
result events. The API client serializes it but does not read or mutate a hidden
module-global "current operation." Injected test APIs receive the same typed
metadata.

`listNotes` receives a request ID only. `readNote` and `saveNote` receive both a
request ID and a note operation ID. A future retry must create a new request ID
while retaining the originating operation ID.

### UUID Generation And Degraded Behavior

The web correlation helper receives an ID kind of `request` or
`note_operation` and uses this exact order:

1. If `globalThis.crypto.randomUUID()` exists and is callable, call it and
   validate its result with the branded UUID-v4 schema.
2. If `randomUUID()` is missing, throws, or returns a value that fails
   validation, try the fallback instead of ending generation.
3. The fallback requires callable `globalThis.crypto.getRandomValues()`, fills
   16 bytes, sets the RFC 4122 version-4 and variant bits, formats the UUID, and
   validates the result with the same branded schema.
4. If either secure path succeeds, return the branded ID. A recovered native
   failure does not emit `correlation.id_generation.failed` and does not capture
   a false terminal exception.
5. If neither secure path succeeds, return `undefined`, emit exactly one
   `correlation.id_generation.failed` event for the requested ID kind when the
   runtime is enabled, and continue the product operation.
6. Never use `Math.random`, timestamps, counters, note content, or hashes.

The failure event uses these bounded values:

| Attribute                            | Values                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `azurite.correlation_id_kind`        | `request`, `note_operation`                                                               |
| `azurite.correlation_failure_reason` | `crypto_unavailable`, `random_values_unavailable`, `random_values_failed`, `uuid_invalid` |

`crypto_unavailable` means `globalThis.crypto` itself is unavailable.
`random_values_unavailable` means the native UUID path did not yield a valid ID
and no callable secure-byte fallback exists. `random_values_failed` means the
fallback threw. `uuid_invalid` means a secure API returned bytes or text that
still failed the shared UUID-v4 validation after formatting.

Terminal reason selection is deterministic:

| Terminal condition                                            | Failure reason              |
| ------------------------------------------------------------- | --------------------------- |
| `globalThis.crypto` is absent                                 | `crypto_unavailable`        |
| Native path is unusable and `getRandomValues` is not callable | `random_values_unavailable` |
| `getRandomValues` throws                                      | `random_values_failed`      |
| Fallback formatting still fails UUID-v4 validation            | `uuid_invalid`              |

When terminal failure includes a caught crypto exception, capture that exception
once with the same failure event and ID kind. When terminal failure has no
exception, record the structured failure event without fabricating one. The
event never contains a candidate or rejected ID value.

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

One shared UUID-v4 validator underlies the distinct request-ID and
operation-ID branded schemas. Header parsing accepts only one exact UUID-v4
string:

- `undefined` is missing;
- a `string[]` presented to the defensive pure parser is invalid;
- a comma-joined string is invalid without claiming whether it came from
  repeated HTTP fields or one malformed value;
- whitespace, application-reachable overlong text, non-UUID values, and non-v4
  UUIDs are invalid;
- raw rejected header values are never copied into telemetry attributes;
- a valid client request ID is accepted as canonical for that request;
- a missing or rejected request ID is replaced with a fresh server UUID;
- a missing or rejected operation ID is omitted.

The server records bounded enum status rather than the rejected value:

| Attribute                          | Values                                       |
| ---------------------------------- | -------------------------------------------- |
| `azurite.request_id_source`        | `client`, `server_missing`, `server_invalid` |
| `azurite.note_operation_id_status` | `accepted`, `missing`, `invalid`             |

Invalid correlation metadata never produces a `400`, changes a successful route
to a failure, changes an API body, or bypasses existing validation. Correlation
headers are request-only and are not returned in response headers. This keeps
the established API compatible and avoids a second response contract.

The unchanged-response guarantee applies only after a value reaches Fastify's
request hook. A transport-level header that exceeds Node's configured header
limit may be rejected before application code runs; Slice 7B neither overrides
that server protection nor claims the normal note API body/status for a request
Fastify never dispatches. Tests use bounded overlong values that reach the hook
when proving application classification.

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
7. If a list success or failure is stale, `notes.list.stale_ignored` uses the
   stale closure's request ID and UI sequence, reports whether the ignored
   completion succeeded or failed, and never mutates list or cluster state.
8. If a note-load success or failure is stale, `note.load.stale_ignored` uses
   the stale closure's note ID, operation ID, request ID, and UI sequence—not
   current store state—and reports whether the ignored completion succeeded or
   failed.

Rename the current runtime members and context methods before adding semantic
IDs:

- `noteRequestId` -> `noteRequestSequence`;
- `notesRequestId` -> `notesRequestSequence`;
- `nextNoteRequestId` -> `nextNoteRequestSequence`;
- `nextNotesRequestId` -> `nextNotesRequestSequence`;
- matching function parameters named `requestId` -> `requestSequence`.

These are behavior-preserving names. Existing stale-response tests must pass
before observability assertions are added. Add the missing list-failure guard
before list events: an older failure after a newer success and an older success
after a newer failure must both leave the current result untouched and emit
stale evidence for the older completion.

### Same-Note In-Flight Coalescing

One startup fallback is one semantic note-load intent. The store runtime owns an
ephemeral active-load record containing the target note ID, UI sequence,
operation context, and in-flight promise. It is never persisted in Zustand
state, URL state, or Dexie.

The startup path registers that active load before replacing the absent or
invalid URL selection. If the route effect then synchronizes the same note while
that load is active, it returns the existing promise and creates no second UI
sequence, operation ID, request ID, API call, or lifecycle event. The original
operation retains `startup_fallback` as its route source; the system-caused
`url_sync` reaction is not a second intent.

An explicit `forceReload` bypasses coalescing and starts a new operation. A load
for a different note also starts a new operation and makes the older result
stale. The active-load record is cleared only when the matching in-flight
operation settles, so an older completion cannot clear a newer active record.

### Manual Save Concurrency Boundary

The current browser can accept two same-note saves with the same expected hash:
editing during the first save resets `saveStatus` to `idle`, which re-enables the
Save action. Slice 7B replaces that accidental overlap with explicit ownership.

The note-browser runtime owns an ephemeral active-save record keyed by note ID.
Each record contains the immutable editor snapshot, note operation context, API
request metadata, and in-flight promise. It is not persisted in Zustand state,
URL state, or Dexie.

The browser behavior is exact:

1. The first accepted same-note save creates the operation/request IDs, records
   the active save, marks the editor as `saving`, and starts one API call.
2. Editing remains enabled. A patch made during the save increments the editor
   revision and preserves `saveStatus = saving`, so the newer markdown remains
   visibly dirty while a second same-note save stays disabled.
3. A same-note `saveSelectedNote` call while that record is active returns the
   existing promise and emits no second operation ID, request ID, API call, or
   lifecycle event.
4. Success for the saved snapshot advances the returned note, saved markdown,
   base hash, cluster identity, and list summary without replacing newer current
   markdown. The latest dirty draft remains persisted and Save becomes available
   after the matching active record clears.
5. Conflict preserves and persists the latest current markdown, marks the
   current editor as conflicted, and never restores the older snapshot.
6. Unexpected failure preserves the latest current markdown and draft, exposes
   the failed result after the active record clears, and permits an intentional
   retry.
7. A result for a note or editor session that is no longer current cannot mutate
   the selected editor. A successful result transactionally reconciles only that
   note's draft: delete it only when its base hash and normalized markdown exactly
   match the saved snapshot. A different or newer draft remains unchanged and
   safely re-enters the existing recovery/conflict flow. Conflict/failure also
   preserves the latest draft unchanged. The operation still emits terminal
   evidence from the original closure context.
8. Only the matching promise may clear its active-save record. A completion from
   another note or older session cannot unlock or overwrite newer work.

Different notes do not share a browser save lock. Their operations may overlap
and must retain independent context. Draft reconciliation uses one focused Dexie
transaction keyed by cluster ID and note ID so a late result cannot delete or
rewrite another note, another editor session, or a newer-baseline record. This is
save-integrity behavior, not Slice 7D instrumentation. The implementation extends
the existing save-success, save-failure, save-conflict, draft, and navigation
tests rather than creating a parallel save state machine.

Browser ordering is not a server integrity boundary. `packages/core` therefore
owns a keyed in-process write coordinator based on the safely resolved absolute
note path. The coordinator covers the complete current-markdown read, expected
hash validation, temporary-file write, atomic replacement, and returned note
construction. A queued same-path write rereads the file and revalidates its hash
only after the preceding write settles. Two concurrent requests carrying the
same old hash therefore produce exactly one success and one existing
`note_write_conflict`; writes to different paths remain concurrent.

The coordinator retains no telemetry or note content, removes an idle key after
its final queued task settles, and releases the queue after both success and
failure. It coordinates every Azurite write in the current Node process. It does
not claim a portable compare-and-swap against arbitrary external programs that
do not participate in Azurite's lock; the existing content-hash check remains
the external-edit protection available at the current filesystem boundary.

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

The self-induced route effect after `startup_fallback` is suppressed by the
same-note in-flight coalescing boundary. It does not emit
`note.route.synchronized` or create a `url_sync` operation. `url_sync` remains
reserved for a route synchronization that is not merely the echo of the active
startup replacement.

### Fastify Request Context

Add a Sentry-free server correlation module and Fastify type augmentation for:

```ts
type ServerRequestCorrelation = {
  readonly noteOperationId?: NoteOperationId;
  readonly noteOperationIdStatus: "accepted" | "invalid" | "missing";
  readonly requestId: RequestId;
  readonly requestIdSource: "client" | "server_invalid" | "server_missing";
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

### Fail-Open Observability Boundary

Sentry is diagnostic infrastructure and must never become a product dependency,
even after the runtime is enabled. Both adapters enforce these rules:

- Record helpers catch and suppress any SDK failure from scope creation, tags,
  context, structured logging, or breadcrumbs. They return `void` and never
  throw into feature code.
- Capture helpers best-effort the event-local log/context and original exception,
  but suppress SDK failures. They never replace the product error being handled
  and never recursively report an observability failure through the same helper.
- Disabled helpers retain their direct no-op behavior.
- Span helpers execute the product callback exactly once. They return its exact
  value or promise and preserve its exact synchronous throw or asynchronous
  rejection.
- If span setup throws or returns without invoking the callback, the adapter
  invokes the callback once outside a span. If the callback already started,
  the adapter never calls it again.
- If the callback returned or threw before the SDK itself failed, the stored
  product result or product error wins. An SDK failure after callback completion
  is suppressed rather than replacing product behavior.

The span helper tracks whether the callback started and whether it returned or
threw; it does not implement fallback as a broad `catch { return callback(); }`,
which could execute a read or save twice. For promise-returning work, the helper
returns the exact callback promise rather than an SDK-owned replacement promise.
The wrapper also rejects a late second SDK invocation after fallback has already
run the product callback, returning or throwing the stored product outcome
without executing the callback again.

Tests use enabled fake SDKs that throw from `withScope`, tags/context, logger,
breadcrumb, `captureException`, and `startSpan`. Span tests cover failure before
callback invocation, failure after callback return, a product callback throw,
an asynchronously rejected product promise, and an SDK that returns without
invoking the callback. Every case proves exactly-once product execution and
unchanged product results/errors.

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

This boundary covers the three current note-browser calls only: list, read, and
save. The direct Slice 7A development diagnostic POST remains outside
`NoteBrowserApi`, sends no browser-generated Azurite correlation headers, and
continues proving Sentry trace/test delivery. A future product API must adopt an
explicit request-metadata boundary deliberately rather than inheriting a claim
about every `fetch` in the web application.

Custom headers are sent only when their value is present. Existing `Accept` and
`Content-Type` behavior remains intact. Requests stay relative to the Vite
origin, so the phone continues through the existing proxy and the backend stays
local-only.

### Core, Cluster, And Filesystem Evidence Boundary

`packages/core` remains Sentry-free. Fastify route instrumentation observes
inputs, validated request context, returned shared values, mapped API outcomes,
duration, and caught errors.

Core does gain the Sentry-free keyed write coordinator defined above. That
coordinator protects the existing content-hash API contract for concurrent
requests handled by Azurite; it does not emit events or accept observability
callbacks.

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

Expected validation, configuration, not-found, and conflict outcomes are
structured result events, not exceptions. Only mapped
`note_discovery_failed`, `note_read_failed`, and `note_write_failed` outcomes
capture the original unexpected caught error once at the route boundary while
Fastify/Pino logging remains intact.

### File Decomposition Boundary

The following files are already close enough to the 400-line hard limit that
implementation must split responsibility before adding instrumentation:

- `apps/server/src/notes-route.ts`: separate route registration, list handler,
  content handlers, error mapping, and route-observability construction.
- `apps/web/src/state/note-browser-route-actions.ts`: separate list/navigation
  actions from note-read actions.
- `apps/web/src/state/note-browser-editor-actions.ts`: extract save actions and
  save-result mapping before adding save evidence.
- `packages/core/src/write-workspace-note.ts`: keep filesystem write behavior
  focused and place reusable keyed coordination in a separate Sentry-free
  module.

The correlation generator, web API evidence, and Fastify correlation hook each
receive focused modules and tests. `MilkdownEditor.tsx` is untouched in Slice
7B. Every code file remains at or below 400 lines.

## Shared Correlation And Event Contract

### Attribute Vocabulary

Extend the existing shared attribute constants rather than creating web/server
copies:

| Attribute                            | Type or values              | Use                                                                                         |
| ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| `azurite.request_id`                 | UUID string                 | One HTTP attempt.                                                                           |
| `azurite.request_id_source`          | bounded enum                | Client acceptance or server fallback reason.                                                |
| `azurite.note_operation_id`          | UUID string                 | One note load/save intent.                                                                  |
| `azurite.note_operation_id_status`   | bounded enum                | Backend header disposition.                                                                 |
| `azurite.ui_request_sequence`        | number                      | Browser stale-response ordering only.                                                       |
| `azurite.note_id`                    | string                      | Validated or locally known note identity.                                                   |
| `azurite.cluster_id`                 | UUID string                 | Ready cluster identity.                                                                     |
| `azurite.cluster_identity_status`    | `ready`, `unavailable`      | Current shared identity result.                                                             |
| `azurite.cluster_identity_reason`    | existing shared reason enum | Why identity is unavailable.                                                                |
| `azurite.route_source`               | four-value enum above       | Truthful browser navigation/load source.                                                    |
| `azurite.api_error_code`             | existing shared API code    | Stable route/client error result.                                                           |
| `azurite.content_hash`               | string                      | Returned note version.                                                                      |
| `azurite.expected_content_hash`      | string                      | Save precondition.                                                                          |
| `azurite.markdown_length`            | number                      | Non-payload content size context.                                                           |
| `azurite.note_count`                 | number                      | Successful list result size.                                                                |
| `http.method`                        | `GET`, `PUT`                | Current API method.                                                                         |
| `http.route`                         | shared route pattern        | Route pattern, never an unbounded concrete URL.                                             |
| `http.response.status_code`          | number                      | Actual HTTP result where available.                                                         |
| `azurite.duration_ms`                | number                      | Measured operation duration.                                                                |
| `azurite.result_status`              | bounded lifecycle result    | `started`, `succeeded`, `failed`, `invalid`, `not_found`, `conflicted`, or `stale_ignored`. |
| `azurite.stale_completion`           | `succeeded`, `failed`       | Whether an ignored list/read completion returned data or an error.                          |
| `azurite.correlation_id_kind`        | `request`, `note_operation` | Which browser identifier could not be generated.                                            |
| `azurite.correlation_failure_reason` | bounded enum above          | Why no secure branded browser identifier was available.                                     |

Environment, release, surface, trace-header evidence, and 7A test attributes
retain their existing names. Slice 7B does not rename 7A events.

### Frontend Event Vocabulary

| Event                              | Required operation-specific attributes                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `correlation.id_generation.failed` | exact ID kind and bounded failure reason; no candidate or fabricated ID                                                            |
| `note.route.navigation_requested`  | note ID and `note_list` or `startup_fallback` source                                                                               |
| `note.route.synchronized`          | note ID when present and `url_sync` source                                                                                         |
| `api.request.started`              | request ID when available, operation ID when applicable, route, method, `started`                                                  |
| `api.request.succeeded`            | same IDs, route, method, status code, duration, `succeeded`                                                                        |
| `api.request.failed`               | same IDs, route, method, status when available, API code when available, duration, `failed`                                        |
| `notes.list.started`               | request ID when available, UI sequence, `started`                                                                                  |
| `notes.list.succeeded`             | request ID when available, UI sequence, cluster identity, note count, duration, `succeeded`                                        |
| `notes.list.failed`                | request ID when available, UI sequence, API code when available, duration, `failed`                                                |
| `notes.list.stale_ignored`         | stale request ID when available, stale UI sequence, stale completion, duration, `stale_ignored`                                    |
| `note.load.started`                | note ID, operation/request IDs when available, UI sequence, route source, `started`                                                |
| `note.load.succeeded`              | note ID, operation/request IDs when available, UI sequence, cluster identity, content hash, markdown length, duration, `succeeded` |
| `note.load.failed`                 | note ID, operation/request IDs when available, UI sequence, API code when available, duration, `failed`                            |
| `note.load.stale_ignored`          | stale note ID, operation/request IDs when available, stale UI sequence, stale completion, duration, `stale_ignored`                |
| `note.save.started`                | note ID, operation/request IDs when available, expected hash, `started`                                                            |
| `note.save.succeeded`              | note ID, operation/request IDs when available, cluster identity, content hash, duration, `succeeded`                               |
| `note.save.conflicted`             | note ID, operation/request IDs when available, expected hash, API conflict code, duration, `conflicted`                            |
| `note.save.failed`                 | note ID, operation/request IDs when available, API code when available, duration, `failed`                                         |

Browser exception ownership is exact:

| Browser result                                                                | Carrier behavior                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Any well-formed shared `ApiErrorResponse`, including a known `5xx` code       | Record `api.request.failed` plus the paired semantic result; do not capture a browser exception. |
| Fetch/network failure                                                         | Capture the normalized browser error once at `api.request.failed`.                               |
| Response JSON cannot be parsed                                                | Capture the normalized invalid-response error once at `api.request.failed`.                      |
| Non-success response does not match the shared API error schema               | Capture the normalized invalid-response error once at `api.request.failed`.                      |
| Successful response does not match the route's shared success-response schema | Capture the normalized invalid-response error once at `api.request.failed`.                      |

The API client retains the existing user-facing `WebApiError`, successful body,
and shared error-code contracts while adding an internal discriminant sufficient
to apply this policy. A well-formed backend failure is not captured again in the
browser merely because its HTTP status is `500`; the server owns the original
unexpected exception. The paired note result is always recorded without a
second capture.

The API layer always reports the transport result that actually occurred. At
the owning Zustand action layer, a stale list or read completion emits
`stale_ignored` instead of its normal `succeeded` or `failed` event. Therefore a
late failed request may correctly produce `api.request.failed` plus
`notes.list.stale_ignored` or `note.load.stale_ignored`, while never producing a
current semantic failure or mutating newer state.

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
| `note.save.started`    | request ID/source, operation ID/status when accepted, note ID and expected hash when the body is valid, route, method, `started`   |
| `note.save.succeeded`  | same IDs, note ID, cluster identity, content hash, duration, status code, `succeeded`                                              |
| `note.save.invalid`    | request ID/source, operation status/ID when accepted, API code, duration, status code, `invalid`                                   |
| `note.save.not_found`  | request ID/source, operation ID when accepted, note ID, API code, duration, status code, `not_found`                               |
| `note.save.conflicted` | request ID/source, operation ID when accepted, note ID, expected hash, API code, duration, status code, `conflicted`               |
| `note.save.failed`     | request ID/source, operation ID when accepted, note ID when known, API code, duration, status code, caught error context, `failed` |

Workspace-not-configured and invalid-body/query outcomes use the matching route
event and existing API error code. A handler emits exactly one start and one
terminal result. It does not additionally emit speculative cluster or filesystem
events.

Server exception ownership is exact:

| API outcome                                                                                               | Carrier behavior                                                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `workspace_not_configured`, `invalid_workspace`, `invalid_note_id`, `invalid_note_save`, `note_not_found` | Structured route result and breadcrumb only; no captured exception.      |
| `note_write_conflict`                                                                                     | Structured conflicted result and breadcrumb only; no captured exception. |
| `note_discovery_failed`, `note_read_failed`, `note_write_failed`                                          | Error log plus one capture of the original caught error at the route.    |

Fastify/Pino logging remains intact for every existing path. The browser never
captures a second copy of a well-formed server API failure.

### Telemetry Carrier Mapping

Extend the shared Sentry-free runtime event contract with these optional typed
fields while preserving every existing 7A caller:

```ts
type RuntimeSpanName =
  "api.request" | "note.load" | "note.read" | "note.save" | "notes.list";

type RuntimeSpanOperation =
  | "azurite.runtime"
  | "azurite.api.request"
  | "azurite.note.operation"
  | "azurite.server.route";

type RuntimeCaughtErrorContext = {
  readonly code?: string;
  readonly message: string;
  readonly name: string;
  readonly stack?: string;
};

type RuntimeSearchTagName =
  | "azurite.api_error_code"
  | "azurite.note_operation_id"
  | "azurite.request_id"
  | "azurite.result_status"
  | "http.route";

type RuntimeSearchTags = Readonly<
  Partial<Record<RuntimeSearchTagName, string>>
>;

type RuntimeObservabilityEvent = {
  readonly attributes?: RuntimeObservabilityAttributes;
  readonly name: string;
  readonly spanName?: RuntimeSpanName;
  readonly spanOperation?: RuntimeSpanOperation;
  readonly surface: RuntimeObservabilitySurface;
  readonly tags?: RuntimeSearchTags;
};
```

`RuntimeSpanName` is the bounded union `api.request`, `notes.list`, `note.load`,
`note.read`, and `note.save`. Existing 7A events omit `spanName`,
`spanOperation`, and `tags`; their span names continue to default to the existing
event name and their operation remains `azurite.runtime`. The adapters continue
to own `app.surface`; callers cannot override it through the search-tag map.
Adapters apply optional tags only inside the existing event-local `withScope`
and never install them on a global or long-lived scope.

The existing capture helpers retain their `error: unknown` parameter as the one
caught-error source. They normalize it into `RuntimeCaughtErrorContext`, set it
under the exact event-local Sentry context key `azurite.error`, and capture the
same original error. The event does not carry a second error copy that could
drift from the captured exception. For `Error` instances, `name`, `message`, and
string `stack` are preserved; a string or numeric `code` property is normalized
to string. Non-`Error` values use `name = "UnknownError"` and
`message = "A non-Error value was thrown."`; `code` and `stack` are omitted. The
original thrown value still goes to `captureException`.

Span operation mapping is exact:

| Work measured                             | Span name                              | Span operation           |
| ----------------------------------------- | -------------------------------------- | ------------------------ |
| Existing Slice 7A runtime/test work       | existing event name                    | `azurite.runtime`        |
| Browser `api.request.*` transport         | `api.request`                          | `azurite.api.request`    |
| Browser list/load/save semantic operation | `notes.list`, `note.load`, `note.save` | `azurite.note.operation` |
| Server list/read/save route work          | `notes.list`, `note.read`, `note.save` | `azurite.server.route`   |

Spans are lifecycle-neutral measurements, not a second result-event channel.
They receive immutable start-known scalar attributes: surface, identifiers,
note ID when known, UI sequence when applicable, route, method, route source,
and expected hash when known. Terminal result, response status, duration,
returned hash, cluster identity, note count, API code, and stale disposition
remain on the structured terminal event. Tags and caught-error context are event
carriers and are not copied into span attributes. This avoids pretending a span
created before its callback already knows a terminal result.

- Structured logs are the primary record for every event above.
- `recordWebRuntimeEvent` and `recordServerRuntimeEvent` provide the matching
  chronological breadcrumb for non-exception lifecycle/results.
- Web API, note operation, and server route spans measure the work with the
  exact names/operations and start-known attributes above. Nested spans do not
  replace semantic IDs or terminal structured events.
- Event-local tags are limited to searchable identifiers and bounded dimensions:
  surface, route, result, request ID, operation ID when present, and API code
  when present. They are never installed globally.
- Event-local context and structured attributes carry note ID, cluster identity,
  hashes, UI sequence, duration, header status, and caught error context.
- Captured exceptions are reserved for terminal ID-generation exceptions,
  browser network/malformed-response failures, and server
  `note_discovery_failed`, `note_read_failed`, or `note_write_failed` outcomes.
  Well-formed API responses and expected validation, configuration, not-found,
  and conflict states are not captured as exceptions.
- Full markdown, drafts, Zustand snapshots, request/response payloads, and local
  filesystem path enrichment remain Slice 7D work. Existing caught error stacks
  remain eligible diagnostic data.

## Implementation Plan

### 1. Lock The Shared Contract

- Extend `packages/shared/src/runtime-observability.ts` with the chosen event,
  attribute, result, header-status, route-source, span-operation, search-tag,
  and caught-error contracts.
- Add focused Sentry-free correlation types, header constants, and UUID schemas
  in shared modules rather than expanding one file toward the line limit.
- Reuse existing API route, API error, cluster, note, and save schemas.
- Add TSDoc for every exported type, schema, constant, and helper.
- Add shared tests for exact names, enum values, UUID acceptance/rejection, and
  header constants.

### 2. Make Observability Adapters Fail Open

- Add one small internal best-effort boundary to both 7A adapters without
  changing feature-facing imports or adding a second runtime.
- Make record and capture helpers suppress SDK carrier failures without
  recursively reporting them or changing product control flow.
- Make span helpers return the exact product callback result/promise, preserve
  the exact product throw/rejection, and execute the callback exactly once when
  SDK setup fails before invocation, fails after invocation, or does not invoke
  the callback.
- Preserve disabled synchronous no-op behavior and every existing 7A carrier,
  Replay, preload, tracing, and shutdown guarantee.
- Test throwing enabled fakes across scope, tags/context, logger, breadcrumb,
  capture, and span calls, including before/after callback and synchronous/
  asynchronous product failures.

### 3. Add The Browser Correlation Helper

- Implement the native-attempt then `getRandomValues` UUID-v4 algorithm, branded
  validation, failure reasons, and recovered/terminal exception behavior exactly
  as specified.
- Return immutable optional branded metadata and keep terminal generation
  failure non-blocking.
- Test native success, native invalid output, native throw followed by fallback
  success, HTTP-compatible fallback bit formatting, missing crypto, missing
  fallback, fallback throw, invalid formatted UUID, and both ID kinds.
- Emit one bounded generation-failure event per failed requested identifier; do
  not retry in a loop or fall back to weak randomness.

### 4. Clarify Zustand Sequence Ownership

- Rename both runtime counters, context methods, action parameters, and tests
  from request IDs to request sequences.
- Prove existing list/read overlap and stale-result behavior before correlation
  events are added.
- Repair stale list failures and prove that stale success and stale failure both
  preserve the newer result in both completion orderings.
- Do not persist request, operation, or sequence values in Dexie or URL state.

### 5. Extend The Typed Browser API Boundary

- Make `ApiRequestMetadata` an explicit parameter on all three `NoteBrowserApi`
  methods.
- Update the default API, injected fakes, and all call sites.
- Add headers only for present validated metadata while preserving `Accept`,
  `Content-Type`, method, body, response parsing, and `WebApiError` behavior.
- Instrument the centralized API request start/result and span once so actions
  do not duplicate transport evidence.
- Classify well-formed shared API errors as structured evidence only. Capture
  network, JSON parsing, malformed error-envelope, and invalid success-payload
  failures once at the browser API boundary.
- Test GET/PUT headers, missing degraded IDs, parsed success, every existing API
  error, every unexpected browser failure class, and unchanged response/body
  types.
- Prove the direct Slice 7A diagnostic POST remains outside note-browser
  correlation headers and retains its existing behavior.

### 6. Add Browser Note, Route, And Save Evidence

- Split route and editor action modules before they approach 401 lines.
- Create note operation context in read/reload/save actions and retain it in the
  async closure.
- Register startup fallback as active before URL replacement and coalesce the
  resulting same-note URL synchronization onto that in-flight operation.
- Add the per-note active-save record. Preserve `saving` through newer edits,
  coalesce an attempted same-note save onto the existing promise, and clear only
  the matching record after its terminal state transition.
- Extend current save success/conflict/failure mapping so newer markdown and its
  draft survive while the returned baseline, conflict, or failure state remains
  truthful.
- Add focused transactional draft reconciliation for a successful save that
  settles after navigation: clear only an exact base-hash-and-markdown snapshot
  match and preserve every differing or newer record.
- Emit the exact route, note-list, note-load, save, conflict, failure, and stale
  events.
- Preserve URL ownership, startup replacement, list navigation, browser history,
  `azurite-dev=sentry-test`, draft flushing, content-hash conflict protection,
  and existing visible UI states.
- Test the real router/effect startup boundary and prove one fallback produces
  one operation, request, API call, start event, and terminal event. Test rapid
  overlapping reads so stale evidence uses the stale closure rather than
  current Zustand state.
- Test editing during save, a blocked second same-note save, success/conflict/
  failure after newer edits, navigation or another-note work during save,
  exact-delete/differing-preserve draft reconciliation, matching
  active-record cleanup, and independent correlation contexts for saves to
  different notes.

### 7. Add Fastify Request Correlation

- Implement shared-header parsing and server UUID fallback in a Sentry-free
  module.
- Register a request decorator with a `null` placeholder and create a fresh
  frozen context in `onRequest` before note routes and trace evidence.
- Add Fastify type augmentation and a checked accessor.
- Keep Fastify's request ID and SDK-managed request scope separate.
- Test missing, valid, invalid, non-v4, whitespace, bounded overlong,
  comma-joined, and array-valued parser inputs plus concurrent injected
  requests. Every rejected present value is `invalid`; no test claims observable
  duplicate provenance.
- Add one real-server boundary test proving transport-level oversized rejection
  occurs before the application hook and is not covered by the unchanged
  note-response guarantee.

### 8. Serialize Core Writes And Instrument Note Routes

- Add a Sentry-free keyed core coordinator for resolved absolute note paths.
  Queue same-path tasks, allow different paths to proceed independently, and
  remove idle keys after success or failure.
- Move the current read, expected-hash validation, atomic replacement, and
  returned-note construction inside the keyed task so every queued write
  rereads and revalidates after its predecessor settles.
- Test two concurrent same-hash writes produce exactly one success and one
  `note_write_conflict`, the winning content remains on disk, failures release
  the queue, idle keys are removed, and different notes are not globally
  serialized.

- Decompose `notes-route.ts` by registration, handlers, errors, and evidence
  before adding behavior.
- Pass the Fastify request and decorated correlation context through list, read,
  and save handlers.
- Emit exactly one start and one truthful terminal route event with the current
  API error and cluster-identity contracts.
- Wrap route work in lifecycle-neutral server spans and preserve Pino logs.
- Apply the exact server exception table: stable configuration, validation,
  not-found, and conflict outcomes are structured only; discovery/read/write
  failures capture the original unexpected error once.
- Keep `packages/core` Sentry- and telemetry-free while including the reviewed
  write-ordering correctness repair above.

### 9. Prove Carrier, Failure, And Scope Isolation

- Extend both 7A adapters only as needed for selected event-local tags and
  caught-error context, exact bounded span names/operations, and fail-open
  carrier behavior; direct SDK calls remain inside the adapter modules.
- Assert logs, breadcrumbs, spans, tags, context, and exceptions against the
  exact event mapping.
- Run overlapping browser note lists, overlapping browser note reads,
  independent different-note saves, and concurrent Fastify requests with
  different identifiers. Same-note browser saves remain serialized; concurrent
  same-hash server saves prove one success and one conflict.
- Emit a runtime test event afterward and prove it contains no note, request,
  operation, sequence, hash, route-source, or API-error residue in its own tags,
  attributes, contexts, or span. Prior chronological breadcrumbs may remain as
  intentional history.
- Preserve all existing 7A helper, preload, tracing, Replay, and shutdown tests.

### 10. Run Desktop And Synthetic Pixel 6 Acceptance QA

- Use a disposable two-note cluster and an explicit Sentry-enabled debug run.
- Use the Codex Playwright CLI with its `Pixel 6` device descriptor in both the
  optimized production preview and Vite development build.
- Preserve the backend boundary by keeping Fastify on localhost and verifying
  its listener and direct-Tailscale inaccessibility. A physical Tailscale bind
  is optional supplemental evidence, not the standard QA path.
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
- Enabled Sentry scope, log, breadcrumb, capture, or span failure must degrade
  evidence only. Product callbacks execute exactly once and preserve their
  original result, throw, or rejection.
- A client-supplied correlation header is diagnostic input only; it must not
  authorize work, change note selection, bypass validation, select a workspace,
  or become an idempotency key.
- Invalid header contents must not be copied into telemetry,
  response bodies, response headers, logs, or error messages.
- Request IDs, note operation IDs, UI sequences, Fastify request IDs, editor
  session IDs, cluster IDs, and content hashes must remain distinct types and
  meanings.
- No browser or server global mutable scope may retain operation context between
  overlapping or subsequent work.
- A stale list or note response, whether successful or failed, must report its
  original closure context and must not mutate newer list, cluster, selection,
  note, editor, or recovery state.
- A startup URL replacement must not turn one fallback intent into a second
  same-note load. Same-note in-flight synchronization reuses the original
  operation, while force reload remains a new intent.
- Editing during a manual save must preserve the newer dirty markdown without
  enabling a second same-note request. The terminal save result must use its
  original operation context and must not restore an older editor snapshot.
- A successful save settling after navigation may clear only a draft matching
  its saved base hash and normalized markdown. It must preserve every differing,
  newer-baseline, or different-note recovery record.
- Concurrent same-hash writes handled by one Azurite server process must not both
  succeed. Same-path coordination produces one success and one conflict,
  different notes remain independent, failures release the queue, and idle lock
  keys do not leak.
- Each lifecycle emits at most one start and one terminal semantic result at its
  owning layer; nested API/operation/route evidence must not become an event
  storm.
- Route evidence must not claim cluster read/create provenance, filesystem
  rejection details, route-history source, or other facts unavailable at its
  boundary.
- Sentry failure, latency, or disabled state must not change callback count, API
  response shapes, status codes, filesystem writes, draft behavior, navigation,
  or conflict protection.
- Synthetic phone QA must prove the backend remains local-only behind the Vite
  proxy. If Daniel requests supplemental Tailscale evidence, bind the frontend
  only to the selected Tailscale interface.
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
- distinct branded request/operation types, UUID-v4 native generation, and
  `getRandomValues` fallback formatting;
- native throw/invalid recovery through fallback plus exact terminal ID-kind and
  failure-reason evidence;
- no weak-randomness fallback and non-blocking unavailable-crypto behavior;
- enabled web/server SDK failures across every record, capture, and span carrier
  never escape into feature code; span callbacks execute exactly once and keep
  synchronous values/errors plus asynchronous fulfillment/rejection unchanged;
- sequence-counter renames preserve list/read staleness semantics, and stale
  list successes/failures preserve the newer result in both orderings;
- explicit `NoteBrowserApi` metadata at all production and test call sites;
- GET/PUT headers, existing request headers, body parsing, API errors, and
  unchanged successful return types;
- one request ID per call and one operation ID per load/save intent;
- one startup fallback produces one same-note operation/API call despite the
  resulting URL synchronization, emits no self-induced `url_sync` semantic
  event, and preserves `startup_fallback`; force reload produces a new
  operation;
- the Slice 7A diagnostic POST remains unchanged and outside browser-generated
  note correlation;
- route-source values only at truthful emission points;
- frontend start/result attributes for read, stale read, save, conflict, and
  failure, plus list success/failure/staleness;
- editing during a save keeps newer markdown dirty and the second same-note save
  unavailable; the original success/conflict/failure retains its IDs and cannot
  restore the older snapshot;
- same-note programmatic save calls share one active promise and emit one
  operation/request lifecycle, while different-note saves remain isolated;
- save completion after navigation transactionally deletes only an exact saved
  base-hash-and-markdown match and preserves every differing or newer-baseline
  Dexie record;
- Fastify decoration ordering and fresh immutable context per request;
- valid, missing, invalid, comma-joined, whitespace, bounded overlong, non-v4,
  and defensive array-valued correlation input handling without duplicate
  provenance claims;
- transport-level oversized headers remain governed by Node/Fastify before the
  application correlation hook;
- no API body/status change for any correlation-header case;
- server fallback request IDs and omission of untrusted operation IDs;
- backend list/read/save success, invalid, not-found, conflict, workspace, and
  unexpected-failure events;
- two concurrent same-hash core and Fastify saves yield one `200` success and one
  `409` conflict with distinct request/operation IDs; the winner remains on disk,
  failures release the per-path queue, and different paths remain concurrent;
- ready and unavailable cluster identity attributes without invented provenance;
- every well-formed shared API error is structured-only in the browser, while
  network, JSON, malformed-envelope, and invalid-success failures are captured
  once there;
- expected server configuration, validation, not-found, and conflict results
  produce no captured exception; discovery/read/write failures capture the
  original error once and Pino behavior remains intact;
- overlapping browser operations and concurrent Fastify requests never exchange
  correlation context;
- the next unrelated runtime event has no residual operation tags, attributes,
  context, or span data while prior breadcrumbs remain valid history;
- exact lifecycle-neutral span names, `azurite.runtime`,
  `azurite.api.request`, `azurite.note.operation`, and `azurite.server.route`
  operation mapping, start-known attributes, event-local search tags, and
  `azurite.error` caught-error context;
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
| Edit during save  | One save/API lifecycle while newer markdown remains dirty                   | One corresponding server save lifecycle        | A second same-note save is not accepted; the first operation keeps its IDs and advances only the saved baseline without replacing newer markdown.                                         |

At least one sampled read or save should still show the 7A Sentry trace, but a
trace is corroborating evidence rather than the semantic acceptance key. Replay
must still load and remain unmasked; 7B does not require new editor-specific
Replay content.

### Exact Synthetic Pixel 6 Sentry Evidence

Use the Codex Playwright CLI with `--browser chrome --device 'Pixel 6'` and a
disposable note. Run the workflow against both the optimized production preview
and the Vite development build. Record the emulated Android Chrome user agent,
412 by 839 viewport, 412 by 915 screen, 2.625 device scale, and touch profile.

1. Open the disposable cluster and confirm browser/server `notes.list.succeeded`
   share a request ID and report no note operation ID.
2. Load `technical-architecture.md` or another named disposable note.
3. Confirm browser `note.load.succeeded` and server `note.read.succeeded` share
   the request and operation IDs.
4. Insert `PHONE-QA-7B-SAVED-<QA-DATE>` near the top through WYSIWYG, replacing
   `<QA-DATE>` with the actual local run date, and save.
5. Confirm browser/server save events share new request and operation IDs,
   status `200`, and expected/returned hashes.
6. Read the note again and confirm the marker persisted.
7. Confirm `sentry-trace` and `baggage` reach the proxy request, visible Replay
   marker text remains unmasked in the diagnostics panel, browser envelopes
   succeed, and the deliberate server route reports both trace headers. When an
   authenticated Sentry UI session is available, additionally verify the
   distinct Replay and server lifecycle evidence there; never claim that visual
   proof when access is unavailable.
8. Confirm Fastify listens only on `127.0.0.1` and is not directly reachable at
   the Mac's Tailscale address.

The QA record must explicitly say that Markdown source Enter was not used as the
save path because its newline reversion remains scheduled for diagnosis in 7D
and repair immediately afterward.

### Sentry-Disabled And Carrier-Failure Evidence

Start without enabled Sentry configuration and prove:

- no Sentry or Replay runtime is required for browser or server startup;
- correlation headers and Fastify context do not change note list/read/save
  results;
- an enabled runtime whose SDK carrier throws still cannot alter note
  list/read/save results or execute product work twice;
- note URL navigation, browser history, WYSIWYG/Markdown mode switching, manual
  save, conflict handling, draft recovery, and stale-response behavior match the
  pre-7B app;
- no correlation helper failure becomes visible product failure.

## Acceptance Criteria

- The identity ownership, UUID generation, header validation, API compatibility,
  route-source, Fastify decoration, event vocabulary, scope isolation, and
  carrier decisions in this document are implemented without unresolved
  alternatives.
- Every note-browser list/read/save API attempt has a branded UUID-v4 request
  ID; degraded browser generation remains non-blocking and the server supplies a
  trusted request ID. The Slice 7A diagnostic POST remains explicitly excluded.
- Every normal browser note read/save intent has a note operation ID that is
  transported unchanged to Fastify.
- Numeric Zustand counters are clearly named and remain local UI sequences.
- Correlation headers accept only one exact UUID-v4 value. Missing/invalid
  request IDs get a server fallback, missing/invalid operation IDs are omitted,
  and no server status claims duplicate provenance unavailable at Fastify's
  normalized request boundary.
- API response bodies, response headers, status codes, and shared error codes
  remain unchanged.
- Frontend and backend emit the exact shared lifecycle/result events with
  explicit correlation attributes.
- Enabled observability helpers fail open: record/capture failures never escape,
  and span callbacks execute exactly once with unchanged product results/errors.
- Cluster identity evidence reflects only `ready` or `unavailable`; no event
  invents read/create or filesystem-rejection provenance.
- Well-formed browser API errors and expected server configuration, validation,
  not-found, and conflict outcomes are not fake exceptions. Browser
  network/malformed-response failures and unexpected server discovery/read/write
  failures are captured once at their owning boundary with useful context.
- Overlapping browser operations, concurrent server requests, stale responses,
  and the next unrelated event prove correlation isolation.
- Stale list successes and failures cannot replace newer state, and startup URL
  replacement cannot create a duplicate same-note operation.
- Editing during save cannot start a second same-note request or lose newer
  markdown. Concurrent same-hash writes in the current Azurite process produce
  one success and one conflict; different note paths remain independent.
- Existing 7A preload, tracing, Replay, console, shutdown, and disabled-mode
  behavior remains intact.
- Existing routing, save, conflict, draft, recovery, filesystem, and Tailscale
  behavior remains intact.
- Desktop and synthetic Pixel 6 Sentry QA produce the exact join evidence
  defined above.
- The mobile Markdown newline and recovered-draft findings remain explicitly
  unfixed and handed to 7D.
- `packages/core` remains Sentry-free and no code file exceeds 400 lines.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, and
  `git diff --check` pass.
- Completion evidence records the commands, test totals, concrete IDs, Sentry
  event names, desktop/phone outcomes, and any implementation-time plan change.
- The completed repository state is clean and pushed to `origin/main`.

## Immediate Handoff To Slice 7C

After the repair, classification, and closing synthetic QA run close Slice 7B,
promote
`docs/slices/active/slice-7c-markdown-fidelity-and-honest-dirty-state.md`.
Slice 7C may rely on repaired exact-session save-result ownership, current
content-hash conflict behavior, exact draft cleanup, and the correlated note
workflow. It owns only projection-versus-authoritative Markdown fidelity; it
must not absorb route selection, block-menu interaction, backend recovery copy,
or bundle loading.

## Handoff To Slice 7D

Slice 7D may rely on these completed 7B truths:

- request-attempt IDs, note-operation IDs, UI request sequences, Fastify request
  IDs, editor session IDs, cluster IDs, and hashes have distinct ownership;
- browser operation context is closure-owned and explicit, not global scope;
- backend correlation context is request-decorated, immutable, and validated;
- web and server observability helpers fail open without becoming product
  control flow, and product work wrapped by spans executes exactly once;
- note read/save/conflict evidence joins browser and server by shared IDs;
- same-note browser saves and core writes have explicit in-process ordering,
  while different-note work retains independent correlation context;
- successful saves settling after navigation clear only an exact matching draft;
  differing recovery data remains intact;
- list/read/save route outcomes carry truthful cluster identity and API result
  context;
- event-local helper scopes and explicit attributes remain isolated under
  overlap;
- the canonical save event prefix is `note.save.*`, not `save.*`;
- 7D must enrich route failures rather than depend on a nonexistent
  `cluster.metadata.failed` event;
- 7D must test whether the fresh-cluster recovered-draft finding depends on
  cluster identity being created, reused, or copied. If that distinction is
  required to explain the behavior, revise 7D or its immediate fix to introduce
  the domain-level resolution result described in
  `docs/technical-architecture.md`; otherwise defer it to the future Cluster
  Opening And Lifecycle Foundation;
- full payload capture, editor-session, Milkdown/Crepe, Zustand/Dexie lifecycle
  instrumentation, high-frequency editor-telemetry coalescing, and
  Replay-usefulness behavior remain intentionally unimplemented;
- the mobile Markdown newline reversion and recovered-draft observation remain
  active diagnostic targets, followed immediately by the required
  editor-correctness slice.

## Completion Evidence

The authoritative QA record contains the full commands, IDs, test totals,
matrix, authenticated Sentry views, and finding classifications. Concisely:

- exact-session save-result ownership and post-persistence revalidation close
  both adversarial findings with five deterministic race tests;
- all 287 tests, strict validation, production build, and diff checks pass;
- all eight desktop/Pixel 6, development/production, enabled/disabled browser
  cells pass the current 7B workflow and preservation checks;
- closing Sentry Replay and Trace Explorer visibly join the unmasked Pixel
  workflow to the correlated Fastify save and report no unexpected issue;
- Fastify remains loopback-only and unreachable directly over Tailscale;
- the Back/sidebar race predates 7B and has a separate Slice 7F owner;
- Slice 7C is refreshed against this completed baseline and promoted next.

There are no unresolved Slice 7B implementation or acceptance questions.
