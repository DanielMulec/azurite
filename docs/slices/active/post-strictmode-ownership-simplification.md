# Post-StrictMode Ownership Simplification

## Status

Active. Daniel accepted the documentation-only Task 3A analysis at commit
`9bb787889ad6cad4e4d55ae02ed7c0397dce494f`. Task 3B editor-session authority
and Task 3C persistence-result simplification are complete with authoritative
evidence in `docs/qa/post-strictmode-editor-session-authority.md` and
`docs/qa/post-strictmode-persistence-results.md`. Daniel approved the
post-Task-3C Task 3D store-workflow boundary on 2026-07-14. Daniel accepted Task 3D at
`1cbdbe3f598ae71dfac07e29e9b46ad91f1a46f0` on 2026-07-15 after independent
conformance review returned `ACCEPT` with zero mandatory corrections.
Authoritative evidence lives in
`docs/qa/post-strictmode-store-workflow-boundaries.md`. Daniel approved the
re-baselined Task 3E shared Sentry fail-open carrier for implementation on
2026-07-15 from authoritative clean commit
`3d98cc9fca31a86c2c2b846e8cb346400e647ecf`. After one documentation-only
correction and focused reviewer recheck, Daniel accepted Task 3E at
`b2218fe366929fd195cbfa969da25302e83f433b` on 2026-07-15. Authoritative
evidence lives in `docs/qa/post-strictmode-sentry-fail-open-carrier.md`.

All four selected units are complete and accepted. Daniel determined on
2026-07-15 that their real reductions still leave materially more runtime and
test ceremony than the current product warrants. The simplification program
therefore remains active. No 7X slice will be refreshed, promoted, or started
until the remaining cleanup has been re-baselined and Daniel has approved the
next coherent simplification unit.

Daniel approved the read-only **Zero-Based Complexity Re-Baseline** as the next
checkpoint on 2026-07-15. It will challenge the current runtime, verification,
QA, and live-authority cost from current product behavior and guarantees before
another implementation unit is selected.

All three read-only stages completed on 2026-07-15. Their independent
clean-room, repository-cost, and reconciliation reports are supporting evidence,
not implementation authority. The complete reconciliation report remains
separate evidence; this document records the durable decision posture that
survived Daniel's review.

Follow the bounded-review and concise-document rules in
`docs/working-agreement.md` throughout implementation and promotion.

## Product Decision

Azurite will simplify the implemented editor and recovery workflow before Slice
7E instruments it. Four separately reviewable units run in this order:

1. consolidate editor-session authority;
2. simplify persistence results;
3. replace the distributed store capability context with workflow boundaries;
4. extract the shared Sentry fail-open carrier.

All four units above are independently accepted. Their completion closes this
selected sequence and does not close the broader simplification expedition.
Tracked ordinary TypeScript and TSX runtime source under `apps` and `packages`,
excluding QA roots, fell from **18,804 -> 17,196** physical lines between the
pre-Task-3A baseline and the accepted post-Task-3E state, a reduction of
**1,608**. The current automated suite contains **469 executed cases across 78
test files** and **13,931 physical lines** of test and helper code.

Daniel suspended the earlier **80 to 140** cases, **35 to 50** files, and
**4,000 to 6,000** test lines compass as planning authority. Those figures
remain historical hypotheses rather than an approved floor or target. The
questions of whether the current behavior can fit near **3,000 runtime lines**
or receive credible proof through approximately **10 tests** are challenge
hypotheses, not deletion contracts.

The Zero-Based Complexity Re-Baseline uses three independent read-only stages:

1. derive the current product contract and a clean-room minimum without first
   inheriting the implemented architecture;
2. reproduce the repository cost and map runtime, tests, QA harnesses, and live
   documentation to unique current guarantees; and
3. reconcile both investigations independently into decision-ready options.

Every stage must prevent metric gaming, distinguish current product guarantees
from inherited machinery, and return evidence to Daniel before documentation
selects an implementation unit or changes an accepted product guarantee.

The reconciliation ranked a coherent frontend authority re-foundation ahead of
in-place pruning and a whole-product refoundation. Daniel then fixed one missing
product constraint: TanStack Router has a certain long-term role because cluster
opening and future product surfaces must be addressable. The current preferred
candidate is therefore **B2**, a
router-retaining frontend authority re-foundation. B2 keeps TanStack Router and
the principal React, Zustand, Dexie, Milkdown/Crepe, Sentry, Fastify, Zod, and
TypeScript stack while challenging the amount of Azurite-owned coordination
around it.

B2 is a promising proposition, not approved architecture or implementation
scope. Option A, in-place pruning, remains the fallback if a read-only
definition and feasibility checkpoint cannot show that B2 creates a materially
smaller and clearer authority model without weakening current guarantees or
future extension seams. The reconciliation's runtime and proof envelopes remain
investigation hypotheses rather than acceptance targets. Option C has no current
product justification for reopening the comparatively stable core, server,
formats, and durable contracts.

