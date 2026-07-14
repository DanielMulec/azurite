# Post-StrictMode Ownership Simplification

## Status

Proposed from the documentation-only Task 3A analysis at commit
`2812920ac5a299cc1df3cfeeb4a13f744114f54b`. No production implementation is
approved or active. Daniel must approve production implementation of the
sequential units; Slice 7E remains planned, unrefreshed, unpromoted, and
unimplemented until all four selected units below are complete, unless Daniel
explicitly reselects this proposal's scope.

Follow the bounded-review and concise-document rules in
`docs/working-agreement.md` throughout implementation and promotion.

## Product Decision

Azurite will simplify the implemented editor and recovery workflow before Slice
7E instruments it. Four separately reviewable units run in this order:

1. consolidate editor-session authority;
2. simplify persistence results;
3. replace the distributed store capability context with workflow boundaries;
4. extract the shared Sentry fail-open carrier.

The sequence is deliberately serial on `main`; every unit re-baselines after its
predecessor. Persistence and store work remain separate because the current call
graph permits a smaller persistence contract while all store workflows continue
to work. Combining them would mix result semantics with route, save, and store
ownership without completing additional user value.

This is consolidation, not a rewrite. Zustand remains the accepted live product
authority, the Markdown controller remains a projection/checkpoint adapter,
Crepe remains a disposable WYSIWYG runtime, the editor gate remains a transient
handoff capability, the draft coordinator retains ordering obligations, Dexie
retains durable recovery, the route owner retains navigation authority, and
Sentry remains diagnostic infrastructure.

## User Story

As an Azurite user, I can keep editing exact Markdown, switch modes, Undo, Save,
navigate, resolve conflicts, and recover drafts with the same dependable
behavior while the implementation has fewer mirrored truths, result ladders,
capabilities, translations, and caller branches for later diagnostics to
observe.

## Verified Evidence And Architecture

The July 13–14 discussion in
`docs/follow-ups/slice-7d-simplification-discussion.md` supplied hypotheses, not
contracts. The completed StrictMode evidence supersedes its incomplete baseline:
the seven legitimate product authorities remained **7 -> 7**, lifecycle work
added a legitimate Crepe-generation coordinator, and its fixed direct scope
grew **2,861 -> 3,186** production lines. Repository code, tests, completed
Slice 7D/StrictMode QA, and current architecture established every decision
below; no JSONL transcript was needed.

Physical envelopes overlap and must not be summed:

| Seam               |                                                                   Current physical production envelope | Verified vocabulary and caller evidence                                                                                                                                                                                 |
| ------------------ | -----------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor session     | 4,274 lines: store/contracts 1,204; controller family 935; Crepe/hook 532; gate 569; React chain 1,034 | 15-field `EditorSession`; four mirrored controller fields; publication 3 statuses/6 reasons; synchronization 3 statuses/5 causes/4 failure reasons; commit 4 variants/3 statuses/6 reasons; gate preparation 5 variants |
| Persistence ladder |      6,859 lines across 34 files: storage/coordinator 1,532; Zustand translations 3,813; gate/UI 1,514 | 12 result families, 55 union members, 22 status literals, 18 failure/rejection reasons, 8 dispositions, 6 operations, and 4 retry actions                                                                               |
| Store engine       |               4,925 lines across the 20 `StoreContext` consumers; 5,723 lines in the full state folder | 26 injected context members, only 24 consumed; 120 `context.*` calls; Zustand exposes 16 actions plus 7 state fields                                                                                                    |
| Sentry fail-open   |                            900 lines: shared runtime contract 287, web adapter 299, server adapter 314 | Web/server adapter diff changes only 22/37 lines; both implement the same record, capture, scope, attribute, error-context, and span decisions                                                                          |

Principal production anchors, with baseline physical lines, make those
envelopes reproducible:

- Editor: `note-browser-store.ts` 371, `note-browser-contracts.ts` 140,
  `note-browser-authority-actions.ts` 398, controller 391 plus 544 across its
  four helper files, `crepe-generation-lifecycle.ts` 287,
  `editor-session-gate.ts` 369 plus 200 in types/results, and the five-file React
  chain 1,034.
- Persistence: `draft-database.ts` 383, coordinator 388 plus 179 in its
  coordinated/types/helper files, `draft-workflow-types.ts` 295, cleanup 278,
  recovery 365, Discard 185 plus result builders 111, and durability 295.
- Store: `note-browser-contracts.ts` 140, store 371, action utilities 368, route
  actions 281, and `route-store-executor.ts` 134.
