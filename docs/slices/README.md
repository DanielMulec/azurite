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

The StrictMode lifecycle-conformance foundation is active and approved for
implementation.

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
5. Active: the unnumbered
   [StrictMode Lifecycle Conformance Foundation](active/strictmode-lifecycle-conformance-foundation.md).
   It defines the trustworthy lifecycle and ownership baseline required before
   further semantic observability work. Implementation is paused before
   production-code edits at its approved Milkdown dependency-patch scope gate.
6. Planned and blocked: Slice 7E, semantic editor and persistence diagnostics.
   It remains valuable, but cannot be promoted until the lifecycle/ownership
   foundation is trustworthy and its required post-7D refresh is complete. Its
   plan is
   `docs/slices/planned/slice-7e-semantic-editor-and-persistence-diagnostics.md`.
7. Required immediately after 7E: Slice 7F, a focused editor-correctness repair
   using the 7A runtime, 7B correlation, 7C route owner, 7D Markdown-authority
   contract, and 7E semantic evidence to fix the mobile Markdown source-mode
   newline reversion. No unrelated feature slice may intervene.
   Its plan file is intentionally deferred until Slice 7E evidence identifies
   the durable cause; the Slice 7E immediate-handoff section and
   `docs/qa/mobile-markdown-newline-reversion.md` are authoritative meanwhile.
8. Product priority after Slice 7F: select and deliver the first complete,
   visible Cluster workflow. Architecture direction is in
   `docs/technical-architecture.md` under Cluster Resolution And Filesystem
   Error Evolution.
9. Deferred until after that visible Cluster progress: Route Failure
   Resilience for post-echo router rejection and malformed-target
   canonicalization during notes-list failure. Its plan is
   `docs/slices/planned/route-failure-resilience.md`.
10. Later candidate: a measured editor-loading and bundle-performance slice using
    the deferred boundary in `docs/technical-architecture.md`. Milkdown with Crepe
    remains the selected editor architecture.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