Any later B2 checkpoint must preserve the outcomes behind navigation ownership,
stale-work rejection, ordered draft persistence, exact Markdown authority,
Crepe lifecycle safety, and Sentry diagnostics. It may consolidate or replace
their current gates, leases, registries, executors, epochs, result families, and
distributed Zustand workflow only where a smaller design proves the same
outcomes. Trusted-Origin enforcement and unsafe Markdown URL handling remain
separate Scope Re-selection findings rather than silently annexed
simplification work.

Daniel's intended product sequence after simplification is to refresh and
complete Slice 7E diagnostics, resolve the mandatory Slice 7F correctness
disposition against the resulting architecture, deliver file creation,
deletion, and rename as coherent basic CRUD work, and then build the real
Azurite cluster, indexing, linking, graph, and scripting capabilities. The
definition checkpoint must provide deliberate seams for that sequence without
implementing speculative future machinery.

The accepted sequence ran serially on `main`; every unit re-baselined after its
predecessor. Persistence and store work were delivered separately because the
call graph permitted a smaller persistence contract while all store workflows
continued to work. Combining them would have mixed result semantics with route,
save, and store ownership without completing additional user value.

The accepted four-unit sequence was consolidation, not a rewrite. Zustand
remains the accepted live product authority, the Markdown controller remains a
projection/checkpoint adapter, Crepe remains a disposable WYSIWYG runtime, the
editor gate remains a transient handoff capability, the draft coordinator
retains ordering obligations, Dexie retains durable recovery, the route owner
retains navigation authority, and Sentry remains diagnostic infrastructure.
The zero-based investigation may recommend pruning, bounded subsystem
replacement, or deeper re-foundation; none becomes approved architecture or
implementation scope until Daniel selects it after reconciliation.

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

| Seam               |                                                                     Current physical production envelope | Verified vocabulary and caller evidence                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor session     |   4,274 lines: store/contracts 1,204; controller family 935; Crepe/hook 532; gate 569; React chain 1,034 | 14-field `EditorSession`; four mirrored controller fields; publication 3 statuses/6 reasons; synchronization 3 statuses/5 causes/4 failure reasons; commit 4 variants/3 statuses/6 reasons; gate preparation 5 variants |
| Persistence ladder |        5,752 lines across 35 files: storage/coordinator 1,430; Zustand translations 3,018; gate/UI 1,304 | 9 result families, 34 union members, 21 status literals, 15 failure/rejection reasons, 8 dispositions, 6 operations, 4 retry actions, and 13 public Zustand actions                                                     |
| Store engine       | 4,048 lines across the 20 `StoreContext` consumers; 4,868 lines across 29 files in the full state folder | 26 injected context members, only 24 consumed; 144 `StoreContext` occurrences; Zustand exposes 13 actions: six route-executor operations and seven product/gate actions                                                 |
| Sentry fail-open   |                              900 lines: shared runtime contract 287, web adapter 299, server adapter 314 | Web/server adapter diff changes only 22/37 lines; both implement the same record, capture, scope, attribute, error-context, and span decisions                                                                          |

Principal production anchors, with baseline physical lines, make those
envelopes reproducible:

- Editor: `note-browser-store.ts` 371, `note-browser-contracts.ts` 140,
  `note-browser-authority-actions.ts` 398, controller 391 plus 544 across its
  four helper files, `crepe-generation-lifecycle.ts` 287,
  `editor-session-gate.ts` 369 plus 200 in types/results, and the five-file React
  chain 1,034.
- Persistence after Task 3C: `draft-database.ts` 389, coordinator 400 plus 225
  in its type/helper/decision files, `draft-workflow-types.ts` 114, cleanup 225,
  recovery 211, Discard 318, durability 131, and the unified retry command 39.
- Store after Task 3C: `note-browser-contracts.ts` 133, store 344, action utilities 368, route
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

The 26-member internal `StoreContext` contains one API capability, 14 consumed
route/list/read operations, three active-Save operations, two persistence
owners, two identity allocators, generic `get`/`set`, and two dead capabilities:
`draftPersistence` and `setCurrentRouteIntent`. Its 14-field runtime casts `{}`
to the full context and late-fills it through `configureContext`.

The 13 Zustand actions are six route-executor operations and seven product/gate
actions. The six route operations leave Zustand while the existing six-operation
`RouteStoreExecutor` remains the cross-layer seam. The two Discard actions
already converge on one target workflow. Route results remain materially
consumed and must not collapse.

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

The post-Task-3C baseline is 26 context members across 20 consumers and 4,048
lines, 144 `StoreContext` occurrences, and 13 Zustand actions. Completion
requires `StoreContext` **26 -> 0**, consumers and occurrences **20/144 -> 0**,
Zustand actions **13 -> 6**, public Save-map accessors **3 -> 0**, Discard
commands **2 -> 1**, the late-fill layer **1 -> 0**, and dead capabilities
**2 -> 0**. The seven legitimate product authorities remain **7 -> 7**; moved
or renamed ceremony does not qualify.