- Sentry: shared `runtime-observability.ts` 287,
  `web-runtime-observability.ts` 299, and `server-runtime-observability.ts` 314.

### 1. Editor-Session Authority

Current responsibilities are sound except for copied accepted truth:

- Zustand's `EditorSession` owns current/saved Markdown, revision, mode,
  session and snapshot identity, save/conflict state, draft disposition/epoch,
  persistence issue, note metadata, and the disk baseline/hash.
- `MarkdownAuthorityController` legitimately owns the exact/projection
  checkpoint, acknowledged Crepe projection, rejected visible candidate,
  source projection, readiness/error view, and synchronization guards. Its
  `#acknowledgedAuthority`, `#revision`, `#disposition`, and `mode` copy Zustand
  truth. Mode-only revision and asynchronous draft settlement can already make
  those copies stale before the next publication.
- `CrepeGenerationLifecycle` owns current-generation identity, DOM/runtime,
  predecessor teardown, stale-callback rejection, and four meaningful terminal
  outcomes. It owns no accepted Markdown.
- `EditorSessionGateRuntime` owns registration, leases, handoff preparation,
  freeze UI, focus restoration, lifecycle flush, and terminal Discard
  protection. Its `frozenSessionKey` currently has a second copy in controller
  `#frozen`.
- React only assembles replay-stable objects, subscriptions, registration, and
  committed Crepe activation.

The result chain repeats decisions: publication echoes command and store fields,
commit wraps publication, gate preparation wraps commit and durability, then
`mapEditorRouteResult` reduces five variants to the two-variant route result.
Production branches use publication accepted/rejected, commit failed/non-failed,
and route continue/cancel. `updateDraftMarkdown` has no production caller; tests
use it instead of the real publication path. Controller `destroyed`,
synchronization cause `already_current`, and commit reason `editor_not_ready`
likewise have no production construction path.

### 2. Draft-Persistence Result Ladder

The essential owners are distinct: Dexie validates and performs transactions;
the shared keyed primitive serializes same-key work; the draft coordinator owns
prepared, unbound, scheduled, failed, and closed-epoch obligations; Zustand owns
visible disposition and `DraftPersistenceIssue`; the gate decides destructive
handoff; UI renders state and permitted retry.

The excess is translation:

1. recovery maps record validation -> Dexie read -> coordinated read -> route
   draft application -> Zustand disposition/issue -> `RecoveryReadResult`;
2. writes map Dexie mutation -> `DraftSnapshotResult` -> Zustand settlement ->
   four-way durability -> five-way gate preparation -> route continue/cancel;
3. Save cleanup and cleanup retry separately classify the same seven mutation
   statuses; and
4. Discard maps those statuses to another four-way result which production UI
   ignores.

Ordering, coalescing, exact immutable retry, queue-tail release, different-note
independence, conditional cleanup, future-schema protection, and terminal epoch
closure are real behavior and remain. Detailed failure evidence belongs once in
`DraftPersistenceIssue`, not repeated in every public result.

### 3. Distributed Store Capabilities

The claimed 26 is exact for internal `StoreContext`, not for product
capabilities. The members split into API access; 15 route/list/read ownership,
sequence, and rollback operations; three active-Save operations; coordinator
and cleanup-retry access; two allocators; and generic `get`/`set`. Two members,
`draftPersistence` and `setCurrentRouteIntent`, are unused. Construction casts
`{}` to the full context and late-fills it through `configureContext`.

The 16 Zustand actions are six route-executor operations, eight UI operations,
one gate flush, and dead `updateDraftMarkdown`. Three persistence-retry callbacks
are threaded under 66 prop-name occurrences even though `retryAction` already
selects the operation. Two Discard actions already converge on one target
workflow. Route results remain materially consumed and must not collapse;
recovery and Discard results are widened to `Promise<unknown>` and ignored by UI,
while the gate branches only on durability unavailable versus safe.

### 4. Shared Sentry Fail-Open Foundation

