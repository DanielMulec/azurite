# Future Slice: Route Failure Resilience

## Status

Planned and deliberately deferred as of 2026-07-13. Promote this slice only
after Slice 7F and at least one complete visible Cluster product workflow.
Finding evidence is authoritative in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`.

This slice owns two adversarial findings reselected out of the narrow Slice 7C
correction:

1. `navigate()` rejection after its history echo can leave destination URL B
   committed while selection, article, and committed route view retain A; and
2. an unsafe or malformed note target remains visible when the notes-list request
   fails before canonicalization, although zero-read security remains intact.

Neither finding blocks Slice 7D's editor-durability gate. The first has strong
deterministic production-adapter evidence but was not established as reachable
through the current real TanStack Router. The second is a degraded-state URL
hardening gap, not an unsafe filesystem read. Their stable shared outcome is
route coherence when infrastructure fails after or alongside admission.

## Product Decision

Azurite eventually makes every terminal route failure coherent even when the
router rejects after committing a history occurrence or the note-list backend is
unavailable during malformed-target handling.

A post-echo navigation rejection restores or reconciles one exact occurrence
before reporting a terminal result; it cannot retain predecessor content under a
destination URL. Malformed-target canonicalization depends only on validated URL
state and route admission, not on successful note-list loading. Zero-read
security remains unconditional.

The implementation must first requalify the installed TanStack Router/history
failure lifecycle and settle the exact repair rule. It must not guess whether a
rejected router promise means the committed destination is usable, replace a
visited entry casually, or create another route owner.

## User Story

When navigation infrastructure fails at an unusual lifecycle boundary, Azurite
still ends with an address bar, history occurrence, selected note, sidebar, and
rendered surface that tell one coherent story. When a malformed deep link is
opened while the backend is unavailable, Azurite removes the unsafe note target
without attempting a note read and preserves the rest of the address.

## Goals

- Define exact terminal repair for `navigate()` rejection before and after its
  history echo.
- Prove URL, history, committed view, selection, and rendered surface coherence
  for both real-router-reachable and deterministic adapter failure paths.
- Canonicalize malformed note search independently of notes-list success while
  preserving pathname, hash, and recognized unrelated search.
- Extend the acceptance-only route fault harness only where real browser proof
  requires a deterministic seam.

## Non-Goals

- Reopening Slice 7C's pending-predecessor cancellation correction.
- Changing Slice 7D editor publication, draft durability, or Save ownership.
- General backend retry UI, offline support, authentication, new route shapes,
  tabs, or multi-cluster navigation.
- Delaying the first visible Cluster workflow to implement this resilience work.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Recover coherent URL/history/product state from post-echo router rejection and canonicalize malformed targets during note-list failure.                     |
| Predictable extensions | Offline/reconnect, cluster switching, deep links, and future route shapes need the same distinction between validated occurrence and infrastructure health. |
| Participating layers   | TanStack Router/history adapter, route-transition runtime, validated search, Zustand committed route view, acceptance fault harness, tests, and browser QA. |
| Near-term seams        | Exact post-echo repair outcome and list-independent malformed-target canonicalization.                                                                      |
| Exclusions             | Editor durability, storage retry, general backend recovery UI, authentication, and multi-cluster routing remain separate workflows.                         |

## Implementation Plan

### 1. Requalify Router Rejection Timing

- Prove which real TanStack Router lifecycle failures can reject before or after
  history echo and `onResolved` for the installed versions.
- Preserve the deterministic `reject_after_echo` adapter reproduction even if
  the real router cannot currently trigger it.
- Update the authoritative route outcome contract with one exact repair rule and
  a visible degradation when repair cannot be confirmed.

### 2. Implement Exact Post-Echo Repair

- Keep one route-transition owner and exact predecessor occurrence.
- Restore or reconcile before terminal settlement so URL, history, committed
  view, selection, and article cannot split.
- Preserve pending-token, lease, request, and owner-disposal cleanup.

### 3. Decouple Malformed Canonicalization From Note Lists

- Detect the admitted malformed/unsafe target from validated route state before
  awaiting `ensureNotes()`.
- Replace only the note search value while preserving pathname, hash, and every
  recognized unrelated search parameter.
- Issue zero note reads whether list loading succeeds or fails.

### 4. Add Layered Proof

- Extend deterministic adapter tests for rejection before echo, after echo,
  supersession, repair success, repair failure, and later history reachability.
- Add list-failure canonicalization tests with exact URL and zero-read evidence.
- Add browser harness controls only if required for honest rendered proof and
  keep them absent from the ordinary bundle.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

- Repair must not overwrite, duplicate, truncate, or make existing history
  entries unreachable.
- A failed or stale repair must not rewrite a newer URL or product surface.
- Malformed canonicalization must never issue a note read or remove recognized
  unrelated search, pathname, or hash.
- Fault controls must remain acceptance-only and absent from normal builds.
- Route repair must not become an editor, draft, or cluster state owner.

## Verification Plan

- Run focused history/router/store tests and full repository validation.
- Run the dedicated fault harness in development and optimized production on
  desktop and Pixel 6 when the implementation changes rendered behavior.
- Prove ordinary-bundle exclusion after every harness build.
- Record exact URL, keys/indexes, stack reachability, selection, article,
  committed view, request counts, console state, and cleanup.

## Acceptance Criteria

- Every reachable pre-echo and post-echo rejection ends in one coherent terminal
  URL/history/product state or an explicit history-unavailable degradation.
- The deterministic `reject_after_echo` reproduction no longer permits URL B
  with predecessor surface A.
- A malformed target is canonicalized during note-list failure with zero note
  reads and exact preservation of unrelated address state.
- Existing normal navigation, cancellation, pending-predecessor recovery,
  same-target policy, and history reachability remain intact.
- Full validation, relevant browser proof, build/exclusion checks, clean `main`,
  and synchronization with `origin/main` pass.

## Open Questions

The exact post-echo repair mechanism remains intentionally open until the
installed real-router lifecycle is requalified. The product outcome and slice
boundary are settled; implementation must resolve this question before
promotion to `active/`.
