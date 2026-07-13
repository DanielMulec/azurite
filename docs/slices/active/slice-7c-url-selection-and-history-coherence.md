# Slice 7C: URL Selection And History Coherence

## Status

Active as of 2026-07-13 after Slice 7B completed and after adversarial review
proved that the previously later route repair is a prerequisite for safe editor
handoff.

The sequence is deliberately re-selected to `7B -> 7C -> 7D -> 7E -> 7F`:

- this slice establishes route-intent ownership and the pre-transition gate;
- Slice 7D consumes that gate for Markdown authority and draft durability;
- Slice 7E is refreshed after the implemented Slice 7D contracts exist; and
- Slice 7F performs the diagnosed editor-correctness repair immediately after
  Slice 7E.

Slice 7B QA classified this capability from a pre-existing race first introduced
with the Slice 6 navigation foundation. The authoritative reproduction is in
`docs/qa/slice-7b-request-correlation.md`.

## Product Decision

One route-transition owner registers every note-navigation intent before any
asynchronous prerequisite runs. An intent has unique identity even when another
intent names the same note. That owner alone decides whether the intent is still
current, whether an active load may be reused, whether selection is already
coherent, whether a continuation may apply, and whether a failed transition may
repair the URL.

The URL remains Azurite's addressable selected-note owner. Zustand holds the
live transition state. The note still rendered for continuity is a projection,
not evidence that a newer route intent has completed.

A pre-transition gate may allow or cancel the current intent, but it never owns,
coalesces, or rewrites route targets. Slice 7C initially invokes the existing
draft-flush prerequisite through that seam. Slice 7D extends the same seam with
editor publication and exact-snapshot durability; it does not create a second
route owner.

## User Story

When Daniel selects notes or navigates rapidly with Back and Forward while
prerequisites and note reads overlap, Azurite eventually renders the note named
by the latest URL intent, marks that same sidebar item current, and rejects every
stale continuation. Repeating an intent for the note that is temporarily still
rendered cannot freeze the old editor, suppress the route action, or let another
note win while the URL says otherwise.

## Why This Matters

URL-owned selection is already Azurite's addressable navigation contract. A
split between URL, content, and sidebar makes the visible note untrustworthy and
can send later edits or saves through the wrong mental context.

The same boundary is required for honest editor durability. Slice 7D must be
able to veto an unsafe replacement without choosing navigation targets, and it
must know whether the caller it vetoed is still the exact current history
intent. A note ID alone cannot answer that question because two distinct history
entries may name the same note.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Select notes and navigate with Back/Forward while draft flushing, route effects, note reads, and temporary previous-note rendering overlap.                                                                                                  |
| Predictable extensions | Editor durability gates, external file updates, autosave, multi-cluster routing, tabs, and deep links all require independently identifiable route intents and coherent continuation.                                                        |
| Participating layers   | TanStack Router location/search state, React route synchronization, pre-transition gate registration, Zustand selected and rendered note state, request sequencing, sidebar accessibility state, draft flushing, tests, and real-browser QA. |
| Near-term seams        | A unique route-intent token, one latest-intent registry, a typed pre-transition result, exact coherent-selection predicates, and intent-aware active-load ownership.                                                                         |
| Exclusions             | Markdown projection authority, editor controller implementation, Sentry semantic payloads, local-runtime retry/copy, new route shapes, tabs, autosave, and multi-cluster UX remain separate capabilities.                                    |

### Scope Re-selection Result

The route-transition owner moved before Markdown fidelity because the current
`shouldSkipNoteSelection` predicate can suppress the exact continuation that a
durability gate has just authorized. Closing an editor controller before calling
that predicate could therefore leave the old rendered session frozen with no
replacement.

Adding a unique route-intent token and a typed pre-transition seam belongs here.
It completes route coherence and gives Slice 7D a stable integration boundary;
it does not annex Markdown authority or draft-disposition behavior. The first
implementation uses today's draft flush as the gate prerequisite, so the seam is
exercised by real product work rather than introduced as a throwaway abstraction.

## Reproduction Baseline