`packages/shared` already owns the Sentry-free event contract and the
exactly-once `runFailOpenRuntimeSpan`. Web and server then duplicate three
decision trees: disabled/enabled event recording, scoped/fallback error capture,
and direct/fail-open span execution, plus identical attribute filtering,
scope/tag/context application, caught-error normalization, and best-effort
guards. The server's enabled check and flush are the only additional runtime
behavior. SDK initialization, configuration, Replay, Fastify integration, and
shutdown budgets are legitimately surface-specific.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Exact editing, mode switching, Save/conflict, ordered recovery, route handoff, lifecycle cleanup, and fail-open runtime evidence.                                    |
| Predictable extensions | Slice 7E observes the simplified semantic boundaries; Slice 7F uses that evidence for editor correctness.                                                            |
| Participating layers   | React, Zustand, Markdown/Crepe adapters, editor gate, route executor/owner, coordinator, Dexie, shared/web/server observability, tests, and browser QA.              |
| Near-term seams        | One live editor truth with read-only adapter projection; caller-oriented persistence decisions; direct workflow commands; one shared stateless fail-open carrier.    |
| Exclusions             | New product behavior, instrumentation, owner, storage boundary, dependency, QA app, build entry, framework, Slice 7E refresh/promotion, and Slice 7F implementation. |

## Implementation Plan

### 1. Consolidate Editor-Session Authority

- Make controller decisions read the exact current Zustand session instead of
  storing accepted Markdown, revision, disposition, or mode copies. React
  renders accepted source/mode from Zustand and retains only a rejected visible
  candidate locally.
- Make the gate's session freeze the only freeze truth; the controller reads
  that capability instead of owning `#frozen`/`setFrozen`.
- Remove controller `destroy()`, lifecycle `destroyed`, listener clearing, dead
  result arms, `updateDraftMarkdown`, duplicated `#runtime` in the Crepe
  lifecycle, and builders/mappers left without a caller decision.
- Reduce publication to accepted/rejected at its caller boundary, commit to
  proceed/block, and gate preparation directly to `RouteGateResult`. Preserve
  precise cause/reason evidence without echoing Markdown, revision,
  disposition, session, and command fields already owned elsewhere.

Expected deletion is concrete: controller accepted mirrors **4 -> 0**, freeze
owners **2 -> 1**, controller lifecycle states **4 -> 3**, registered controller
capabilities **3 -> 2**, store actions **16 -> 15**, gate preparation variants
**5 -> 0** in favor of the existing route result, and one gate translation
layer disappears. This is stable before persistence changes because the
coordinator and current store workflows remain intact.

### 2. Simplify Persistence Results

- Keep Dexie transactional detail private. Expose one ordered read decision
  (`absent/current/protected/failed`), one mutation decision
  (`cleared/unchanged/protected/failed`) with non-branching storage evidence,
  and one handoff decision (`continue/block`). Coordinator-private supersession
  remains lifecycle state.
- Keep `DraftPersistenceIssue` as the single detailed diagnostic carrier and
  combine the three non-Discard retry callbacks into one command selected from
  the current issue.
- Delete `CleanupResult`, `RecoveryReadResult`, `DiscardResult`,
  `CoordinatedDraftReadResult`, `CoordinatedDraftMutationResult`, unused
  `DraftMutationResult`, public result builders used only by tests, the
  `queue_failed` translation status, duplicate cleanup classifiers, and
  unreachable union arms proven by compiler/search evidence.
- Return `Promise<void>` from recovery and Discard actions; state, issue, and
  storage remain their observable product result. Replace four-way durability
  with the gate's two caller decisions.

The three removed workflow declarations plus the dead alias already account for
**131 current physical lines including their TSDoc** before builder and mapping
deletion; five named result families and at least two result-only caller branches
disappear. Store route and save ownership do not change, so the next unit starts
from a stable smaller persistence contract rather than an immediately obsolete
one.

### 3. Establish Store Workflow Boundaries

- Delete `StoreContext`, `NoteBrowserRuntime.context`, `configureContext`, and
  `createRouteRollbackContext`; do not replace them with another universal
  context, engine, or renamed 26-member wrapper.
- Construct the existing six-operation `RouteStoreExecutor` directly over the
  current store runtime. Keep the route owner authoritative while route/list/read
  ephemera, sequences, and rollback remain private to the store-side route
  workflow instead of round-tripping through Zustand actions and 15 injected
  primitives.
- Keep Save single-flight inside one Save workflow instead of a public
  get/set/clear trio. Keep session/snapshot allocation in the workflows that
  consume each identity.
- Delete unused `draftPersistence` runtime/context state,
  `setCurrentRouteIntent`, the forwarding route-executor copy, the
  `note-browser-actions.ts` barrel, obsolete `baseline-route-draft-gate.ts`, and
  combine the two Discard entries into one current-draft command.

This unit must re-measure after units 1–2. Its stable outcome is removal of the
26-member generic capability surface and late-fill cast, not relocation: the two
dead members, route/save wrapper protocols, forwarding layers, duplicate
Discard entry, and their parameter threading must cease to exist.