Implementation completed on 2026-07-14 and met those structural targets. The
same 20-file physical envelope fell **4,048 -> 3,935** lines; the full evidence,
preserved guarantees, and verification counts live in
`docs/qa/post-strictmode-store-workflow-boundaries.md`. Browser evidence is the
original four-cell development/optimized desktop/Pixel 6 product matrix plus
one additional optimized Pixel 6 Sentry-enabled preservation cell. Task 3E
remains a separate approved implementation checkpoint.

### 4. Extract The Shared Sentry Fail-Open Carrier

- Complete the existing shared fail-open span seam as one stateless, Sentry-free
  carrier receiving only the minimal carrier callbacks plus current environment
  and release values. Keep the two active runtime states and installation local
  to web/server.
- Consolidate the duplicated record, capture, adapter-level span selection,
  attribute, scope, caught-error, and best-effort decisions. Thin local functions
  preserve current caller names without reimplementing the branch trees.
- Keep configuration parsing, SDK initialization and dynamic imports, Replay,
  Fastify integration, trace targets, server enablement/flush, and shutdown
  budgets local to their current authorities and behaviorally unchanged.
- Do not add semantic events, payloads, state snapshots, instrumentation, or
  Slice 7E behavior.

The exact affected baseline is **900** physical production lines: shared 287,
web 299, and server 314. The adapters retain 277 ordered common lines and differ
by only 22 web/37 server lines. Include every replacement or new carrier file in
the result: total lines fall below 900; record, capture, and adapter-level span
trees fall **2 copies -> 1**; the existing exact-once span executor remains
singular; product authorities remain **7 -> 7**; and local runtime-state owners
remain **2 -> 2**. Moving or renaming branch trees does not qualify.

Scope Re-selection is required if implementation needs a new shared state or
configuration authority, dependency, semantic event or payload, SDK
initialization, transport, Replay, correlation, shutdown-policy change, new QA
surface or build variant, or Slice 7E instrumentation. A newly discovered
fail-open defect that changes behavior also returns to Daniel for approval.

Implementation completed on 2026-07-15 without Scope Re-selection. One new
315-line shared carrier reduced the affected production envelope **900 -> 740**
lines: shared exact-once seam 287, shared carrier 315, web facade 59, and server
facade 79. Record, capture, and adapter-level span selection each fell
**2 copies -> 1**; the exact-once executor stayed **1 -> 1**, product
authorities stayed **7 -> 7**, and local runtime owners stayed **2 -> 2**.

The focused suite passed **19 files / 87 tests** and full validation passed
**78 files / 469 tests**. The full development/preview, desktop/Pixel 6,
disabled/enabled eight-cell matrix passed with exact product operations,
disabled zero-traffic proof, real React/Node SDK 10.64.0 delivery, joined
browser-to-server traces, one unique Replay per enabled release, expected issue
counts, and graceful shutdown delivery. Exact measurements, filesystem proof,
Sentry evidence, findings, and cleanup live in
`docs/qa/post-strictmode-sentry-fail-open-carrier.md`. Independent conformance
review closed one documentation-only correction, and Daniel accepted the
corrected candidate at `b2218fe366929fd195cbfa969da25302e83f433b`.

## Negative Side-Effect Guardrails

Baseline: [Product guardrails](../../reference/product-guardrails.md).

Accepted Tasks 3B through 3E retain their documented guardrails and evidence.

- Shared fail-open extraction must preserve disabled no-op behavior, product
  callback identity/count/result/throw/rejection, scope isolation, and enabled
  server shutdown flush semantics.

## Verification Plan

Tasks 3B through 3E retain their accepted QA evidence. Task 3E was a direct
observability change under the Playwright runbook. Shared-carrier and
thin-adapter tests prove disabled/enabled record/capture/span, exact once-only
delivery, hostile carriers, attribute filtering, caught-error normalization,
scope fallback, exact product and promise outcomes, usable installation, actual
server flush delegation, correlation, and unchanged SDK-free core/product
boundaries. The focused baseline is **18 files / 82 tests**. Run the full
development/built-preview, desktop/Pixel 6, Sentry-disabled/enabled eight-cell
matrix.

| Sentry mode | Required proof                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enabled     | Real React/Node SDK startup and delivery; natural list/read/route/Save/conflict logs; trace propagation and browser/API/Fastify/server joining; unique disposable Replay; exact operation counts; expected `409` without an unexpected issue; graceful shutdown delivery; and development-cell deliberate record/capture/span proof through the existing diagnostics surface. |
| Disabled    | Matching product outcomes and operation counts; zero Sentry traffic and trace headers; intact Azurite correlation; and unchanged disabled shutdown.                                                                                                                                                                                                                           |

Deterministic carrier tests own hostile SDK behavior; no new production QA hook
or optimized-build diagnostics surface is permitted.

Task 3E records before/after production lines, owners, contracts, carrier
operations, and material caller branches. Run focused proof, then:

```sh
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

## Acceptance Criteria

- The four units remain separately gated and serial; persistence and store
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