The exact pre-7B tree at
`ac4f4a709b52c78537adf493dbd368039fa5e4fc` reproduces the defect with real API
responses when only the nested-note response is delayed:

1. Load note A and select note B normally so both history entries exist.
2. Navigate Back and wait until A is fully coherent.
3. Navigate Forward to B and immediately Back to A while B's real response is
   pending.
4. Wait beyond response settlement.
5. The URL remains A while the rendered article, `selectedNoteId`, and
   `aria-current` settle on B; no final A read is issued.

The current `shouldSkipNoteSelection` checks whether the requested note happens
to be the editor still rendered during replacement loading. It does not require
that `selectedNoteId` or the current request sequence owns that note. Active
same-note load reuse likewise ignores route-intent ownership.

The same failure remains possible when a pre-transition gate delays the actions:

1. A is rendered.
2. Forward registers B; A remains rendered while the gate or B read waits.
3. Back registers a distinct A intent.
4. B's older continuation starts or remains active.
5. A's continuation sees rendered A and returns as a same-note no-op.
6. B wins while the URL says A.

## Authoritative Route-Transition Contract

This section is the single authoritative home for the slice's route ownership
and continuation decisions.

### State Terms

| Term                         | Meaning                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route intent                 | One immutable navigation occurrence with `intentKey`, monotonic generation, target (`note` with ID or `startup_fallback`), existing Slice 7B route source/operation evidence, location occurrence when known, and optional application-navigation token. Repeated visits to the same note or history entry are distinct intents. |
| Current route intent         | The latest intent registered synchronously from router or list navigation. Only this intent may continue into selected-note mutation or repair its own URL.                                                                                                                                                                      |
| Application-navigation token | A unique token attached to TanStack Router history state for one list push, startup replace, or cancellation repair. A pending-token registry recognizes exactly one expected echo; a consumed token encountered by later Back/Forward creates a new intent.                                                                     |
| Location occurrence          | The router's destination location key plus an Azurite generation allocated on `onBeforeNavigate`. A same-location React rerender creates no intent; every actual traversal does, even when it revisits a stored location/token.                                                                                                  |
| Committed route state        | The most recent terminal coherent route/view descriptor, or `none` before one exists. For a ready editor it retains identity only and restores from the live exact session, never from a stale Markdown copy. It is the only cancellation repair target.                                                                         |
| Selected note                | The note ID owned by the current live store transition. It can differ temporarily from the rendered note.                                                                                                                                                                                                                        |
| Rendered note                | The ready editor retained as a visual projection while a replacement loads. It does not own current route intent merely because its ID matches a target.                                                                                                                                                                         |
| Active load                  | One note read tagged with request sequence and the exact route intent that authorized it. It may be reused only when it still belongs to the current intent and selected note.                                                                                                                                                   |
| Pre-transition gate          | One replaceable runtime capability with `prepare` and `settle` operations. `prepare` receives a route-owner-created lease, cause, and outgoing owner identity, never target/location/intent. The route owner binds the lease to the intent and calls `settle` exactly once.                                                      |
| Gate lease                   | A unique target-free token allocated by the route owner for one gate call. Calls may share one underlying flush/durability promise, but independent leases/ref-counting prevent a stale intent from releasing a freeze still used by a current intent.                                                                           |
| Transition predecessor       | The committed route/view descriptor captured for an intent. A current cancellation invalidates its admitted load, restores the still-live committed selection/view, and repairs to that committed URL; a stale cancellation changes nothing.                                                                                     |
| Transition outcome           | One exact terminal result for an intent. It includes intent/target identity, status-specific fields, and this intent's surface effect. Gate settlement and Slice 7B evidence consume the result; they never infer it from `Promise<void>`.                                                                                       |

### Exact Result Contracts

Implementation type names may differ only if this section is refreshed before
code changes. Variant membership, ownership, and state effects are fixed:

