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
| Route intent | One immutable navigation occurrence with a unique `intentKey`, target note ID or startup fallback, source, and location identity. Repeated visits to the same note are distinct intents. |
| Current route intent | The latest intent registered synchronously from router or list navigation. Only this intent may continue into selected-note mutation or repair its own URL. |
| Selected note | The note ID owned by the current live store transition. It can differ temporarily from the rendered note. |
| Rendered note | The ready editor retained as a visual projection while a replacement loads. It does not own current route intent merely because its ID matches a target. |
| Active load | One note read tagged with request sequence and the exact route intent that authorized it. It may be reused only when it still belongs to the current intent and selected note. |
| Pre-transition gate | A registered callback that receives the immutable current intent and returns `continue` or `cancel`. It may protect outgoing state but cannot retain or choose targets. |
| Transition outcome | A typed terminal result for an intent: `applied`, `coherent_noop`, `superseded`, `cancelled`, or `failed`. Callers and future editor handoff use it to release temporary state safely. |

### Required Transitions

1. **Intent registration**
   - Register one unique intent synchronously before draft flush, editor commit,
     note read, or another asynchronous prerequisite begins.
   - Derive router-owned intent identity from a location/history identity when
     available and add a monotonic Azurite generation so distinct occurrences
     remain distinguishable even when note ID and search text match.
   - Register list selection before pushing its URL. Carry the same intent
     through the resulting router synchronization instead of creating a second
     competing intent for that echo.
   - Startup fallback replacement likewise retains one intent through its URL
     echo and must not issue a duplicate read.

2. **Pre-transition gate**
   - Invoke the gate only after registration and before selected-note mutation or
     note-read admission.
   - Re-check that the exact intent is current after every awaited prerequisite.
     A stale `continue`, `cancel`, success, or failure cannot act on a newer
     intent.
   - A `cancel` leaves the outgoing note selected and rendered. Repair a URL
     that already moved only when the exact cancelled intent is still current;
     use replacement, never push, and never overwrite a newer intent.
   - Slice 7C adapts the existing draft flush to this result contract. Slice 7D
     may extend the gate internally, but route ownership and revalidation remain
     here.

3. **Selection and load admission**
   - Mutate `selectedNoteId` only for the exact current intent.
   - Treat selection as a coherent no-op only when URL target,
     `selectedNoteId`, ready rendered editor, and absence of a conflicting
     current load all agree for that intent.
   - Do not use rendered note equality alone to skip a selection.
   - Reuse an active same-note promise only if its request sequence, selected
     note, and authorizing intent still own the current transition. Otherwise
     start a new current load even when the target ID is identical.

4. **Completion and cleanup**
   - Apply a read success, read failure, missing-note recovery, or active-load
     cleanup only when both request sequence and route intent remain current.
   - An older completion may clear only the active-load record it created.
   - Return an explicit transition outcome on every path, including coherent
     no-op and supersession. No caller may infer replacement from a resolved
     `Promise<void>`.
   - The final coherent state has URL target, `selectedNoteId`, rendered editor
     note, sidebar `aria-current`, and accepted request ownership on one note.

5. **Lifecycle timing**
   - Do not rely solely on a passive `useEffect` that runs after an already
     committed render to establish current intent. The router adapter must expose
     location identity and register the intent at the earliest synchronous
     boundary available to the application transition.
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
