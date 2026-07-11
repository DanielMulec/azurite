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
2. Active: Slice 7B, request correlation and note-route evidence. Implementation,
   automated verification, and desktop enabled/disabled Sentry QA passed on
   2026-07-11. It remains incomplete and unarchived. Before physical Pixel 6
   acceptance, repair the two adversarial-review save-integrity findings and
   classify the Back/sidebar divergence against the pre-7B baseline. Exact
   current evidence lives in `docs/qa/slice-7b-request-correlation.md`.
3. Planned: Slice 7C, Markdown fidelity and honest dirty state. It preserves
   exact untouched Markdown across editor readiness and mode switching, and
   prevents projection-only drafts, saves, and file rewrites. Its plan is
   `docs/slices/planned/slice-7c-markdown-fidelity-and-honest-dirty-state.md`.
4. Planned: Slice 7D, semantic editor and persistence diagnostics. Its plan is
   `docs/slices/planned/slice-7d-semantic-editor-and-persistence-diagnostics.md`.
5. Required immediately after 7D: a focused editor-correctness slice that uses
   the 7A runtime, 7B correlation, 7C Markdown-authority contract, and 7D
   semantic evidence to fix the mobile Markdown source-mode newline reversion.
   No unrelated feature slice should intervene.
6. Candidate after the required correctness fix: a measured editor-loading and
   bundle-performance slice using the deferred boundary in
   `docs/technical-architecture.md`. Milkdown with Crepe remains the selected
   editor architecture.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