```ts
type RouteGateCause = "note_list" | "startup_fallback" | "url_sync";

type RouteGatePrepareInput = {
  leaseKey: string;
  cause: RouteGateCause;
  outgoingOwnerKey: string | undefined;
};

type RouteGateResult =
  | { status: "continue" }
  | {
      status: "cancel";
      reason:
        | "prerequisite_failed"
        | "prerequisite_unavailable"
        | "outgoing_owner_lost";
    };

type RouteTransitionOutcome =
  | {
      status: "applied";
      intentKey: string;
      noteId: string;
      requestSequence: number;
      view: "ready" | "missing" | "missing_draft";
      surfaceEffect: "replaced";
    }
  | {
      status: "applied";
      intentKey: string;
      noteId: undefined;
      requestSequence: undefined;
      view: "empty";
      surfaceEffect: "replaced";
    }
  | {
      status: "coherent_noop";
      intentKey: string;
      noteId: string;
      view: "ready" | "missing" | "missing_draft";
      surfaceEffect: "retained";
    }
  | {
      status: "coherent_noop";
      intentKey: string;
      noteId: undefined;
      view: "empty";
      surfaceEffect: "retained";
    }
  | {
      status: "superseded";
      intentKey: string;
      noteId: string | undefined;
      phase:
        | "awaiting_location"
        | "awaiting_gate"
        | "awaiting_notes"
        | "awaiting_read"
        | "awaiting_repair";
      surfaceEffect: "none";
    }
  | {
      status: "cancelled";
      intentKey: string;
      noteId: string | undefined;
      reason: Extract<RouteGateResult, { status: "cancel" }>["reason"];
      repair: "not_needed" | "replaced" | "superseded";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string | undefined;
      reason: "navigation_rejected" | "repair_rejected" | "notes_list_failed";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string;
      reason: "note_read_failed";
      surfaceEffect: "replaced_by_error";
    };

type RouteGateSettlement = {
  leaseKey: string;
  terminalStatus: RouteTransitionOutcome["status"];
  surfaceEffect: RouteTransitionOutcome["surfaceEffect"];
};
```

The gate `settle` input is
`{ leaseKey, terminalStatus: outcome.status, surfaceEffect }`; it receives no
note target, route intent, location, repair result, or operation evidence and
cannot continue, repair, or choose navigation.
Registering a new gate replaces only future `prepare` calls;
existing leases settle on the capability that created them. Unregistration
installs a no-op gate. A thrown or rejected `prepare` becomes
`cancel/prerequisite_failed`; a thrown/rejected `settle` is contained and cannot
alter the already-decided route outcome.

### Required Transitions

1. **Intent registration**
   - Construct the transition owner beside the router, subscribe synchronously
     to the installed TanStack Router `onBeforeNavigate` lifecycle before
     rendering `RouterProvider`, and pass the owner to the application/store
     boundary. This replaces passive `useEffect` as the route-intent boundary.
   - Seed the initial location exactly once if it predates subscription. Queue it
     until the store executor registers; later same-location rerenders do
     nothing.
   - A note-list click registers its intent and token before calling `navigate`.
     Navigate/push the URL first; do not mutate selected note or admit a read
     until that exact location resolves. Startup fallback uses replace with the
     same protocol.
   - Put the token in typed history state and a pending registry keyed by token.
     `onBeforeNavigate` consumes an unconsumed pending token as the echo of its
     existing intent without promoting a stale intent. A token found later by
     Back/Forward is already consumed and therefore receives a fresh generation
     and `intentKey`.
   - Await/observe router resolution before selected-note mutation. Navigation
     rejection settles `failed/navigation_rejected`, removes the pending token,
     and leaves product state unchanged. Registry entries are removed on echo,
     rejection, supersession, or owner disposal; no timeout is product control.
   - A cancellation repair uses its own repair token. Its echo performs no gate
     or note action and cannot create a competing intent. Repair rejection is a
     visible `failed/repair_rejected` result; it is never reported as cancelled
     coherence.

