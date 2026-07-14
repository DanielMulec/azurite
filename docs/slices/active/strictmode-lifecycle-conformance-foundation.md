# StrictMode Lifecycle Conformance Foundation

## Status

Proposed. Production-code implementation requires Daniel's explicit approval.

Follow the bounded-review and concise-document rules in
`docs/working-agreement.md` throughout proposal, review, and promotion.

## Product Decision

Every current Azurite React root will run under full-root React StrictMode. The
frontend will treat StrictMode's development replay as a required lifecycle
contract: render stays pure, committed setup can be repeated, every disposable
external generation has symmetrical cleanup, and replay never duplicates a
product action.

Azurite will distinguish replay-stable product-session authority from disposable
router and Crepe runtime generations. This is a lifecycle conformance foundation,
not a repository-wide state rewrite. Zustand remains the accepted live product
state owner, Dexie remains durable browser-recovery storage, and the existing
route, Markdown-authority, gate, and persistence boundaries retain their distinct
roles unless lifecycle proof requires a narrowly defined consolidation.

## User Story

As an Azurite user, I can start the app, navigate, edit in source or WYSIWYG
mode, save, resolve conflicts, and recover browser drafts without duplicated or
lost work, regardless of React's diagnostic mount replay or an actual
unmount/remount.

## Evidence Baseline

- None of the product, route-QA, or Markdown-QA roots currently enables
  full-root StrictMode. React component tests also render without the supported
  Testing Library StrictMode default.
- Router construction currently occurs in a React state initializer. It creates
  browser history, installs browser-history ownership, registers route
  admission and subscriptions, and starts the initial intent before commit.
  Initializer replay can abandon one live runtime; effect cleanup then
  terminally disposes the retained route owner without reconnecting it.
- The installed TanStack browser history also owns `beforeunload`, `popstate`,
  and wrapped native history methods. Current Azurite cleanup disposes its route
  owner but does not destroy that browser-history generation. A lifecycle probe
  observed two `beforeunload` and four `popstate` listeners after initializer
  replay; retained-owner cleanup left two and three respectively.
- The Milkdown hook retains a Markdown authority controller in state while its
  effect cleanup terminally destroys that controller. A React 19 StrictMode
  probe reproduced two Crepe creations, one destruction, and a retained
  controller that remained not ready after replay:
  `{"creates":2,"destroys":1,"ready":"false"}`.
- Existing focused router, editor, gate, and persistence tests pass without
  global StrictMode. They characterize current workflows but do not prove
  replay-safe resources, duplicate actions, or final-unmount release.

## Goals

- Run every current product and QA React root under full-root StrictMode.
- Make render free of browser-history, DOM, listener, subscription, registry,
  editor-runtime, timer, persistence, and product-I/O side effects.
- Establish repeatable setup and idempotent, generation-exact cleanup for all
  current frontend external resources.
- Retain exactly one intended live route owner and editor generation after
  StrictMode settles, then release all relevant resources on final unmount.
- Prevent diagnostic replay and stale asynchronous completions from issuing or
  publishing duplicate navigation, reads, edits, saves, filesystem writes,
  draft writes, cleanup, recovery, or editor state.
- Preserve the completed Slice 7C routing contract and Slice 7D Markdown,
  dirty-state, save, conflict, recovery, and future-schema contracts.
- Record physical code, authority-owner, lifecycle-resource, and result-
  vocabulary deltas without calling code movement simplification.

## Non-Goals

- Rewriting or promoting Slice 7E, renumbering Slice 7E or its required
  follow-up, or adding semantic Sentry diagnostics.
- A repository-wide Zustand, controller, gate, router, or persistence rewrite.
- Combining Zustand and Dexie, which own different live and durable truths.
- Adding a state-machine library, dependency, storage boundary, standalone QA
  app, or build entry.
- Redesigning editor UX, route semantics, save behavior, draft schema, or API
  contracts.
- Treating development-only double execution as a product action to suppress
  with global flags or one-shot render guards.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | StrictMode-safe startup, routing, editing, save, conflict, recovery, browser lifecycle, and unmount across every current React root.                                                |
| Predictable extensions | Slice 7E may observe the stable lifecycle and authority model; Slice 7F may diagnose editor correctness without inheriting duplicate generations.                                   |
| Participating layers   | React roots and tests, router/history ownership, editor session and Crepe runtime, Zustand store, gates, draft coordinator, Dexie recovery, QA controllers, and browser acceptance. |
| Near-term seams        | Generation identity, exact setup/cleanup accounting, replay-stable session authority, disposable external runtimes, and duplicate-action counters.                                  |
| Exclusions             | New state/storage frameworks, new QA surfaces, and Slice 7E work remain separate because conformance can be proven through current boundaries.                                      |

## Architecture Contract

### Lifecycle Vocabulary

- A **product session** owns accepted user-visible state and obligations that
  must survive React's diagnostic effect replay.
- A **runtime generation** owns external resources allocated by one committed
  setup. It is current only while its generation identity matches the owning
  product session.
