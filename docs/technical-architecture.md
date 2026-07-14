# Technical Architecture

## Purpose

This document describes Azurite's current system architecture and durable
ownership boundaries. It does not serve as a slice history, engineering-style
guide, or operational runbook.

- Product direction: `docs/product-vision.md`
- Engineering rules: `docs/engineering-standards.md`
- Product-slice workflow: `docs/working-agreement.md`
- Active and completed slices: `docs/slices/README.md`
- Operational procedures: `docs/runbooks/README.md`
- Stable contracts: `docs/reference/README.md`

## Current Stack

- Runtime: Node.js 26.x.
- Package manager: pnpm 11.x workspaces.
- Language: TypeScript 6.x across backend, frontend, shared packages, and
  repository utilities.
- Backend: Fastify 5.x.
- Frontend: React 19.x with Vite 8.x.
- Styling: Tailwind CSS 4.x through the official Vite plugin, plus local semantic
  CSS tokens.
- Markdown dialect: CommonMark plus GitHub Flavored Markdown.
- Editor: Milkdown with Crepe.
- Runtime validation and shared contracts: Zod 4.x.
- Live client state: Zustand.
- URL state: TanStack Router.
- Durable browser recovery: Dexie over IndexedDB.
- Development observability: Sentry JavaScript SDK 10.x, split into React web
  and Fastify server projects behind explicit local-debug configuration.
- Testing: Vitest for unit and integration coverage; browser tooling for rendered
  and end-to-end QA.
- Linting and formatting: ESLint 9.x and Prettier 3.x.
- Private access: local binding by default with Tailscale-oriented phone access.

The installed package manifests and lockfile are the version source of truth.
Prefer the newest compatible version line only when a focused dependency change
has verified peer compatibility and product behavior.

## Repository Shape

```text
apps/
  web/       React, Vite, editor UI, URL state, live state, browser persistence
  server/    Fastify local API, runtime configuration, server lifecycle

packages/
  core/      cluster and note filesystem behavior, markdown parsing
  shared/    runtime schemas, API contracts, stable constants

docs/
  reference/ stable product and API contracts
  research/  domain-specific research catalogs
  runbooks/  repeatable operational procedures
  slices/    active, planned, and archived delivery records
```

Frontend, server, shared contracts, and core knowledge behavior remain behind
clear package boundaries. The web app does not import server internals; the
server does not import React code; core does not depend on UI frameworks or
observability SDKs.

## Product Terminology

"Cluster" is the user-facing term for Azurite's folder-backed knowledge
container. "Workspace" remains the current implementation and API term until a
focused rename updates schemas, routes, tests, environment variables, and UI
copy together.

A cluster can live anywhere appropriate on the user's system. It is independent
of this source repository and remains usable by ordinary filesystem tools.

## Current Product Baseline

Azurite currently supports this end-to-end workflow:

1. Fastify opens a configured filesystem cluster.
2. Core discovers markdown notes and exposes safe relative note metadata.
3. The web app lists notes and selects a note through URL-owned state.
4. Core reads raw markdown within the verified cluster boundary.
5. Milkdown and Crepe render and edit the selected markdown note.
6. Manual save writes an existing note through a content-hash conflict contract
   and atomic temporary-file replacement.
7. Zustand owns live note and editor state.
8. Dexie persists unsaved drafts by durable cluster ID and note ID.
9. Reload, tab discard, missing-note recovery, and external disk changes surface
   explicit recovery or conflict states rather than silently discarding intent.

The product root and both dedicated QA roots mount their complete React trees
under StrictMode. React component tests use Testing Library's supported global
StrictMode default. Diagnostic effect replay is therefore a current lifecycle
contract rather than an opt-in test case: render is externally inert, committed
setup is repeatable, and final unmount releases Azurite-owned resources.

The implementation and completion evidence for this baseline live in
`docs/slices/archive/`.

## Knowledge And Storage Boundaries

Azurite follows the file-over-app principle:

- Markdown files are the canonical knowledge source.
- `.azurite/cluster.json` stores app-owned durable cluster identity.
- IndexedDB stores browser recovery state, not canonical note content.
- Future indexes and caches must be rebuildable from cluster files and safe to
  delete.
- Application source, installed runtime files, and user-selected clusters remain
  conceptually and physically separable.

State ownership is explicit:

- URL: addressable selected-note navigation and browser history.
- Zustand: current in-memory note, editor, save, conflict, and UI session state.
- Dexie: durable browser drafts and recovery metadata.
- Markdown files: canonical document content.
- Future derived index: note metadata, headings, tags, links, backlinks, search
  fields, and graph projections.

Do not move canonical note content into a database without explicitly revisiting
the markdown-first product promise.

The router provider creates only an inert publication during render. Each
committed setup creates and publishes a fresh TanStack browser-history, router,
and action-aware route-transition-owner generation. Retirement first makes the
generation unpublishable, then disposes route ownership and destroys that exact
history generation, restoring wrapped native history methods and releasing its
listeners, blockers, subscriptions, intents, and leases. A discarded generation
cannot receive the store executor or issue product work.

The current published route owner validates each immutable history occurrence,
admits application and traversal navigation through a target-free
pre-transition gate, and alone owns current-intent revalidation, exact
occurrence confirmation, and terminal route outcomes. The installed TanStack
History cancellation path is patched so Back, Forward, and multi-entry Go
restore the predecessor by the exact inverse delta without replacing or losing
an entry. An unconfirmed restoration retains the predecessor surface and
publishes visible degraded status instead of claiming coherent cancellation.
Native `beforeunload` blocking remains disabled.

Zustand distinguishes the live selected transition, the last committed route
view, and the rendered editor-session owner. Route reads require an exact
`route_intent` authorization; Discard retains a fresh `explicit_reload`
authorization without route or history mutation. Only matching authorization,
request, and intent identity may apply ready, missing, missing-draft, error, or
empty route truth. The production gate resolves the rendered outgoing editor
session, synchronously commits any ready WYSIWYG projection, freezes the
outgoing interaction region, and drains the exact admitted draft snapshot
before permitting destructive handoff. It consumes the same target-free Slice
7C lease and terminal settlement contract; it never receives a route target,
changes history, or becomes another route owner. Clean unread or future-version
browser recovery may be preserved through handoff, while dirty authority
without matching browser durability cancels the transition and retains the same
editor session for retry or Save. The gate runtime is the sole freeze and lease
authority: controller publication and commit synchronously consult that exact
gate state, and the gate returns the existing `RouteGateResult` directly after
its proceed/block commit decision and the persistence boundary's
`continue/block` handoff decision. A cleanup-required or failed dirty owner
blocks destructive handoff with its existing `DraftPersistenceIssue` evidence.

The note-browser store exposes only six product and gate commands. Route
transition ownership crosses into store-side work through the separate
six-operation `RouteStoreExecutor`; those operations are not Zustand actions.
Its list/read requests, intent and request sequences, editor-session allocation,
coalescing, and rollback are private to one route workflow. Draft snapshot
allocation is private to the editor/draft workflow, and Save single-flight is a
closure-owned per-note map inside the Save workflow. The store has no universal
capability context or late-filled runtime. Both recovery surfaces invoke the
same current-draft Discard command while retaining their existing visible
behavior.

The deterministic route fault controller is available only through dedicated
development and optimized QA entries. It is absent from the ordinary Vite
application graph and production build.

The 2026-07-13 post-completion adversarial review established four ownership
boundaries around that route owner and adjacent state:

- completed Slice 7C activates the candidate in Zustand only after gate
  continuation and exact-location confirmation, so cancelling the candidate
  cannot invalidate a still-loading predecessor;
- implemented Slice 7D keeps successful Save inside the existing editor session so
  the committed rendered-owner identity remains coherent, and it retains an
  exact failed draft-write retry obligation through ordered persistence;
- the deferred Route Failure Resilience slice owns exact repair when
  `navigate()` rejects after committing its history echo; and
- that resilience slice also owns malformed-target canonicalization when the
  notes-list request fails. The current validation boundary still guarantees
  zero note reads for the unsafe target.