2. **Pre-transition gate**
   - Immediately after registration, classify a coherent-no-op candidate when
     destination, selected note, ready/missing/missing-draft/empty view, and
     request ownership already agree. It becomes `coherent_noop` only after
     router resolution; it performs no gate, draft flush, load, or second
     evidence operation.
     A coherent list click does not navigate merely to obtain an echo; it settles
     directly without adding history.
   - Otherwise allocate a lease and invoke `prepare` from the
     `onBeforeNavigate`/list-start boundary before selected-note mutation or read
     admission. Store admission awaits both gate result and router resolution.
     Invoke `settle` exactly once for every allocated lease on every terminal
     path, including thrown `prepare` and navigation rejection.
   - Re-check that the exact intent is current after every awaited prerequisite.
     A stale `continue`, `cancel`, success, or failure cannot act on a newer
     intent.
   - The Slice 7C adapter gives today's draft flush explicit in-flight ownership:
     overlapping callers share the same pending flush result, new edits during
     it remain pending and are drained before `continue`, unavailable results
     map to `prerequisite_unavailable`, thrown work maps to
     `prerequisite_failed`, and cleanup occurs in `finally`. No second intent can
     observe “nothing pending” while a required flush is unresolved.
   - A current `cancel` invalidates the intent's admitted load, restores the
     latest live committed predecessor without copying stale editor Markdown,
     and repairs to its committed URL with replace. If no committed state exists,
     clear the note search parameter and retain the appropriate idle/list-error
     surface. Never resurrect a superseded load.
   - Re-check currency before repair and after its echo. A stale cancellation
     settles `superseded` and cannot restore selection or overwrite a newer URL.
   - Slice 7D may replace the no-op/draft gate with editor publication and
     durability internally, but it uses this target-free lease/settlement
     contract and cannot change route ownership.

3. **Selection and load admission**
   - Mutate `selectedNoteId` only for the exact current intent.
   - Treat selection as a coherent no-op only when URL target,
     `selectedNoteId`, ready rendered editor, and absence of a conflicting
     current load all agree for that intent.
   - Do not use rendered note equality alone to skip a selection.
   - Reuse an active same-note promise only if its request sequence, selected
     note, and authorizing intent still own the current transition. Otherwise
     start a new current load even when the target ID is identical.
   - A current explicit route is recovered as missing/missing-draft even when
     the ready note list is empty. Only an undefined route plus an empty list
     settles the empty idle state. Startup fallback exists only for an undefined
     route plus a non-empty list.
   - Remove list-completion synchronization through a mutable
     `latestRouteNoteId` ref. List success resumes only the exact current intent;
     list failure settles that waiting intent as `failed/notes_list_failed`.

4. **Completion and cleanup**
   - Apply read success, failure, or missing-note recovery to product state only
     when both request sequence and route intent remain current. An exact stale
     completion still clears the active-load record it created; cleanup authority
     is record identity, not permission to mutate current state.
   - A ready, missing, or missing-draft application settles `applied`. Draft-read
     unavailability may degrade recovery while still applying the disk/missing
     view; it is not mislabeled as a route read failure. A current API read
     failure installs the target-owned error surface and settles
     `failed/note_read_failed` with `replaced_by_error`.
   - A superseded intent settles at the first post-await currency check with the
     exact phase. Its late load/evidence may settle independently as stale but
     cannot create another route outcome.
   - For a ready result, URL target, `selectedNoteId`, rendered editor,
     `aria-current`, request sequence, and intent agree. For missing/error/empty
     results, URL and selected/view target agree and no unrelated sidebar item is
     current. These are the exhaustive final view states; the contract does not
     require a ready editor where none exists.

5. **Lifecycle timing**
   - `onBeforeNavigate` is the committed registration boundary. It records the
     intent and calls target-free gate `prepare` synchronously enough for Slice
     7D to commit/freeze the outgoing editor before route rendering. Awaited gate
     work continues outside the router callback; the owner joins it with router
     resolution before store admission.
   - Event callbacks, router synchronization, and store actions share the same
     owner rather than keeping separate latest-note refs.

## Goals

- Establish one exact route-transition ownership contract.
- Preserve independent intent for repeated same-note and overlapping callers.
- Distinguish selected intent from temporary rendered projection.
- Make pre-transition cancellation and URL repair exact-intent operations.
- Make every stale success, failure, and cleanup incapable of changing current
  selection, editor, recovery, or accessibility state.