- **Retirement** synchronously prevents a generation from publishing or
  mutating current state. Teardown then releases only resources allocated by
  that generation, and may be asynchronous where the external API requires it.
- **Final unmount** releases registrations and product-session resources after
  an immediate StrictMode reconnect has had the opportunity to reclaim them.
  It must not delete valid drafts or unknown future-schema records.

Render and state initializers may allocate inert in-memory values only. They may
not create browser history or Crepe, mutate browser history or DOM, install
listeners, blockers, subscriptions, or registry ownership, schedule persistence,
or issue product I/O.

### Router Ownership

Each committed setup creates a fresh browser-history, router, and route-owner
generation. The generation is published only while current. Cleanup retires it,
disposes Azurite route ownership, destroys the matching TanStack browser history,
restores wrapped native history methods, and releases every listener,
subscription, blocker, intent, and lease allocated by that generation.

Route-owner disposal remains terminal; replay creates a fresh generation rather
than reconnecting a disposed owner. Initial route intent starts idempotently only
for the current published generation. A discarded generation cannot receive the
store executor or issue list, read, navigation, or restoration work.

The Slice 7C route owner remains authoritative for validated URL targets,
history action, pending predecessor behavior, admission, cancellation,
restoration, same-target coalescing, and explicit reload. Store executor and
editor-gate registrations remain identity-safe capabilities, not alternate route
authorities.

### Editor Ownership

One replay-stable editor-session authority coordinates exact Markdown,
checkpointing, and gate participation for the accepted store session. Its
lifecycle is not terminally destroyed by replay-indistinguishable effect cleanup.
It does not become a second durable content store.

Every committed WYSIWYG setup receives a unique generation identity and owns its
DOM host, callback token, create outcome, Crepe runtime, readiness, failure, and
teardown. Every callback and asynchronous completion must prove that generation
is current before reading, replacing, publishing, focusing, or changing
readiness. Cleanup retires the generation before starting teardown and can never
clear or destroy the successor's host or runtime.

Pending creation and destruction are ordered. A successor cannot be made ready
or publish WYSIWYG state until its predecessor is retired and required teardown
has settled. Source mode remains usable while WYSIWYG creation is pending or
failed, and exact Markdown remains recoverable through the accepted authority.

### Store, Gate, And Persistence Ownership

Zustand remains authoritative for accepted live note, revision, mode, dirty,
save, conflict, disposition, and persistence-issue state. The Markdown authority
controller remains the synchronous editor projection/checkpoint adapter. The
editor session gate remains a transient capability and freeze-lease registry.
Route rendered ownership remains an opaque session identity. The draft
coordinator remains authoritative for ordered persistence obligations, while
Dexie remains their durable browser store.

StrictMode consolidation is limited to removing lifecycle ownership duplicated
between a replay-stable session and disposable generations. Existing content,
route, or persistence roles will not be merged merely because they touch the
same editor session.

Gate, store-executor, `pagehide`, `visibilitychange`, listener, and subscription
registrations must be balanced and identity-exact. Product-session persistence
survives diagnostic replay. Final unmount commits any accepted live projection
required by the existing contract, then settles or cancels Azurite-owned timers
and receipts without discarding valid recovery data.

Resource-zero proof applies to mounted-root and product-session ownership.
Process-scoped Dexie infrastructure must be reported separately and hold zero
active transactions, subscriptions, timers, or pending obligations after final
unmount.

## Implementation Plan

### 1. Establish Failing And Characterization Evidence

- Add focused tests that reproduce discarded router initializer resources, the
  disposed retained route owner, missing browser-history destruction, the
  destroyed retained Markdown controller, overlapping/pending Crepe generations,
  and stale completion publication.
- Extend existing test harnesses and QA controllers with exact resource and
  product-action counters. Do not create a standalone harness or QA app.
- Characterize synchronous factory/create failure, asynchronous create failure,
  teardown rejection, final unmount during creation, and immediate remount.

### 2. Enable StrictMode At The Test And Root Boundaries

- Wrap the product, route-QA, and Markdown-QA roots in full-root StrictMode.
- Configure React Testing Library through its supported global
  `reactStrictMode` option so component tests exercise replay by default.
- Keep a narrowly explicit non-Strict render only when a test intentionally
  compares React lifecycle modes and documents why.

### 3. Repair Router Runtime Generations

- Move external router/history construction and initial-intent admission out of
  render and initializers into committed lifecycle ownership.
- Publish only the current generation and make disposal symmetrical across the
  Azurite route owner and installed TanStack browser history.
- Preserve route target validation, browser Back/Forward/Go action semantics,
  pending predecessor behavior, gate admission, cancellation, restoration,
  same-target coalescing, and explicit reload.

### 4. Separate Editor Session Authority From Crepe Generations

- Keep one accepted session authority across diagnostic effect replay while
  making each Crepe instance a disposable, identity-checked generation.
- Order creation, retirement, and destruction so an older generation cannot
  affect or destroy the current one, including after delayed success or failure.
- Preserve synchronous source/WYSIWYG publication, edit-during-save rebasing,
  same-session mode switching, gate checkpoints, degraded source fallback, and
  exact Markdown.