These are explicit ownership boundaries, not alternate route or draft owners.
Exact evidence and disposition live in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`.

## API And Contract Boundaries

Stable routes, query parameters, error codes, note IDs, cluster metadata, and
response shapes originate in `packages/shared` and are documented in
`docs/reference/`.

The server validates external input and keeps route handlers thin. Filesystem
resolution, discovery, reading, metadata, hashing, and writing live in
`packages/core`.

Current note writes:

- accept only validated workspace-relative markdown note IDs;
- require the expected content hash;
- reject stale writes with the shared conflict response;
- serialize same-path writes within one Azurite server process so concurrent
  same-hash attempts cannot both succeed, while different paths remain
  independent;
- preserve dominant existing line endings;
- write a temporary file in the target directory and rename it over the
  original;
- never expose absolute filesystem paths in browser responses.

### Request And Note-Operation Correlation

Azurite owns semantic correlation independently of Sentry sampling. Shared
branded UUID-v4 contracts keep three identities distinct:

- one request ID identifies one HTTP attempt;
- one note-operation ID identifies one browser load or manual-save intent and
  may span future retry attempts; and
- numeric Zustand request sequences exist only for stale-result ownership in
  the current browser session.

The browser creates IDs with cryptographically secure platform APIs and sends
them through shared correlation headers. ID-generation failure degrades
evidence without blocking the request. Fastify validates each header into a
fresh immutable request context, creates a server request ID when client input
is absent or invalid, and omits an invalid operation ID. Correlation input is
diagnostic only: it never authorizes work, selects a cluster or note, changes a
response, or acts as an idempotency key.

Browser operation context remains closure-owned, and server context remains
request-owned. Startup same-note synchronization reuses one load intent;
overlapping reads retain independent context and stale completions cannot
replace newer state. Manual save is single-flight per note in the browser.
Editing during an active save preserves newer dirty markdown while the original
snapshot settles. Every editor lifetime has an exact session key; success,
conflict, or failure may mutate only the session that originated the save, and
failure/conflict paths revalidate that owner after asynchronous draft
persistence before applying terminal state. Successful Save updates the same
session's baseline, hash, metadata, and compatible browser-record disposition;
it does not recreate Crepe or stale the committed route view. Conditional
cleanup removes only the exact saved recovery snapshot, preserves mismatching or
future-version data, and exposes a separate cleanup retry when deletion fails.
Core's keyed write coordinator provides the corresponding same-path in-process
conflict guarantee without introducing Sentry or telemetry into `packages/core`.

### Cluster Resolution And Filesystem Error Evolution

The current shared `ClusterIdentity` is an outcome contract for browser state:
it reports either a durable `ready` cluster ID or an `unavailable` reason. A
missing `.azurite/cluster.json` is an internal transient condition because core
immediately attempts race-safe creation. The public identity therefore does not
expose raw metadata-read states or whether a ready identity was loaded from an
existing file, created by the current call, or reused after a concurrent
creator won.

A future Cluster Opening And Lifecycle Foundation owns a separate domain-level
resolution result for that provenance. It must cover user-selected cluster
opening, a cluster picker and recent clusters, existing versus newly initialized
identity, invalid metadata inspection and recovery, copied-cluster identity,
an explicit make-this-copy-a-new-cluster operation, metadata migrations,
external or synced directories, moved folders, and the workspace-to-cluster
terminology migration. Keep durable identity separate from resolution history;
do not add a transient `missing` identity state to current note responses.

Introduce this resolution result earlier only if Slice 7E or its immediate Slice
7F editor-correctness follow-up proves that created, reused, or copied cluster
identity is required to explain the fresh-cluster recovered-draft behavior.

The current core error taxonomy is sufficient for existing note read and manual
save outcomes, but it is not the permanent contract for broader filesystem
behavior. Extend stable core and shared error reasons before implementing the
first capability that requires different recovery or security behavior for
different filesystem causes. The hard trigger is whichever comes first:

- create, rename, move, delete, trash, or restore;
- file watching, external-edit detection, or derived indexing; or
- multi-cluster opening across external or synced folders.

The richer contract must distinguish actionable product, filesystem, and
security outcomes without inferring them from error messages. It must exist
before path-affecting operations are accepted through a hardened multi-device
or authenticated hosting surface. Build it with the first triggering product
capability, not as telemetry-only state inside an observability slice.

## Markdown Rendering And Editing

Exact Markdown loaded from disk, recovered from a compatible browser draft, or
accepted through an editor-session publication is Azurite's authoritative
current content. Milkdown with Crepe owns the active WYSIWYG projection, not an
alternate canonical document. Source mode remains an exact complementary
editing path. Dirty state compares authoritative current Markdown with the exact
saved baseline using CRLF-to-LF equivalence only; it does not trim whitespace,
parse an AST, or treat serializer-equivalent syntax as clean.

Zustand's exact current `EditorSession` is the sole accepted live editor truth.
One replay-stable React-owned Markdown-authority controller adapts each
`sessionKey`; a narrow synchronous exact-key reader supplies its current
Markdown, revision, draft disposition, and mode without copying those fields.
The controller survives StrictMode's diagnostic effect cleanup and remains the
projection/checkpoint adapter for that accepted product session; it is not
product state or durable storage. A separate Crepe-generation lifecycle serializes
disposable WYSIWYG generations. Each committed generation receives a unique DOM
host and callback identity, retires before teardown, and must still be current
before it can publish, focus, replace Markdown, or change readiness. Successful
predecessor destruction settles before a successor starts, so a stale
completion can neither affect nor destroy the retained generation.

Source input remains editable and publishes exact content while Crepe is
creating or unavailable. Creation, readiness, source-to-WYSIWYG replacement,
WYSIWYG-to-source display, and same-mode selection are synchronization events
and do not publish content, increment a revision, create a draft, or enable
Save. Same-session rerenders and successful Save retain the current Crepe DOM,
selection, synchronization checkpoint, and Undo history.

If official Milkdown `Editor.create()` rejects while its public state remains
`OnCreate`, Azurite preserves that failure, retires the adapter generation,
disconnects its host, rejects stale callbacks, and keeps exact source mode
usable. Azurite does not patch Milkdown or claim terminal cleanup of Milkdown's
private partial resources or internal retry timer after that upstream failure.
Successful Milkdown generations are destroyed through the documented public
API and leave no live Azurite-owned generation on final unmount.

The controller keeps only adapter-local projection truth: the acknowledged
serialized projection, exact/projection checkpoint, rejected visible candidate,
readiness/error state, and publication/synchronization guards. Exact source
input publishes synchronously. Ready active WYSIWYG updates publish through
Milkdown's bounded listener, while Save, mode changes, route transitions,
`visibilitychange`, and `pagehide` first read the live public `getMarkdown()`
projection synchronously. Returning to the checkpoint projection restores its
exact source spelling. A rejected publication remains visible and explicitly
retryable but is never accepted authority and cannot authorize Save or
destruction. Publication returns accepted/rejected with the exact rejection
cause; commit returns proceed/block. Neither result echoes store-owned session
content or metadata. Rich-editor creation or
synchronization failure remains visible beneath temporary publication failures
while exact source editing continues.

Publication acknowledgement combines product authority with immutable in-memory
draft admission. The session prepares an inactive snapshot before the exact
Zustand updater, records whether that updater applied before subscribers run,
and then commits or cancels the prepared slot exactly once. A subscriber throw
after mutation therefore cannot acknowledge authority without its matching
recovery obligation or schedule the revision twice. Missing cluster identity
admits the original snapshot to a session-scoped unbound slot and reports a
typed persistence issue; it does not reject the accepted edit or disable manual
Save.

Browser draft persistence composes the generic browser-safe
`KeyedTaskCoordinator` exported by `@azurite/shared` with a web-specific
coordinator. The web coordinator owns unbound slots, scheduled/coalesced
snapshots, consistent reads, content and mode writes, clean reconciliation,
successful-Save cleanup, cleanup retry, durability drains, and terminal Discard
barriers per cluster/note key. Reads cannot overtake scheduled mutations, failed
tasks release their keyed tail, and a failed write retains its exact immutable
snapshot for explicit retry without another edit. Different notes remain
independent; coordinator state is ephemeral and does not change the version-one
Dexie record.

Dexie validation and transaction outcomes remain private to that persistence
boundary. Ordered callers receive only `absent/current/protected/failed`; Save,
cleanup retry, and Discard share one mutation translation to
`cleared/unchanged/protected/failed`, with exact storage evidence retained only
for diagnostics. Snapshot supersession remains coordinator-private lifecycle
state. Recovery and Discard publish no ignored result payload: their observable
truth is Zustand state, the exact issue, the retained or restored surface, and
durable storage.

The editor store keeps browser-record disposition separate from persistence
failure. Disposition distinguishes absent, generated pending/durable, recovered,
conflicted, cleanup-required, recovery-read-unavailable, and preserved-unknown
truth. A persistence issue separately names its owner, epoch, operation,
revision or snapshot, underlying cluster/Dexie/coordinator reason, and permitted
retry. Dexie reads and mutations return exact transactional outcomes rather than
generic success. An unread record is retried only while live authority is clean;
an unknown future-version record is never treated as absent, overwritten, or
deleted by the older build. Dirty content in either protected state remains
manually saveable but cannot hand off destructively until disk Save makes it
safe. React receives one ordinary retry command; Zustand selects recovery,
exact-snapshot, or successful-Save cleanup retry from the current issue.
Terminal Discard retry remains inside the Discard workflow.

Discard is terminal for one exact-owner draft-admission epoch. It cancels
not-yet-started work, waits behind started mutations, conditionally deletes only
a compatible record, and reloads or dismisses recovery only after deletion
succeeds. Failure preserves the same editor/view and opens the next epoch before
interaction resumes, so closed-epoch callbacks can never recreate the discarded
record. Preserved future-version records expose no destructive older-build
action.

After Daniel accepts a real WYSIWYG edit, Milkdown serialization may normalize
Markdown syntax beyond the localized change. Azurite records that serialized
projection as the accepted authority; token-preserving source reconciliation is
a separate future architecture, not a guarantee of the current editor.

Editor capabilities must round-trip through Azurite's selected markdown dialect.
Do not introduce proprietary blocks or a canonical JSON document model without
a deliberate product decision.

Any separate markdown-to-HTML rendering path must sanitize output before DOM
insertion. Raw HTML remains disabled unless a focused slice defines and tests a
safe extension.

### Editor Loading And Bundle Boundary

Milkdown with Crepe remains Azurite's selected editor architecture. Replacing it
to reduce dependency weight is not an accepted optimization direction without a
new explicit product decision.

The current static editor import makes the full WYSIWYG dependency graph part of
the initial web entry chunk. Daniel is interested in a future lazy-loading
boundary that renders the application shell and note list before dynamically
loading the rich editor. Slices 7B through 7D and the StrictMode lifecycle
foundation are complete. Default the loading boundary's delivery until after
Slice 7E diagnostics and the mandatory Slice 7F editor-correctness follow-up so
those repairs and their QA observe the current editor lifecycle before its
loading order changes.

A focused future performance slice must measure development and built-preview
cold start, time to application shell, time to editor readiness, emitted chunk
sizes, and desktop/phone behavior. It may then introduce a dynamic editor import
while preserving the selected Milkdown/Crepe feature behavior, WYSIWYG and
Markdown behavior, draft recovery, routing, save/conflict guarantees, and
Sentry-disabled/full-debug evidence. Raising Vite's warning threshold or
merely splitting immediately required code into smaller files does not satisfy
that outcome.

## Browsing, Indexing, And Search Direction

Direct filesystem discovery is acceptable for the current baseline but already
measured roughly 2.8–3.2 seconds for 555 copied markdown files. A future indexing
slice should introduce a rebuildable derived index when repeated scans prevent a
responsive browsing or search workflow.

UI packages may render trees, virtualize rows, or provide search controls. They
must not own note identity, cluster rules, filesystem semantics, or canonical
knowledge state.

An indexing decision must define:

- rebuild and invalidation behavior;
- file-watch and external-edit semantics;
- schema ownership and migration behavior;
- search, backlink, and graph consumers;
- failure and recovery behavior when derived state is missing or corrupt.

## Local Server Lifecycle

The local Fastify server shuts down gracefully on `SIGINT` and `SIGTERM`.

- Shutdown handlers live in the server entrypoint or lifecycle boundary, not in
  route modules.
- Fastify stops accepting work before process exit.
- Intentional local shutdown remains quiet and bounded by a short fallback.
- Observability flush work may extend the enabled-mode fallback only when the
  flush budget remains shorter than the process-exit budget.

## Local And Tailscale Access

Azurite binds locally by default. Routine Pixel 6 synthetic QA runs through the
loopback Vite proxy while the backend remains on `127.0.0.1`. When Daniel
explicitly requests supplemental physical-phone or tailnet evidence, Vite binds
only to the required Tailscale interface and continues to proxy API requests.

The optional physical-phone procedure, including MagicDNS and allowed-host
handling, lives in `docs/runbooks/tailscale-phone-access.md`.

Authentication, packaged-service hosting, and any broader network exposure
remain explicit future architecture decisions. Public internet exposure is not
part of the current product boundary.

Vite currently emits minified, content-hashed production assets, but Azurite has
no production asset server or committed delivery policy yet. The gzip sizes in
build output are estimates, not proof that a runtime serves compressed content.
Production compression, Brotli/gzip negotiation, and long-lived immutable cache
headers remain part of the future production distribution decision; Vite's dev
and preview servers are QA tools, not that delivery architecture.

## Development Observability

Sentry owns Daniel-enabled development error capture, structured logs, tracing,
and browser Session Replay. Azurite owns typed configuration, shared event
contracts, and small runtime adapters; observability does not become product
state, and `packages/core` remains free of Sentry imports.

The browser runtime uses `@sentry/react` and the backend uses `@sentry/node`.
Both are disabled unless the matching enabled flag is the literal `true` and a
DSN is present. The web entrypoint dynamically loads its SDK runtime before
React render only when enabled. The server starts through Azurite's custom ESM
preload, which loads the optional root `.env.local` and dynamically imports the
Node SDK before Fastify only when enabled. Fastify 5 uses Sentry's supported
diagnostics-channel integration; Pino remains the local server log.

Enabled browser debug sessions use uncensored Replay defaults, explicit trace
sampling, and warning/error console capture. Relative browser API requests are
trace-propagated through Vite to local-only Fastify. Enabled backend shutdown
closes Fastify first, flushes Sentry for up to `1000ms`, records the result, and
uses a bounded `400ms` follow-up flush to deliver that result. Its `1500ms`
fallback remains longer than both budgets together. Disabled shutdown retains
the original `500ms` fallback and performs no Sentry work.

Typed helpers in `packages/shared`, `apps/web`, and `apps/server` implement
request/note-operation correlation and form the extension seam for planned
semantic diagnostics. They emit bounded list, load, save, API, and server-route
lifecycles with exact IDs and outcome attributes. Runtime adapters are
fail-open: SDK record, scope, capture, or span-carrier failure cannot alter a
product callback's count, identity, result, throw, or rejection. Direct Sentry
calls stay inside runtime adapter modules. Operational configuration and proof
steps live in `docs/runbooks/sentry-debug.md`.

Explicit debug mode may capture complete Azurite product data needed to diagnose
failures. Credential containment from
`docs/reference/product-guardrails.md` still applies.

After Slice 7E and its mandatory Slice 7F editor-correctness follow-up, a
focused Daily Observability Operating Profile may establish three explicit
modes:

- disabled, which retains the current zero-SDK-runtime baseline;
- lightweight daily, which may remain permanently enabled for Daniel with
  errors, bounded breadcrumbs, measured trace sampling, and error-triggered or
  modest Replay; and
- full debug, which retains exhaustive 7B/7E semantic diagnostics, uncensored
  Replay, high sampling, and bounded rich product payloads behind deliberate
  configuration.

This remains an evidence-gated future decision. Slice 7E must leave usable
configuration seams and record disabled-versus-full-debug responsiveness and
event-volume evidence. The later operating-profile slice must measure its actual
daily candidate before enabling it permanently; it must not weaken full debug or
eliminate the completely disabled troubleshooting baseline.

## Security Architecture

- Treat markdown and filesystem content as untrusted input.
- Validate API inputs and outputs through shared runtime schemas.
- Restrict reads and writes to the configured cluster root.
- Reject traversal, ignored-directory access, and escaping symlinks.
- Keep the backend local by default and restrict trusted origins.
- Require origin checks or equivalent CSRF protection for state-changing routes.
- Keep unsafe HTML out of the browser unless it passes the approved sanitizer.
- Add Content Security Policy before broadening the installable PWA surface.
- Keep secrets out of committed files, browser payloads, and telemetry.

Security claims must be backed by boundary validation and failure-mode tests,
not by assuming unsafe states are impossible.

## Deferred Architecture Decisions

These decisions remain open and should be settled by the first product slice
that genuinely needs them:

- cluster picker and persisted local cluster configuration;
- full workspace-to-cluster implementation terminology migration;
- derived index, file watching, search, backlinks, and graph storage;
- PWA service-worker and offline behavior;
- authentication and hardened Tailscale hosting;
- a measured lightweight daily Sentry operating profile after Slice 7E and the
  mandatory Slice 7F editor-correctness follow-up;
- production distribution and update strategy;
- release source-map upload and production observability policy;
- CI provider and required checks;
- exact supported desktop and mobile browser matrix.
