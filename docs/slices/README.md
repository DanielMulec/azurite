# Product Slices

Product slices are organized by delivery state so only one document defines the
work currently being implemented.

## Directories

- `active/`: the single slice currently approved for implementation.
- `planned/`: future slices that may still change before implementation.
- `archive/`: completed slice plans and their completion evidence.
- `template.md`: the required structure for a new slice proposal.

Git history preserves abandoned drafts and superseded plans. Do not keep backup
copies beside active or planned slices because they create competing sources of
truth.

## Current Sequence

The StrictMode lifecycle-conformance foundation, Task 3B editor-session
authority consolidation, and Task 3C persistence-result simplification are
completed. The post-StrictMode simplification program remains the authoritative
active document. Task 3D is approved against the post-Task-3C baseline; Task 3E
and Slice 7E remain unapproved and unimplemented.

1. Completed: Slice 7A, Sentry runtime delivery foundation.
2. Completed: Slice 7B, request correlation and note-route evidence. Both
   save-integrity review findings were repaired, the Back/sidebar divergence was
   classified as pre-existing, and the final eight-cell Playwright plus
   authenticated Sentry matrix passed on 2026-07-12. Exact evidence lives in
   `docs/qa/slice-7b-request-correlation.md`.
3. Completed: Slice 7C, URL selection and history coherence. Its original
   implementation passed the full browser and fault-harness matrix on
   2026-07-13. A later adversarial review reopened one correction; implementation
   commit `8831867b1de57ffa67fc89d529ba6d2aff777923` now preserves a pending
   predecessor through candidate cancellation, and the proportional four-cell
   desktop/Pixel 6 matrix passed. Its archived plan is
   `docs/slices/archive/slice-7c-url-selection-and-history-coherence.md`; exact
   evidence and the other finding dispositions are in
   `docs/qa/slice-7c-url-selection-and-history-coherence.md`.
4. Completed: Slice 7D, Markdown fidelity and honest dirty state. It preserves
   exact Markdown authority, orders browser-draft persistence, keeps Save and
   route ownership honest through degraded recovery, and retains same-session
   editor state. Its archived plan is
   `docs/slices/archive/slice-7d-markdown-fidelity-and-honest-dirty-state.md`;
   exact evidence is in
   `docs/qa/slice-7d-markdown-fidelity-and-honest-dirty-state.md`.
5. Completed: the unnumbered
   [StrictMode Lifecycle Conformance Foundation](archive/strictmode-lifecycle-conformance-foundation.md).
   Every current root and the component-test default now runs under StrictMode;
   Azurite-owned router, editor-adapter, registration, persistence, and action
   lifecycles are generation-safe. Milkdown remains officially released and
   unmodified, with rejected-create private cleanup qualified explicitly.
6. Active program; Tasks 3B–3C completed and Task 3D approved:
   [Post-StrictMode Ownership Simplification](active/post-strictmode-ownership-simplification.md).
   Task 3B consolidated editor-session authority and Task 3C simplified the
   persistence result ladder. The re-baselined store-workflow boundary is the
   approved next unit; the Sentry unit remains a separate unapproved checkpoint.
7. Planned: Slice 7E, semantic editor and persistence diagnostics. Its lifecycle
   prerequisite is complete, but it remains unimplemented and cannot be
   refreshed or promoted until all four selected ownership-simplification units
   are complete, unless Daniel explicitly reselects that proposal, and Daniel
   approves the later refreshed scope. Its plan is
   `docs/slices/planned/slice-7e-semantic-editor-and-persistence-diagnostics.md`.
8. Required immediately after 7E: Slice 7F, a focused editor-correctness repair
   using the 7A runtime, 7B correlation, 7C route owner, 7D Markdown-authority
   contract, and 7E semantic evidence to fix the mobile Markdown source-mode
   newline reversion. No unrelated feature slice may intervene.
   Its plan file is intentionally deferred until Slice 7E evidence identifies
   the durable cause; the Slice 7E immediate-handoff section and
   `docs/qa/mobile-markdown-newline-reversion.md` are authoritative meanwhile.
9. Product priority after Slice 7F: select and deliver the first complete,
   visible Cluster workflow. Architecture direction is in
   `docs/technical-architecture.md` under Cluster Resolution And Filesystem
   Error Evolution.
10. Deferred until after that visible Cluster progress: Route Failure
    Resilience for post-echo router rejection and malformed-target
    canonicalization during notes-list failure. Its plan is
    `docs/slices/planned/route-failure-resilience.md`.
11. Later candidate: a measured editor-loading and bundle-performance slice using
    the deferred boundary in `docs/technical-architecture.md`. Milkdown with Crepe
    remains the selected editor architecture.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