- Preserve startup fallback coalescing without duplicate system-caused reads.
- Leave a typed gate and outcome seam that Slice 7D can consume safely.
- Prove deterministic rapid Back/Forward behavior in store, router, and real
  browser tests.

## Non-Goals

- Implementing Slice 7D's Markdown authority controller, editor freeze, draft
  disposition, or exact-snapshot durability policy.
- New navigation UI, tabs, breadcrumbs, recent notes, or alternate route shapes.
- Adding retry UI or changing misleading proxy error copy for backend-down
  failures. Duplicate reads caused by one list/startup intent echo remain this
  slice's coherence responsibility even when the first read fails.
- Changing the content-hash API, filesystem writes, or draft schema.
- Using telemetry timing as product synchronization.
- Removing the previous-note projection while a new read is pending unless the
  final implementation proves that is required for honest state.

## Implementation Plan

1. Add the exact types above in a focused web-domain module. Keep parsed router
   locations and navigation functions at the router adapter; keep only scalar
   intent/request ownership in the store runtime; persist none of it.
2. Construct the transition owner with `createAzuriteRouter`, subscribe to
   `onBeforeNavigate` before `RouterProvider`, seed the initial location once,
   and remove route selection from passive `useEffect`.
3. Extend navigation to return its promise and write typed history state with
   application/repair tokens. Implement pending-token consumption, traversal
   generations, repair echoes, resolution/rejection cleanup, and disposal.
4. Move list clicks and startup fallback to URL-first intent flow. One owner
   joins router resolution, gate result, notes-list readiness, and store
   executor; list completion no longer reads a mutable latest-note ref.
5. Implement replaceable target-free gate registration plus route-owner leases,
   exact-once settlement, no-op behavior, thrown/rejected containment, and
   replacement/unregistration rules.
6. Adapt today's draft flush with an owned in-flight promise/result and drain
   loop so overlapping callers cannot skip unresolved work. Translate exact
   unavailable/throw outcomes into gate cancellation and perform current-only
   committed-state repair.
7. Replace rendered-note-only skip and note-ID-only coalescing with the
   authoritative coherent-selection and active-load predicates.
8. Carry intent identity through note request metadata, success/failure
   application, missing-note recovery, and exact active-load cleanup.
9. Make empty-list, missing/missing-draft, draft-unavailable, note-error, list
   failure, navigation rejection, repair rejection, and supersession return the
   exact outcomes above.
10. Split `app-router.tsx`, `use-note-browser.ts`,
    `note-browser-route-actions.ts` (314 planning-time lines), transition owner,
    predicates, and store contracts by responsibility before any file exceeds
    400 lines.
11. Update technical architecture and Slice 7D integration wording to reference
    the implemented owner rather than duplicating its contract.

## Verification Plan

### Automated Verification

- Predicate tests cover rendered-A/selected-B, selected-A/rendered-A with a
  conflicting current B load, and fully coherent A.
- Transition-owner tests cover initial seeding; actual `onBeforeNavigate`
  registration; same-location rerender; list-push, startup-replace, and repair
  echoes; revisiting a consumed same-note history entry; navigation rejection;
  pending-token cleanup; and owner disposal.
- Gate tests cover no gate, registration, replacement, unregistration, shared
  in-flight flush success/failure, a new pending edit during flush, thrown and
  rejected prepare/settle, per-caller leases, stale settlement, and exact-once
  terminal notification.
- Deferred A/B store tests cover every read completion order, stale failure,
  missing-note recovery, and active-load cleanup.
- The exact classified race `A -> B -> A` fails before repair and settles all
  owners on A after repair.
- A stale B promise cannot be reused by a newer B intent after intervening A.
- URL repair occurs only for the exact current cancelled intent and never
  overwrites a later location, including a later intent for the same note ID.
- Route changes while notes are loading, list failure, empty list with/without
  an explicit route, draft-read unavailability, ready-note failure,
  missing/missing-draft recovery, failed repair, and stale cancellation return
  the expected typed outcome and final state.
