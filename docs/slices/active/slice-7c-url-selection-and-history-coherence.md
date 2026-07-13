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

| Boundary | Decision |
| --- | --- |
| Current workflow | Select notes and navigate with Back/Forward while draft flushing, route effects, note reads, and temporary previous-note rendering overlap. |
| Predictable extensions | Editor durability gates, external file updates, autosave, multi-cluster routing, tabs, and deep links all require independently identifiable route intents and coherent continuation. |
| Participating layers | TanStack Router location/search state, React route synchronization, pre-transition gate registration, Zustand selected and rendered note state, request sequencing, sidebar accessibility state, draft flushing, tests, and real-browser QA. |
| Near-term seams | A unique route-intent token, one latest-intent registry, a typed pre-transition result, exact coherent-selection predicates, and intent-aware active-load ownership. |
| Exclusions | Markdown projection authority, editor controller implementation, Sentry semantic payloads, local-runtime retry/copy, new route shapes, tabs, autosave, and multi-cluster UX remain separate capabilities. |

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

| Term | Meaning |
| --- | --- |
| Route intent | One immutable navigation occurrence with `intentKey`, monotonic generation, target (`note` with ID or `startup_fallback`), existing Slice 7B route source/operation evidence, location occurrence when known, and optional application-navigation token. Repeated visits to the same note or history entry are distinct intents. |
| Current route intent | The latest intent registered synchronously from router or list navigation. Only this intent may continue into selected-note mutation or repair its own URL. |
| Application-navigation token | A unique token attached to TanStack Router history state for one list push, startup replace, or cancellation repair. A pending-token registry recognizes exactly one expected echo; a consumed token encountered by later Back/Forward creates a new intent. |
| Location occurrence | The router's destination location key plus an Azurite generation allocated on `onBeforeNavigate`. A same-location React rerender creates no intent; every actual traversal does, even when it revisits a stored location/token. |
| Committed route state | The most recent terminal coherent route/view descriptor, or `none` before one exists. For a ready editor it retains identity only and restores from the live exact session, never from a stale Markdown copy. It is the only cancellation repair target. |
| Selected note | The note ID owned by the current live store transition. It can differ temporarily from the rendered note. |
| Rendered note | The ready editor retained as a visual projection while a replacement loads. It does not own current route intent merely because its ID matches a target. |
| Active load | One note read tagged with request sequence and the exact route intent that authorized it. It may be reused only when it still belongs to the current intent and selected note. |
| Pre-transition gate | One replaceable runtime capability with `prepare` and `settle` operations. `prepare` receives only cause plus outgoing owner identity, never target/location/intent. It returns a result and per-call lease. The route owner binds that lease to the intent and calls `settle` exactly once. |
| Gate lease | A unique target-free token for one gate call. Calls may share one underlying flush/durability promise, but independent leases/ref-counting prevent a stale intent from releasing a freeze still used by a current intent. |
| Transition predecessor | The committed route/view descriptor captured for an intent. A current cancellation invalidates its admitted load, restores the still-live committed selection/view, and repairs to that committed URL; a stale cancellation changes nothing. |
| Transition outcome | One exact terminal result for an intent. It includes intent/target identity, status-specific fields, and this intent's surface effect. Gate settlement and Slice 7B evidence consume the result; they never infer it from `Promise<void>`. |

### Exact Result Contracts

Implementation type names may differ only if this section is refreshed before
code changes. Variant membership, ownership, and state effects are fixed:

```ts
type RouteGateCause = "note_list" | "startup_fallback" | "url_sync";

type RouteGatePrepareInput = {
  cause: RouteGateCause;
  outgoingOwnerKey: string | undefined;
};

type RouteGateResult =
  | { status: "continue"; leaseKey: string }
  | {
      status: "cancel";
      leaseKey: string;
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
      status: "coherent_noop";
      intentKey: string;
      noteId: string;
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
      reason: RouteGateResult & { status: "cancel" };
      repair: "not_needed" | "replaced" | "superseded";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string | undefined;
      reason:
        | "navigation_rejected"
        | "repair_rejected"
        | "notes_list_failed"
        | "note_read_failed";
      surfaceEffect: "retained" | "replaced_by_error";
    };
```