### 5. Balance Registrations And Product-Session Cleanup

- Make gate, store executor, page lifecycle, store, controller, and router
  registrations exact under replay, remount, and final unmount.
- Give draft-coordinator timers, active obligations, and pending snapshots
  observable accounting and terminal product-session cleanup while retaining
  valid drafts and future-schema protection.
- Ensure setup/cleanup replay alone issues no route, editor, save, filesystem,
  draft, recovery, or cleanup product action.

### 6. Prove Current Workflows Through Existing Surfaces

- Extend current unit/component/integration suites and the two existing QA roots;
  do not add a build entry.
- Exercise startup and initial selection, sidebar and browser navigation, editor
  creation/failure, both editing modes, switching, save/edit-during-save,
  conflict, draft persistence/recovery, page lifecycle, route gating, and
  unmount/remount.
- Run proportional desktop and Pixel 6 acceptance in development and optimized
  production builds through the Codex Playwright skill.

### 7. Inspect Architecture And Simplification Deltas

- Compare baseline and final physical production lines in the changed scope.
- List authority owners by responsibility before and after, distinguishing
  accepted state from adapters, capabilities, external runtimes, and storage.
- Record resource create/destroy/live counts and result-vocabulary variants
  added, removed, or merged, including caller-branch effects.
- Claim simplification only when an ownership or decision branch disappears;
  relocation and net line reduction alone are not simplification.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

- Diagnostic replay must not issue a second user/product action or allow a stale
  asynchronous completion to publish into the current generation.
- Retiring one generation must not destroy, detach, unregister, or clear its
  successor's runtime, DOM host, callback, route ownership, or persistence work.
- Final unmount must restore native browser-history methods and release all
  relevant live resources without deleting recoverable drafts or unknown
  future-schema records.
- Delayed or failed editor teardown must remain observable and leave source mode
  usable; it must not be hidden as a ready WYSIWYG editor.

## Verification Plan

| Risk or contract                  | Evidence                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render purity and discarded setup | StrictMode characterization proves no external allocation or product I/O from render/initializer replay.                                                                                |
| Route generation ownership        | Counters prove one live history/owner/blocker and one of each route subscription after settle, native history restoration, and zero after final unmount.                                |
| Editor generation ownership       | Controlled delayed create/destroy/failure tests prove one current ready generation, exact teardown, isolated hosts, and rejected stale callbacks.                                       |
| Balanced registrations            | Gate, executor, page lifecycle, store, controller, listener, subscription, timer, and queue ledgers prove intended settled counts and zero releasable resources after unmount.          |
| No duplicate product action       | Spies and browser network evidence count initial list/read, navigation, publication, save/PUT/filesystem write, draft write/cleanup, recovery, and gate settlement.                     |
| Routing and data integrity        | Existing Slice 7C/7D tests plus StrictMode variants preserve history, exact Markdown, manual save, edit-during-save, conflicts, ordered drafts, recovery, and future-schema protection. |
| Real-root behavior                | Product and both existing QA roots pass desktop and Pixel 6 acceptance in development and optimized-production builds.                                                                  |

Run focused router, editor, store, persistence, and StrictMode tests, then:

```sh
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

Use the existing QA-build and production-bundle exclusion checks. Browser proof
must cover the real product root and both current QA roots; unit counters alone
are insufficient for browser-history, DOM, editor, and responsive behavior.

## Scope Re-Selection Triggers

- Stop for Daniel's explicit approval if implementation requires a new state
  owner, storage boundary, dependency, state-machine library, QA app, build
  entry, or independently useful refactor.
- First qualify installed Milkdown's public create/destroy failure behavior with
  red tests. If dependable physical cleanup requires upgrading or patching the
  dependency, stop rather than silently expanding this slice.
- A broad state simplification, new observability capability, or Slice 7E/7F
  work becomes a separately ordered slice; review findings cannot annex it here.

## Acceptance Criteria

- Every current Azurite React root and component-test default runs under
  full-root StrictMode.
- Render is pure; setup is repeatable; cleanup is generation-exact,
  symmetrical, idempotent, and complete on final unmount.
- StrictMode settle leaves exactly one intended live route owner and ready editor
  generation with the required single registrations and subscriptions.
- Discarded and retired generations leave no resources, and stale asynchronous
  completions cannot affect the current generation.
- Replay produces no duplicate navigation, read, edit publication, save,
  filesystem write, draft write, cleanup, recovery, or gate settlement.
- Startup, routing, editing, switching, save, conflicts, recovery,
  future-schema, page lifecycle, gating, and unmount/remount contracts remain
  true in automated and browser evidence.
- The final report includes physical-line, authority-owner, lifecycle-resource,
  and result-vocabulary deltas without equating relocation with simplification.
- The linked baseline and lifecycle-specific guardrails remain true.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, browser
  acceptance, and `git diff --check` pass.
- Slice 7E remains planned and unimplemented, the repository is clean, and the
  complete `main` state is pushed to `origin/main`.
