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

1. Completed: Slice 7A, Sentry runtime delivery foundation.
2. Completed: Slice 7B, request correlation and note-route evidence. Both
   save-integrity review findings were repaired, the Back/sidebar divergence was
   classified as pre-existing, and the final eight-cell Playwright plus
   authenticated Sentry matrix passed on 2026-07-12. Exact evidence lives in
   `docs/qa/slice-7b-request-correlation.md`.
3. Active: Slice 7D, Markdown fidelity and honest dirty state. It preserves
   exact untouched Markdown across editor readiness and mode switching, and
   prevents projection-only drafts, saves, and file rewrites. Its plan is
   `docs/slices/active/slice-7d-markdown-fidelity-and-honest-dirty-state.md`.
4. Planned: Slice 7E, semantic editor and persistence diagnostics. Its plan is
   `docs/slices/planned/slice-7e-semantic-editor-and-persistence-diagnostics.md`.
5. Required immediately after 7E: a focused editor-correctness slice that uses
   the 7A runtime, 7B correlation, 7D Markdown-authority contract, and 7E
   semantic evidence to fix the mobile Markdown source-mode newline reversion.
   No unrelated feature slice should intervene.
6. Planned after the required correctness fix: Slice 7C, URL selection and
   history coherence. It repairs the pre-existing overlapping-history race
   without annexing route work to 7D or interrupting the required 7E-to-7F
   diagnosis/repair sequence. Its plan is
   `docs/slices/planned/slice-7c-url-selection-and-history-coherence.md`.
7. Candidate after the required correctness fix and Slice 7C: a measured editor-loading and
   bundle-performance slice using the deferred boundary in
   `docs/technical-architecture.md`. Milkdown with Crepe remains the selected
   editor architecture.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