The gate `settle` input is `{ leaseKey, outcome }`. It receives no route target
other than the outcome's public note identity and cannot continue, repair, or
choose navigation. Registering a new gate replaces only future `prepare` calls;
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
   - After registration/location resolution, first return `coherent_noop` when
     URL, selected note, ready/missing view, and request ownership already agree.
     A no-op performs no gate, draft flush, load, or second evidence operation.
   - Otherwise invoke `prepare` before selected-note mutation or read admission.
     Bind its unique lease to the intent outside the gate. Invoke `settle`
     exactly once for every returned lease on every terminal path.
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
- Fixing backend-down duplicate reads or misleading proxy error copy.
- Changing the content-hash API, filesystem writes, or draft schema.
- Using telemetry timing as product synchronization.
- Removing the previous-note projection while a new read is pending unless the
  final implementation proves that is required for honest state.

## Implementation Plan

1. Add focused shared route-transition types for intent, source, gate result,
   and outcome. Keep router/location objects and callbacks out of Zustand and
   serialized state.
2. Extend the router adapter and `App` boundary so route synchronization carries
   stable location identity plus Azurite intent generation, not only
   `routeNoteId`.
3. Create one React/store-facing transition owner that registers list, startup,
   and history intents, recognizes their route echoes, invokes the gate, and
   revalidates exact identity after every await.
4. Adapt today's outgoing draft flush to the gate. Translate its failure into a
   typed cancellation and exact-current URL repair without changing Markdown
   authority or recovery policy.
5. Replace rendered-note-only skip and note-ID-only coalescing with the
   authoritative coherent-selection and active-load predicates.
6. Carry intent identity through note request metadata, success/failure
   application, missing-note recovery, and exact active-load cleanup.
7. Return typed outcomes to every caller and prove a coherent no-op or
   cancellation cannot strand future Slice 7D controller state.
8. Split router adapter, transition owner, predicates, and store actions by
   responsibility before any file exceeds 400 lines.
9. Update technical architecture and Slice 7D integration wording to reference
   the implemented owner rather than duplicating its contract.

## Verification Plan

### Automated Verification

- Predicate tests cover rendered-A/selected-B, selected-A/rendered-A with a
  conflicting current B load, and fully coherent A.
- Transition-owner tests cover two distinct intents targeting A, list-push route
  echo, startup-replace echo, gate delay, gate cancellation, and stale gate
  settlement.
- Deferred A/B store tests cover every read completion order, stale failure,
  missing-note recovery, and active-load cleanup.
- The exact classified race `A -> B -> A` fails before repair and settles all
  owners on A after repair.
- A stale B promise cannot be reused by a newer B intent after intervening A.
- URL repair occurs only for the exact current cancelled intent and never
  overwrites a later location, including a later intent for the same note ID.
- Every path returns the expected typed transition outcome.
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

Use the Codex Playwright skill and the shared acceptance runbook in Vite
development and optimized production on desktop and Pixel 6:

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
5. Exercise stale success, stale failure, missing-note recovery, and startup
   replacement with console and network inspection.

## Negative Side-Effect Guardrails

The shared baseline is `docs/reference/product-guardrails.md`. This slice adds:

- startup replacement must remain one operation and one request;
- a route transition must not delete or mis-scope an outgoing dirty draft;
- a temporarily rendered editor must not accept save ownership for another
  selected note;
- ordinary awaited navigation must not gain duplicate reads;
- a cancelled or stale intent must not rewrite a newer URL, including one with
  the same target note ID;
- missing-note recovery and traversal rejection must remain coherent with the
  final URL;
- focus styling must not be confused with `aria-current` selection; and
- route identity and gate callbacks must remain ephemeral rather than entering
  persisted product state.

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
- The pre-transition gate has typed continue/cancel semantics and every route
  path returns a typed terminal outcome.
- Slice 7D can register editor durability through this gate without receiving or
  choosing route targets and without implementing URL rollback.
- Desktop and Pixel 6 Playwright proof passes in development and production.
- Full repository validation, production build, diff integrity, clean `main`,
  and synchronization with `origin/main` pass.

## Open Questions

None for planning. The exact route owner, unique-intent identity, gate timing,
coherent no-op predicate, active-load reuse rule, URL repair ownership, and Slice
7D integration seam are committed decisions. Implementation evidence that
requires another product capability or persistent owner triggers the working
agreement's Scope Re-selection During Review rule.