### 4. Extract The Shared Sentry Fail-Open Carrier

- Add one stateless, Sentry-free shared carrier implementation receiving the
  existing minimal SDK/config values. Keep active runtime installation and SDK
  initialization local to web/server; keep enablement/flush server-only.
- Remove one duplicate implementation of record, capture, span, attribute,
  scope, caught-error, and best-effort decisions. Thin local functions preserve
  current caller names without reimplementing the branch trees.
- Do not add semantic events, payloads, state snapshots, instrumentation, or
  Slice 7E behavior.

The duplicated adapters contain more than 200 lines of common decision logic;
combined production lines and fail-open branch implementations must decrease,
with the three common decision trees **2 copies -> 1**. This foundation is
independently useful and is the last prerequisite before any Slice 7E refresh.

## Negative Side-Effect Guardrails

Baseline: [Product guardrails](../../reference/product-guardrails.md).

- A smaller editor contract must not recreate Crepe, reset Undo/selection,
  change exact source spelling, accept a stale callback, or authorize Save or
  handoff after a rejected publication.
- A smaller persistence contract must not let reads overtake writes, recapture a
  failed retry, delete a newer/future record, lose an epoch barrier, or turn a
  blocked destructive handoff into continuation.
- Store workflow consolidation must not move route-intent activation before gate
  continuation/location confirmation, invalidate a still-loading predecessor,
  weaken stale-result ownership, or merge same-note and different-note Save
  behavior.
- Shared fail-open extraction must preserve disabled no-op behavior, product
  callback identity/count/result/throw/rejection, scope isolation, and enabled
  server shutdown flush semantics.

## Verification Plan

Existing proof is anchored in `markdown-authority-controller`,
`editor-session-gate`, and `app-router` tests for editor authority;
`draft-database-mutation-outcomes`, `draft-persistence-coordinator`, recovery,
Discard, and concurrency tests for persistence; store/hardening/save ownership
and the four route-owner suites for store workflows; and the shared, web, and
server `runtime-observability` suites for Sentry. The completed Slice 7D and
StrictMode QA documents supply browser and preserved-behavior evidence.

| Unit                | Required proof                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor authority    | Controller, Milkdown, StrictMode, gate, mode-revision, draft-settlement, Save-session, route, recovery, and future-schema suites; product and Markdown-QA desktop/Pixel 6 development and optimized-production acceptance including exact source, WYSIWYG, Undo, mode switch, Save/conflict, Back/Forward, failure fallback, and unmount.               |
| Persistence results | Database mutation, coordinator, recovery, Discard, gate, save-session, concurrency, route-race, and lifecycle tests prove ordering, exact retry, queue release, conditional cleanup, future-schema preservation, same-surface failed Discard, one replay receipt/write, and zero final obligations; desktop/Pixel 6 recovery acceptance in both builds. |
| Store workflows     | Route owner application/cancellation/outcome/lifecycle, store, hardening, concurrency, recovery, Discard, Save ownership, gate, and UI suites; both-build desktop/Pixel 6 startup, sidebar/history, edit/Save/conflict, recovery/Discard, and unmount acceptance.                                                                                       |
| Sentry carrier      | Shared, web, and server runtime-observability tests cover disabled/enabled record/capture/span, hostile SDK carriers, exact product outcome, server enablement/flush, API/note correlation, and unchanged SDK-free core/product boundaries; full builds suffice because no product UI changes.                                                          |

Every unit records before/after production lines, owners, result families,
statuses, capabilities, translation layers, and material caller branches. Run
focused proof, then:

```sh
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

## Acceptance Criteria

- The four units remain separately approved and serial; persistence and store
  simplification are not combined and no parallel implementation uses the same
  `main` baseline.
- Each unit deletes the named code and shows a net reduction in at least one
  accepted dimension; moved or renamed ceremony does not qualify.
- Exact Markdown, readiness/fallback, mode switching, Undo, Save/conflict,
  routing/history, ordered recovery, future-schema, security, data integrity,
  and StrictMode resource/action guarantees remain true.
- The linked shared and slice-specific guardrails are proven at each changed
  boundary.
- Slice 7E remains unrefreshed, planned, unpromoted, and unimplemented until
  Daniel explicitly approves later production work after these prerequisites.
- Validation passes, the repository is clean on `main`, and the complete state
  is synchronized with `origin/main` after every approved implementation unit.
