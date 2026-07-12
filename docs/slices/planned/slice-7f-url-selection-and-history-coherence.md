# Slice 7F: URL Selection And History Coherence

## Status

Planned after Slice 7D and the required immediately following editor-correctness
Slice 7E. This ordering preserves the established rule that no unrelated feature
intervenes between semantic editor diagnosis and repair.

Slice 7B QA classified this capability from a pre-existing race first introduced
with the Slice 6 navigation foundation. The authoritative reproduction is in
`docs/qa/slice-7b-request-correlation.md`.

## Product Decision

One URL note intent must resolve to one coherent selected-note state.

The router-owned note ID, Zustand `selectedNoteId`, rendered editor note,
sidebar `aria-current`, and accepted asynchronous load must never settle on
different notes. Keeping the previous editor rendered while a replacement loads
is allowed, but that projection must not be mistaken for ownership of a newer
route intent.

## User Story

When Daniel navigates rapidly with Back and Forward while note reads overlap,
Azurite eventually shows the note named by the URL, marks that same sidebar item
current, and rejects every stale response. No timing window leaves the URL on
one note while the article or selected sidebar item remains on another.

## Why This Matters

URL-owned selection is already Azurite's addressable navigation contract. A
split between URL, content, and sidebar makes the visible note untrustworthy and
can also send later edits or saves through the wrong mental context. This slice
restores one dependable ownership boundary before future file watching,
autosave, multi-cluster navigation, and richer history behavior increase the
number of overlapping transitions.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Select notes from the list and navigate with Back/Forward while reads, draft lookups, and route effects overlap.                                                                                            |
| Predictable extensions | External file updates, autosave, multi-cluster routing, tabs, and deep links all require route intent and rendered selection to stay coherent.                                                              |
| Participating layers   | TanStack Router search state, React route effects, Zustand request sequencing and selected-note state, rendered editor projection, sidebar accessibility state, draft flushing, tests, and real-browser QA. |
| Near-term seams        | An explicit route-transition owner, exact selected-versus-rendered predicates, and stale-load cancellation or rejection at every asynchronous boundary.                                                     |
| Exclusions             | Editor Markdown fidelity, diagnostics payloads, local-runtime retry/copy, new route shapes, tabs, autosave, and multi-cluster UX remain separate capabilities.                                              |

## Reproduction Baseline

The exact pre-7B tree at
`ac4f4a709b52c78537adf493dbd368039fa5e4fc` reproduces the defect with real
API responses when only the nested-note response is delayed:

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
same-note load reuse must likewise occur only while that load still owns current
route intent.

## Goals

- Define one exact route-transition ownership contract.
- Distinguish the note still rendered for continuity from the note currently
  selected by router intent.
- Skip a note load only when the URL, selected note, ready editor, and current
  request ownership all agree.
- Reuse an active same-note load only while its request sequence still owns the
  selected note.
- Make every stale success and failure incapable of changing selection, editor,
  draft recovery, or accessibility state.
- Preserve normal startup fallback coalescing without reintroducing duplicate
  system-caused reads.
- Prove deterministic rapid Back/Forward behavior in store, router, and real
  browser tests.

## Non-Goals

- New navigation UI, tabs, breadcrumbs, recent notes, or alternate route shapes.
- Fixing backend-down duplicate reads or misleading proxy error copy.
- Changing Markdown authority, editor lifecycle, draft schema, or save
  concurrency.
- Using telemetry timing as product synchronization.
- Removing the previous-note projection while a new read is pending unless the
  final implementation proves that is required for honest state.

## Architecture And Implementation Plan

1. Make the selected-versus-rendered distinction explicit in focused predicates
   instead of inferring selection from `noteState.editor.note.id` alone.
2. Require exact route note, `selectedNoteId`, request sequence, and active-load
   ownership before skipping or coalescing a read.
3. Re-evaluate the ordering between draft flush, router effect, synchronous
   selected-note mutation, and asynchronous note application. Keep URL state the
   addressable owner and Zustand the live transition owner.
4. Ensure an older completion can clear only its own active-load record and can
   never unlock, overwrite, or suppress a newer route intent.
5. Extend the current store concurrency suite with deferred A/B reads covering
   rendered-A/selected-B and stale active-same-note cases.
6. Extend `App.routing.test.tsx` with deterministic Back/Forward overlap and
   exact URL, article, `data-note-id`, and `aria-current` assertions.
7. Run Playwright against Vite development and optimized production on desktop
   and Pixel 6, using real responses with controlled latency only for the
   adversarial race proof.
8. Update technical architecture with the implemented route-transition owner
   and the distinction between selected intent and temporary rendered
   projection.

## Negative Side-Effect Guardrails

The shared baseline is `docs/reference/product-guardrails.md`. This slice adds:

- startup replacement must remain one operation and one request;
- a route transition must not delete or mis-scope an outgoing dirty draft;
- a temporarily rendered editor must not accept save ownership for another
  selected note;
- ordinary awaited navigation must not gain duplicate reads;
- missing-note recovery and traversal rejection must remain coherent with the
  final URL;
- focus may remain on the control Daniel activated, but focus styling must not
  be confused with `aria-current` selection.

## Verification And Acceptance

- Deterministic unit and router tests fail on the classified pre-fix race and
  pass after repair.
- Rapid `Back -> Forward -> Back` and the reverse direction settle URL, article,
  selected note, and `aria-current` on the same note after every response order.
- Stale success, stale failure, draft lookup delay, missing-note recovery, and
  active-load cleanup cannot suppress the final route intent.
- Startup fallback still coalesces its URL echo and force reload remains a new
  operation.
- Normal list selection and ordinary Back/Forward do not issue duplicate reads.
- Desktop and Pixel 6 Playwright proof passes in development and production.
- Full repository validation, production build, diff integrity, clean `main`,
  and synchronization with `origin/main` pass.
