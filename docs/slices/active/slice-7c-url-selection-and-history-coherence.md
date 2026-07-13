# Slice 7C: URL Selection And History Coherence

## Status

Reopened on 2026-07-13 for one narrow corrective outcome: a cancelled candidate
must not strand its still-loading predecessor. The original implementation and
browser matrix passed, but a later adversarial review proved that application
navigation activates the candidate in Zustand before gate admission finishes.
That activation invalidates the predecessor's pending read even when the gate
then cancels the candidate.

Findings discovered by the same review have been reselected deliberately:

- successful-Save committed-owner coherence and failed draft-write retry
  ownership move into planned Slice 7D, whose same-session Save and ordered
  persistence architecture complete those workflows;
- post-echo router-promise rejection and malformed-target canonicalization while
  the note list is unavailable move into the separate planned Route Failure
  Resilience slice after visible Cluster product progress; and
- no other adversarial finding is part of this reopened correction.

The original implementation evidence and the adversarial reproduction record
are in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`.

The sequence is deliberately re-selected to `7B -> 7C -> 7D -> 7E -> 7F`:

- this reopened slice repairs cancellation while the predecessor is loading;
- planned Slice 7D then consumes the corrected gate for Markdown authority and draft
  durability;
- Slice 7E is refreshed after the implemented Slice 7D contracts exist; and
- Slice 7F performs the diagnosed editor-correctness repair immediately after
  Slice 7E.

Slice 7B QA classified this capability from a pre-existing race first introduced
with the Slice 6 navigation foundation. The authoritative reproduction is in
`docs/qa/slice-7b-request-correlation.md`.

### Reopened Correction Boundary

Fix the cancellation finding as a narrow Slice 7C correction because Slice 7D
will actively exercise that path. Add its exact regression test and run
proportional verification: full validation and builds plus cancellation on
desktop Chrome and Pixel 6 in Vite development and optimized production. Sentry
permutations are not required because this correction changes no observability,
correlation, transport, or fail-open behavior.

The correction is complete only when all of the following are true:

1. Note A has a route-authorized real read pending.
2. An application transition to B reaches a held pre-transition gate without
   invalidating A's load authorization or mutating selection.
3. The gate cancels B with `prerequisite_unavailable`; B settles
   `cancelled/entry_not_committed`, creates no history entry, and issues no B
   note read.
4. A's original response may still apply, commit the ready A route view, and
   clear loading because A remains the exact predecessor owned by the unchanged
   URL.
5. URL, selected note, rendered article, committed view, `aria-current`, request
   ownership, and history all agree on A after settlement.
6. New deterministic regression coverage fails on the reviewed baseline and
   passes after the correction.
7. The four selected browser cells pass through the existing dedicated
   production-tree harness: development desktop, development Pixel 6,
   optimized-production desktop, and optimized-production Pixel 6.
8. `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`,
   `/opt/homebrew/bin/pnpm qa:route-transition:build`, ordinary-bundle harness
   exclusion, and `git diff --check` pass; QA resources are cleaned up; and the
   complete repository state is clean and pushed to `origin/main`.

## Product Decision

One route-transition owner admits every note-navigation occurrence through an
action-aware history boundary before selected-note mutation or read admission.
An intent has unique identity even when another intent names the same note. That
owner alone validates the destination, decides whether the intent is current,
whether an active load may be reused, whether selection is already coherent,
whether a continuation may apply, and whether a cancelled traversal has returned
to its exact predecessor.

The URL remains Azurite's addressable selected-note owner. Zustand holds the
live transition state. The note still rendered for continuity is a projection,
not evidence that a newer route intent has completed.

A pre-transition gate may allow or cancel the current intent, but it never owns,
coalesces, or rewrites route targets. Slice 7C proves that seam with an injected
gate and lets today's best-effort draft flush finish without treating its
unavailable result as an exact durability veto. Slice 7D replaces that temporary
adapter with editor publication and exact-snapshot durability; it does not create
a second route owner.

## User Story

When Daniel selects notes or navigates rapidly with Back and Forward while
prerequisites and note reads overlap, Azurite eventually renders the note named
by the latest URL intent, marks that same sidebar item current, and rejects every
stale continuation. Repeating an intent for the note that is temporarily still
rendered cannot freeze the old editor, suppress the route action, or let another
note win while the URL says otherwise.

When a transition is cancelled, an application navigation adds no history entry
and a native traversal returns to its exact predecessor without overwriting or
making another entry unreachable.

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

| Boundary               | Decision                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Select notes and navigate with Back/Forward while route admission, best-effort draft flushing, note reads, and temporary previous-note rendering overlap.                                                                                                                                                        |
| Predictable extensions | Editor durability gates, external file updates, autosave, multi-cluster routing, tabs, and deep links all require independently identifiable route intents and coherent continuation.                                                                                                                            |
| Participating layers   | TanStack Router history blocking and lifecycle state, validated route/search adaptation, React route synchronization, pre-transition gate registration, Zustand selected/rendered/committed view state, request sequencing, sidebar accessibility state, best-effort draft flushing, tests, and real-browser QA. |
| Near-term seams        | A validated location occurrence, one action-aware transition owner, a typed target-free gate, a committed route-view descriptor, exact coherent-selection predicates, and route-or-reload active-load authorization.                                                                                             |
| Exclusions             | Markdown projection authority, editor controller implementation, Sentry semantic payloads, local-runtime retry/copy, new route shapes, tabs, autosave, and multi-cluster UX remain separate capabilities.                                                                                                        |

### Scope Re-selection Result

The route-transition owner moved before Markdown fidelity because the current
`shouldSkipNoteSelection` predicate can suppress the exact continuation that a
durability gate has just authorized. Closing an editor controller before calling
that predicate could therefore leave the old rendered session frozen with no
replacement.

The readiness review added action-aware history admission, destination
validation, a complete committed-view descriptor, rendered-session ownership,
explicit-reload authorization, and deterministic route-fault proof. These are
not independent product capabilities: each is required for the same URL
occurrence to own selection, history, loading, and its terminal surface without
corrupting another occurrence. Splitting any one out would leave route coherence
knowingly incomplete.

The generic target-free gate also belongs here because it is the transition
owner's cancellation boundary and Slice 7D cannot safely invent a second owner.
Exact draft disposition, editor freezing, retry, and snapshot durability remain
the stable separate capability in Slice 7D. Slice 7C's temporary production
adapter preserves today's best-effort flush behavior and fails open after
recording existing degradation; injected gates exercise cancellation without
silently annexing Slice 7D.

The duplicate-read finding is reselected only to the extent that one route
occurrence and its router echo must not issue two system-caused reads. The later
local-runtime resilience capability still owns retry, copy, and broader
backend-down recovery. The browser fault harness is proof infrastructure outside
normal product builds, not a product route or persistent state owner. Therefore
the reviewed delivery order remains `7B -> 7C -> 7D`; no additional slice or
combined 7C/7D slice is required.

The post-completion adversarial review re-ran scope selection rather than
annexing every discovered failure. Cancelling B while A is still loading remains
inside 7C because the gate cannot be a dependable prerequisite for Slice 7D if
its cancellation destroys the predecessor's only authorized completion.

Successful Save changing the live editor owner and a failed baseline draft
write losing its retry obligation now belong to Slice 7D. They participate in
7D's already-selected same-session Save and ordered draft-persistence workflows;
implementing temporary parallel repairs in 7C would create code that 7D must
immediately replace.

Post-echo `navigate()` rejection and malformed-target canonicalization during a
failed note-list load form the stable Route Failure Resilience outcome. The
former is deterministic in the router adapter but was not established as
reachable through the current real router; the latter preserves the zero-read
security boundary while leaving a malformed URL visible during backend
failure. Neither is required for 7D's editor-durability handoff, so Daniel
deliberately orders that resilience slice after visible Cluster product
progress.

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

| Term                          | Meaning                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validated location occurrence | One immutable browser-history occurrence containing the full `href`, pathname, validated Azurite search, hash, TanStack `__TSR_key`, `__TSR_index`, and an Azurite generation. The existing `parseAppLocationSearch`/`parseAppSearch`/`noteIdSchema` boundary validates it before it can become a note target. Repeated traversals are distinct intents even when their note IDs match. |
| Navigation kind               | The action that introduced the candidate occurrence: initial load, application push, startup replace, Back, Forward, Go, or canonical replace. TanStack history blocking supplies push/replace/traversal action; `onBeforeNavigate` does not.                                                                                                                                           |
| Route intent                  | One immutable attempt with `intentKey`, navigation kind, validated target, predecessor occurrence/view, existing Slice 7B route source/operation evidence, and optional application-navigation token. An in-place reconciliation may target the current occurrence without adding history.                                                                                              |
| Current route intent          | The latest non-terminal intent registered by the transition owner. Only it may mutate selected-note state, admit a route load, apply a route result, or decide its own cancellation outcome.                                                                                                                                                                                            |
| Application-navigation token  | A unique token attached to history state for one application push or startup replace. A pending registry recognizes its one history/router echo. A token encountered again through later traversal creates a fresh intent; cancellation never rewrites a visited entry merely to attach a repair token.                                                                                 |
| Committed route view          | The most recent terminal coherent occurrence plus `ready`, `missing`, `missing_draft`, `error`, or `empty` view identity. Ready and missing-draft variants retain the live rendered-session owner key, not Markdown. A target-owned read error is coherent committed route truth even though its transition outcome is failed.                                                          |
| Transition predecessor        | The committed route view captured before admission. An application cancellation leaves its entry uncommitted. A traversal cancellation returns to this exact history key/index without replacing either entry. A stale cancellation changes nothing.                                                                                                                                    |
| Selected note                 | The note ID owned by the current live store transition. It can differ temporarily from the rendered note.                                                                                                                                                                                                                                                                               |
| Rendered surface owner        | The session key of the currently rendered ready editor or missing-draft recovery surface. It is the only source of `outgoingOwnerKey`. `selectedNoteId`, pending target, and rendered note ID alone are never proxies for it. Missing, error, and empty surfaces have no outgoing editor owner.                                                                                         |
| Load authorization            | Either one exact current route intent or one explicit same-note reload such as `draft_discard_reload`. Both use request sequencing and record-identity cleanup. An explicit reload never manufactures a route intent or history entry and is never coalesced with a route load merely because the note ID matches.                                                                      |
| Pre-transition gate           | One replaceable runtime capability with `prepare` and `settle`. `prepare` receives a route-owner-created lease, cause, and rendered outgoing owner key, never a target, location, or intent. The owner binds the lease to the intent and calls `settle` exactly once in `finally`.                                                                                                      |
| Gate lease                    | A unique target-free token allocated for one gate call. Calls may share underlying work, but independent leases/ref-counting prevent stale settlement from releasing a capability still used by a current intent.                                                                                                                                                                       |
| Transition outcome            | One exact terminal result for an intent. It includes intent/target identity, status-specific fields, history effect, and surface effect. Gate settlement and Slice 7B evidence consume the result; they never infer it from `Promise<void>`.                                                                                                                                            |

### Exact Result Contracts

Implementation type names may differ only if this section is refreshed before
code changes. Variant membership, ownership, and state effects are fixed:

```ts
type RouteGateCause = "note_list" | "startup_fallback" | "url_sync";