- One list/startup intent issues at most one read even when that read fails before
  the URL echo settles.
- Every path returns exactly one typed transition outcome and every allocated
  gate lease settles exactly once.
- Existing Slice 7B operation/request correlation and save-integrity regression
  tests remain green.

Run:

```sh
/opt/homebrew/bin/pnpm --filter @azurite/web test
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

### Real-Browser QA

Use the Codex Playwright skill and the shared acceptance runbook for the full
desktop/Pixel 6, Vite-development/optimized-production,
Sentry-disabled/Sentry-enabled eight-cell matrix:

1. Prove ordinary list selection, Back, Forward, startup fallback, and same-note
   coherent no-op issue no duplicate reads.
2. Delay B, run `A -> B -> A`, and prove URL, selected note, article
   `data-note-id`, and sidebar `aria-current` settle on A for every response
   order.
3. Repeat with two history entries that name the same note and prove their
   intent identities remain independent.
4. Delay and reject the current pre-transition draft flush. Confirm only that
   exact transition is cancelled, the outgoing note remains coherent, and a
   newer navigation is untouched.
5. Repeat overlapping intents that share a failing flush and prove neither can
   skip it; then edit during an in-flight flush and prove the next pending work
   drains before continuation.
6. Exercise stale success/failure, current read failure, empty and explicit
   missing routes, repair/navigation rejection, and startup replacement with
   console and network inspection.
7. With Sentry enabled, prove Slice 7B operation/request IDs and `note_list`,
   `startup_fallback`, and `url_sync` evidence remain truthful through echoes,
   cancellation, and supersession. With Sentry disabled, prove identical product
   state and no Sentry transport.

## Negative Side-Effect Guardrails

The shared baseline is `docs/reference/product-guardrails.md`. This slice adds:

- startup replacement must remain one operation and one request;
- a route transition must not delete or mis-scope an outgoing dirty draft;
- a temporarily rendered editor must not accept save ownership for another
  selected note;
- ordinary awaited navigation must not gain duplicate reads;
- one failed list/startup intent echo must not issue a second system-caused read;
- a cancelled or stale intent must not rewrite a newer URL, including one with
  the same target note ID;
- missing-note recovery and traversal rejection must remain coherent with the
  final URL;
- focus styling must not be confused with `aria-current` selection; and
- route identity and gate callbacks must remain ephemeral rather than entering
  persisted product state.
- thrown/rejected gate or settle work must not poison later transitions, strand
  a lease, or turn observability into product synchronization.

## Acceptance Criteria

- Every note-navigation occurrence has unique identity before asynchronous work.
- Only the current intent may mutate selection, admit/reuse a load, apply a
  completion, recover a missing route, or repair the URL.
- Skip and coalescing predicates require coherent selected and request ownership;
  temporary rendered-note equality is insufficient.
- Rapid `Back -> Forward -> Back` and the reverse settle URL, article,
  `selectedNoteId`, and `aria-current` on the same note after every response
  order.
- Repeated same-target history intents remain independent.
- Application/repair tokens distinguish their one expected echo from later
  traversal; navigation rejection and owner disposal leak no pending token.
- The target-free pre-transition gate has exact continue/cancel semantics,
  per-caller leases, replacement/unregistration behavior, and exact-once
  settlement for every typed terminal outcome.
- Slice 7D can register editor durability through this gate without receiving or
  choosing route targets and without implementing URL rollback.
- The eight-cell desktop/Pixel 6, development/production,
  Sentry-disabled/enabled matrix passes with preserved Slice 7B evidence.
- Full repository validation, production build, diff integrity, clean `main`,
  and synchronization with `origin/main` pass.

## Open Questions

None for planning. The exact route owner, unique-intent identity, gate timing,
coherent no-op predicate, active-load reuse rule, URL repair ownership, and Slice
7D integration seam are committed decisions. Implementation evidence that
requires another product capability or persistent owner triggers the working
agreement's Scope Re-selection During Review rule.