type RouteNavigationKind =
  | "initial"
  | "application_push"
  | "startup_replace"
  | "history_back"
  | "history_forward"
  | "history_go"
  | "canonical_replace";

type ValidatedLocationOccurrence = {
  href: string;
  pathname: string;
  search: AppSearch;
  hash: string;
  historyKey: string;
  historyIndex: number;
  generation: number;
};

type CommittedRouteView =
  | {
      view: "ready" | "missing_draft";
      noteId: string;
      renderedOwnerKey: string;
      location: ValidatedLocationOccurrence;
    }
  | {
      view: "missing" | "error";
      noteId: string;
      renderedOwnerKey: undefined;
      location: ValidatedLocationOccurrence;
    }
  | {
      view: "empty";
      noteId: undefined;
      renderedOwnerKey: undefined;
      location: ValidatedLocationOccurrence;
    };

type NoteLoadAuthorization =
  | { kind: "route_intent"; authorizationKey: string; intentKey: string }
  | {
      kind: "explicit_reload";
      authorizationKey: string;
      source: "draft_discard_reload";
    };

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
      view: "ready" | "missing" | "missing_draft" | "error";
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
        | "awaiting_executor"
        | "awaiting_notes"
        | "awaiting_read"
        | "awaiting_history_restore";
      surfaceEffect: "none";
    }
  | {
      status: "cancelled";
      intentKey: string;
      noteId: string | undefined;
      reason: Extract<RouteGateResult, { status: "cancel" }>["reason"];
      historyEffect:
        "entry_not_committed" | "traversal_restored" | "not_needed";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string | undefined;
      reason:
        "navigation_rejected" | "notes_list_failed" | "store_apply_failed";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string | undefined;
      reason: "history_restore_failed";
      degradation: "route_history_unavailable";
      surfaceEffect: "retained";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string;
      reason: "note_read_failed";
      surfaceEffect: "replaced_by_error";
    }
  | {
      status: "failed";
      intentKey: string;
      noteId: string | undefined;
      reason: "owner_disposed";
      surfaceEffect: "none";
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

Store-executor registration follows the same identity discipline. Registration
replaces only future admissions and returns an unregister function that removes
the executor only when it still owns the slot. An intent waiting for an executor
remains `awaiting_executor` and joins the next registration. An admitted call
retains the executor it captured. Owner disposal settles queued and admitted
intents exactly once as `failed/owner_disposed`; no detached executor remains
callable.

### Required Transitions

1. **History admission and validated registration**
   - Construct one history-admission adapter and transition owner beside
     `createAzuriteRouter` before rendering `RouterProvider`. Register through
     TanStack history blocking with `enableBeforeUnload: false`; this slice adds
     no browser unload warning. The blocker supplies current/next raw locations
     and the push/replace/Back/Forward/Go action. `onBeforeNavigate` and
     `onResolved` are observation and exact-occurrence confirmation signals, not
     the source of navigation kind or validated product search.
   - Qualify the installed TanStack Router/history versions with direct contract
     tests before store integration. Application cancellation must create no
     entry; cancelled Back, Forward, and Go must return to the exact predecessor
     key/index without changing stack length or overwriting either entry. The
     adapter owns any focused dependency correction or app-side normalization
     required to meet that contract inside this slice. Cancellation by
     `replace` is prohibited.
   - Convert every current/next raw location through the existing
     `parseAppLocationSearch`/`parseAppSearch` and `noteIdSchema` route boundary
     exactly once. Preserve valid literal-percent and encoded-name behavior. An
     unsafe or malformed note becomes an undefined target and issues no note
     read. When note-list execution remains available, canonicalize it by replace
     only after admission while preserving pathname, hash, and all recognized
     unrelated search such as `azurite-dev=sentry-test`. The deferred Route
     Failure Resilience slice owns canonicalization when the notes-list request
     itself fails; zero-read safety remains mandatory in both states.
   - Seed the initial validated occurrence exactly once. Deduplicate the router's
     first `onBeforeNavigate`/canonicalization echo by history key and expected
     canonical occurrence. Queue the intent while the store executor is absent;
     same-location React rerenders create nothing.
   - A note-list push and startup replace register an application token before
     calling `navigate`. The blocker consumes that token as the same intent.
     Later traversal over its stored history entry creates a fresh generation
     and intent. A `navigate()` promise is never proof of exact completion: the
     owner requires the matching history occurrence and `onResolved`, then
     rechecks intent currency because a newer commit may resolve an older
     promise.
   - Remove pending tokens on their echo, rejection, supersession, or owner
     disposal. Navigation rejection before its history echo settles
     `failed/navigation_rejected` and leaves predecessor product state
     unchanged. The deferred Route Failure Resilience slice owns exact
     predecessor repair when `navigate()` rejects after its echo has committed
     the destination occurrence. No timeout is product control.

2. **Same-target policy and pre-transition gate**
   - A fully coherent note-list click settles directly as `coherent_noop` without
     calling `navigate`, the gate, draft flush, load, or evidence operation.
   - An application click for the target already present in the URL never pushes
     a duplicate entry merely to repair product state. It joins the exact current
     matching intent when one exists; otherwise it creates one in-place
     reconciliation intent for the current occurrence. A second click for the
     same pending target joins that intent. Distinct stored history occurrences
     reached through traversal remain independently identified.
   - For every other destructive candidate, capture the latest committed
     predecessor and derive `outgoingOwnerKey` from the rendered ready or
     missing-draft session. Allocate a lease and invoke `prepare` inside history
     admission before selected-note mutation or read admission. Store admission
     awaits gate continuation, exact occurrence confirmation, notes readiness,
     and executor readiness.
   - Re-check exact intent currency after every await. A stale `continue`,
     `cancel`, success, or failure settles top-level `superseded` in its current
     phase; cancellation never uses a nested superseded repair state.
   - Settle every allocated lease exactly once in `finally`, including thrown
     prepare/settle, navigation rejection, store failure, history restoration,
     supersession, and disposal. A settle failure is contained after the route
     outcome has been chosen.
   - Slice 7C's temporary production adapter joins an already-running baseline
     `flushPendingDraft` attempt so overlapping transitions cannot mistake that
     exact unresolved promise for completed work. An unavailable or thrown
     baseline attempt records the existing degraded draft status and then
     continues; it does not loop until an interactive editor stops changing or
     veto navigation. Slice 7D owns the failed-write retry obligation, freeze,
     ordered draining, cleanup-required disposition, explicit retry, and the
     first production `prerequisite_unavailable` cancellation.
   - A current application cancellation blocks the push/replace before it creates
     an entry and settles `entry_not_committed`. A current traversal cancellation
     restores the exact predecessor key/index and settles
     `traversal_restored`. Neither path copies Markdown, mutates selected state,
     reuses a superseded load, or replaces a visited history entry.
   - If the platform cannot confirm the traversal restoration, retain the live
     predecessor surface, admit no target read, publish visible
     `route_history_unavailable` status with recovery guidance, and settle
     `failed/history_restore_failed`. Do not claim coherent cancellation while
     the address bar and predecessor are unconfirmed.
   - Slice 7D replaces only the temporary gate adapter. It uses this target-free
     lease/settlement contract and cannot change route/history ownership.

3. **Selection and load authorization**
   - Mutate `selectedNoteId` only for the exact current intent.
   - Treat selection as a coherent no-op only when URL target,
     `selectedNoteId`, committed ready/missing/missing-draft/empty view, and
     absence of a conflicting current load all agree for that occurrence.
   - Do not use rendered note equality alone to skip a selection.
   - Reuse an active same-note promise only if its request sequence, selected
     note, and route-intent authorization still own the current transition.
     Otherwise start a new current load even when the target ID is identical.
   - Preserve 7B's `draft_discard_reload` as an `explicit_reload`
     authorization. It receives fresh operation, request, authorization, and
     session identity; forces a fresh same-note read; creates no route intent or
     history entry; and cannot reuse or be reused by a route-authorized load.
   - A current explicit route is recovered as missing/missing-draft even when
     the ready note list is empty. Only an undefined route plus an empty list
     settles the empty idle state. Startup fallback exists only for an undefined
     route plus a non-empty list.
   - Remove list-completion synchronization through a mutable
     `latestRouteNoteId` ref. List success resumes only the exact current intent;
     list failure settles that waiting intent as `failed/notes_list_failed`.

4. **Completion, committed views, and cleanup**
   - Apply read success, failure, or missing-note recovery to product state only
     when request sequence and its route-or-reload authorization remain current.
     An exact stale completion still clears the active-load record it created;
     cleanup authority is record identity, not permission to mutate current
     state. Wrap store application so an unexpected throw settles
     `failed/store_apply_failed` while `finally` still clears only the exact
     record and lease.
   - A ready, missing, or missing-draft application settles `applied`. Draft-read
     unavailability may degrade recovery while still applying the disk/missing
     view; it is not mislabeled as a route read failure. A current API read
     failure installs the target-owned error surface and settles
     `failed/note_read_failed` with `replaced_by_error`.
   - Commit the full validated occurrence and terminal view after applying ready,
     missing, missing-draft, error, or explicit empty state. Ready and
     missing-draft commits retain only their live rendered owner key. Never
     commit loading or a transient selected/rendered mismatch, and never restore
     Markdown from a descriptor.
   - A superseded intent settles at the first post-await currency check with the
     exact phase. Its late load/evidence may settle independently as stale but
     cannot create another route outcome.
   - For a ready result, URL target, `selectedNoteId`, rendered editor,
     `aria-current`, request sequence, and intent agree. For missing/error/empty
     results, URL and selected/view target agree and no unrelated sidebar item is
     current. These are the exhaustive final view states; the contract does not
     require a ready editor where none exists.

5. **Lifecycle timing**
   - The history blocker is the admission boundary. It records the validated
     intent and invokes target-free gate `prepare` early enough for Slice 7D to
     commit/freeze the rendered outgoing owner before router notification and
     store transition. Awaited work stays inside the owner's joined transition;
     `onBeforeNavigate` cannot create a competing authority.
   - Router callbacks, history action, search validation, store executor, and
     active-load coordinator share the same owner rather than keeping separate
     latest-note refs.
   - Disposing the owner unregisters history blocking and router subscriptions,
     removes pending tokens and the matching executor registration, settles all
     outstanding outcomes/leases, and prevents late callbacks from reaching
     product state.

## Goals

- Establish one validated, action-aware route-transition ownership contract.
- Preserve the browser stack when application navigation or native traversal is
  cancelled.
- Preserve independent intent for repeated same-note history occurrences while
  preventing duplicate entries for repeated pending application clicks.
- Distinguish selected intent, committed route view, rendered projection, and
  rendered outgoing-session ownership.
- Make every stale success, failure, cleanup, and navigation promise incapable
  of changing current selection, editor, recovery, URL, or accessibility state.
- Preserve startup fallback coalescing and eliminate duplicate system-caused
  reads.
- Preserve explicit same-note reload as a fresh non-route load authorization.
- Leave a typed gate/outcome seam that Slice 7D can consume without inheriting
  route targets or forcing 7C to implement draft disposition.
- Prove deterministic rapid Back/Forward behavior in store, router, history
  stack, and real browsers.

## Non-Goals

- Implementing Slice 7D's Markdown authority controller, editor freeze, draft
  disposition, or exact-snapshot durability policy.
- Cancelling production navigation because today's best-effort draft flush was
  unavailable, or guaranteeing edits made after gate admission are durable.
- New navigation UI, tabs, breadcrumbs, recent notes, or alternate route shapes.
- Adding retry UI or changing misleading proxy error copy for backend-down
  failures. Duplicate reads caused by one list/startup intent echo remain this
  slice's coherence responsibility even when the first read fails.
- Changing Discard's product semantics; this slice preserves its explicit fresh
  reload authorization so Slice 7D can order deletion and reload safely.
- Changing the content-hash API, filesystem writes, or draft schema.
- Adding a browser unload warning or relying on the experimental React
  `useBlocker` resolver UI.
- Using telemetry timing as product synchronization.
- Removing the previous-note projection while a new read is pending unless the
  final implementation proves that is required for honest state.

## Implementation Plan

1. Characterize the installed TanStack Router `1.170.17`, router-core
   `1.171.14`, and history `1.162.0` boundary before product integration. Lock
   direct tests for blocker boolean/action behavior, Back/Forward/Go restoration,
   raw versus validated search timing, initial and canonical events,
   `__TSR_key`/`__TSR_index`, queued history writes, and early navigation-promise
   resolution. Record any focused adapter or dependency correction in this
   slice; do not continue with an unqualified traversal rollback.
2. Add the authoritative types above in focused router-domain modules. Keep raw
   locations, validated search, history actions, and navigation functions at the
   adapter; keep scalar intent/load authorization in the store runtime; persist
   none of it. Add beginner-readable TSDoc for exported ownership APIs.
3. Implement and prove the action-aware history-admission adapter independently
   from React/store state. Cover uncommitted push/replace cancellation, exact
   Back/Forward/Go restoration, retry after cancellation, application tokens,
   traversal of consumed tokens, same-target suppression, stack length, and
   later Back/Forward reachability. Never use `replace` as traversal rollback.
4. Build the validated route adapter around existing `parseAppLocationSearch`,
   `parseAppSearch`, and `noteIdSchema`. Preserve recognized unrelated search,
   path, hash, single decoding, literal `%`, and diagnostics state; make malformed
   or traversal-like note search issue zero reads. Implement initial
   seed/canonicalization deduplication and exact-occurrence `onResolved`
   confirmation.
5. Construct the transition owner beside `createAzuriteRouter`, register history
   blocking and router observers before `RouterProvider`, and remove route
   selection from passive `useEffect`. Implement token cleanup, owner disposal,
   visible history-restoration degradation, and application same-target
   join/in-place reconciliation.
6. Implement replaceable target-free gate registration, rendered-owner input,
   per-intent leases, exact-once `finally` settlement, thrown/rejected
   containment, and identity-safe gate/store-executor replacement and
   unregistration. Add the temporary production adapter that joins one existing
   baseline flush attempt but fails open after existing degraded-state recording;
   do not add Slice 7D durability disposition.
7. Move list clicks and startup fallback into the owner. One joined transition
   waits for gate, exact occurrence, notes readiness, and executor readiness;
   list completion no longer reads a mutable latest-note ref. Replace
   rendered-note-only skip with the committed-view coherent predicate.
8. Introduce `route_intent | explicit_reload` load authorization. Carry exact
   authorization and request identity through read metadata, success/failure,
   missing-note recovery, current-only application, and record-identity cleanup.
   Preserve 7B's fresh `draft_discard_reload` operation/request/session behavior
   without route or history mutation.
9. Commit ready, missing, missing-draft, error, and empty route views with their
   exact validated occurrence and rendered owner. Return the complete applied,
   no-op, superseded, cancelled, failure, disposal, and degradation outcomes;
   guarantee executor and lease cleanup when store subscribers or application
   work throw.
10. Add a dedicated browser QA entry that mounts the production router and App
    with injected transition controls. Keep it outside the normal application
    entry/build graph, give it no product route or persistent switch, and build
    it only through explicit development and optimized acceptance commands.
11. Split `app-router.tsx`, `use-note-browser.ts`,
    `note-browser-route-actions.ts` (314 planning-time lines), history adapter,
    transition owner, predicates, gate registry, and store contracts by
    responsibility before any code file exceeds 400 lines.
12. Update technical architecture, Slice 7D integration wording, reusable
    TanStack research sources, and QA evidence to reference the implemented
    owner rather than duplicating its contract.

## Deterministic Browser-QA Seam

The acceptance-only entry injects controls at the history-admission/gate
boundary while mounting the real production route tree, App, Zustand store,
API client, and browser-draft implementation. Its controller exposes only these
ephemeral states:

- `idle` before activation and after restoration;
- `holding` after one exact lease is captured and before it resolves;
- `continue`, `cancel`, or `throw_prepare` as one-shot gate settlements;
- `throw_settle` after a chosen route outcome, proving containment; and
- `fail_restore_confirmation` at the adapter confirmation boundary, proving the
  visible degraded-state path without monkeypatching browser globals.

Activation records the lease and outgoing owner, holds no API response, and
never changes Zustand, Dexie, the filesystem, URL, or history directly. Product
actions still trigger every transition. Real response-order races use
Playwright's allowed request continuation delay without replacing response
status, headers, or body. Navigation-promise rejection and unexpected store
throws remain deterministic Vitest adapter tests because inducing them in a
browser would require replacing product internals rather than exercising a real
platform failure.

The harness is absent from ordinary Vite development and production builds. QA
runs a dedicated development entry and optimized harness build, restores
`idle` after every case, and then reruns the smallest normal navigation baseline.

## Verification Plan

### Automated Verification

- Installed-history contract tests cover application push/replace, Back,
  Forward, and multi-entry Go for continue/cancel. They assert exact keys,
  indexes, stack length, current location, cancellation retry, and all entries'
  later reachability rather than only the visible final URL.
- Route-adapter tests cover initial seeding, canonical echo deduplication, raw
  `onBeforeNavigate` versus validated search, unsafe `../secret.md`, encoded
  separators, `100%.md`, recognized unrelated search, path/hash preservation,
  navigation rejection, early promise resolution, pending-token cleanup, and
  owner disposal.
- Same-target tests cover coherent no-op, URL-target/incoherent-state in-place
  reconciliation, double-click while pending, and two genuinely distinct stored
  history entries with the same target.
- Predicate/gate tests cover rendered-A/selected-B passing A's rendered owner;
  selected-A/rendered-A with a conflicting B load; fully coherent A; no gate;
  registration/replacement/unregistration; per-caller leases; stale settlement;
  and thrown/rejected prepare/settle with exact-once terminal notification.
- Temporary-adapter tests prove overlapping callers join the same unresolved
  baseline flush; unavailable/throw records existing degradation and continues;
  and no failed attempt is reclassified as exact durability or silently treated
  as a successful cleanup. Slice 7D owns retry after the failed attempt.
- Deferred A/B store tests cover every read completion order, stale failure,
  missing-note recovery, target-owned committed error, unexpected store throw,
  and exact active-load cleanup.
- The exact classified race `A -> B -> A` fails before this slice and settles
  URL, committed view, selection, article, and `aria-current` on A afterward.
- A stale B promise cannot be reused by a newer B intent after intervening A.
- Cancellation affects only the exact current intent, never overwrites any
  visited entry or later location, and stale cancellation settles top-level
  `superseded` with the exact phase.
- Route changes while notes are loading, list failure, empty list with/without
  an explicit route, draft-read unavailability, ready-note failure,
  missing/missing-draft recovery, history-restoration failure, executor wait and
  replacement, disposal, and stale cancellation return the expected typed
  outcome and final state.
- `draft_discard_reload` creates fresh operation/request/authorization/session
  identity and a fresh read without changing history; it neither reuses nor is
  reused by a route-authorized same-note load.
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

Use the Codex Playwright skill and the shared acceptance runbook. Run the normal
application through the full desktop/Pixel 6,
Vite-development/optimized-production, Sentry-disabled/Sentry-enabled eight-cell
matrix. Run the dedicated fault harness in development and optimized form on
desktop and Pixel 6; the normal matrix already proves Sentry independence.

1. Prove ordinary list selection, Back, Forward, startup fallback, and same-note
   coherent no-op issue no duplicate reads or duplicate history entries.
2. Delay B, run `A -> B -> A`, and prove URL, selected note, article
   `data-note-id`, and sidebar `aria-current` settle on A for every response
   order.
3. Repeat with two history entries that name the same note and prove their
   intent identities remain independent, then prove repeated pending list clicks
   do not create such duplicate entries accidentally.
4. Hold and cancel application push, Back, Forward, and multi-entry Go through
   the harness. Confirm the outgoing rendered owner is exact, selection/read
   never starts, stack length and every key/index remain intact, retry succeeds,
   and later Back/Forward still reaches every original entry.
5. While selected B and rendered A intentionally diverge, prove gate input names
   A's session. Supersede its held lease with a newer transition and prove stale
   continuation/settlement cannot release or overwrite the current transition.
6. Exercise unsafe and malformed note search, percent/encoded filenames,
   startup canonicalization, diagnostics search preservation, empty and explicit
   missing routes, stale/current read failure, and the visible
   history-restoration degradation. Inspect exact console and network activity;
   unsafe targets issue no note read.
7. Prove today's unavailable best-effort draft flush records its existing
   degraded state and navigation continues. Use the injected gate—not the
   production adapter—to prove cancel, thrown prepare, and thrown settle behavior
   plus recovery to the next normal navigation.
8. Trigger Discard's same-note explicit reload and prove a fresh correlated read,
   unchanged history length/current occurrence, and preserved 7B evidence.
9. With Sentry enabled, prove Slice 7B operation/request IDs and `note_list`,
   `startup_fallback`, and `url_sync` evidence remain truthful through echoes,
   cancellation, and supersession. With Sentry disabled, prove identical product
   state and no Sentry transport.

## Negative Side-Effect Guardrails

The shared baseline is `docs/reference/product-guardrails.md`. This slice adds:

- startup replacement must remain one operation and one request;
- cancellation must not replace, duplicate, truncate, or make unreachable any
  existing history entry;
- repeated same-target application clicks must not manufacture entries while
  distinct same-target traversal occurrences remain independent;
- malformed or traversal-like note search must issue no filesystem/API read;
- canonicalization when note-list execution is available and every
  normal/cancelled transition must preserve recognized unrelated search,
  pathname, and hash; the deferred Route Failure Resilience slice owns
  canonicalization during notes-list failure;
- this slice must not worsen today's draft scheduling, deliberately delete an
  unresolved outgoing draft, or claim exact post-admission durability; Slice 7D
  owns editor freeze and snapshot-specific handoff;
- a temporarily rendered editor must not accept save ownership for another
  selected note;
- `outgoingOwnerKey` must describe the rendered session, never the selected or
  pending note as a proxy;
- `draft_discard_reload` must remain a fresh non-route read and must not add or
  alter history;
- ordinary awaited navigation must not gain duplicate reads;
- one failed list/startup intent echo must not issue a second system-caused read;
- a cancelled, failed, or stale intent must not rewrite a newer URL or apply
  after an early navigation-promise resolution, including for the same target;
- missing-note recovery and traversal rejection must remain coherent with the
  final URL;
- an unconfirmed history restoration must be visibly degraded rather than
  mislabeled as coherent cancellation;
- focus styling must not be confused with `aria-current` selection; and
- route identity and gate callbacks must remain ephemeral rather than entering
  persisted product state;
- thrown/rejected gate or settle work must not poison later transitions, strand
  a lease, leave a detached executor, or turn observability into product
  synchronization; and
- the gate must not enable a native `beforeunload` warning in Slice 7C.

## Acceptance Criteria

- Every validated note-navigation occurrence has unique history/action identity
  before asynchronous product work; unsafe targets never become reads.
- Only the current intent may mutate selection, admit/reuse a load, apply a
  completion, recover a missing route, commit a view, or confirm cancellation.
- Skip and coalescing predicates require coherent selected and request ownership;
  temporary rendered-note equality is insufficient.
- Rapid `Back -> Forward -> Back` and the reverse settle URL, article,
  `selectedNoteId`, and `aria-current` on the same note after every response
  order.
- Cancelled push/replace creates no entry; cancelled Back/Forward/Go preserves
  exact stack contents, reachability, index, and predecessor surface.
- Repeated same-target stored occurrences remain independent, while coherent,
  incoherent-current, and pending same-target application clicks add no duplicate
  entry.
- Application tokens distinguish their one expected echo from later traversal;
  navigation rejection, supersession, and owner disposal leak no pending token.
- The target-free pre-transition gate has exact continue/cancel semantics,
  per-caller leases, replacement/unregistration behavior, and exact-once
  settlement for every typed terminal outcome.
- The gate receives the rendered outgoing session key in selected/rendered race
  states. Store-executor lifecycle and unexpected application failure cannot
  strand an intent or lease.
- Ready, missing, missing-draft, target-owned error, and empty are complete
  committed route views; restoration stores identity and location, never stale
  Markdown.
- 7B's `draft_discard_reload` remains a fresh explicit authorization with no
  route or history mutation.
- The temporary production flush adapter preserves existing degraded behavior
  and fails open; injected gates prove cancellation until Slice 7D owns exact
  durability and failed-write retry.
- Slice 7D can register editor durability through this gate without receiving or
  choosing route targets and without implementing history rollback.
- The eight-cell desktop/Pixel 6, development/production,
  Sentry-disabled/enabled matrix and dedicated fault-harness matrix pass with
  preserved Slice 7B evidence.
- Full repository validation, production build, diff integrity, clean `main`,
  and synchronization with `origin/main` pass.

## Historical Completion Evidence

Installed TanStack History behavior is qualified by direct contract tests and a
focused inverse-delta cancellation patch. The complete route owner, store
authorization boundary, temporary fail-open draft adapter, and dedicated QA
entry passed focused and repository-wide automated coverage. The ordinary
eight-cell desktop/Pixel 6, development/preview, Sentry-disabled/enabled matrix
and four-cell fault-harness matrix passed, including the supplemental URL,
history, Discard, IndexedDB-unavailable, backend-down, and empty-cluster cases.

The authoritative commands, exact browser evidence, later adversarial finding
dispositions, and cleanup ledger live in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`. This evidence remains
valid for the scenarios it exercised, but the later pending-predecessor
cancellation reproduction reopened the slice and supersedes its original
completion decision until the correction boundary above passes.

## Open Questions

None for the narrow correction. The validated history-admission owner, action-aware
cancellation, same-target policy, committed-view/outgoing-owner identity,
route-or-reload authorization, temporary fail-open adapter, executable QA seam,
and Slice 7D boundary remain committed decisions. The correction changes only
the timing of store intent activation so cancellation cannot invalidate its
predecessor. Findings 2–5 retain the owners recorded in Status and Scope
Re-selection Result; they must not be pulled back into this correction without
new contradictory evidence and another explicit scope decision.
