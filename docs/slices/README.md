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
3. Active: Slice 7C, URL selection and history coherence. It establishes the
   route-intent owner and typed pre-transition seam required by safe editor
   handoff. Its plan is
   `docs/slices/active/slice-7c-url-selection-and-history-coherence.md`.
4. Planned: Slice 7D, Markdown fidelity and honest dirty state. It consumes the
   Slice 7C gate, preserves exact Markdown authority, orders browser-draft
   persistence, and makes cleanup and Discard failure explicit. Its plan is
   `docs/slices/planned/slice-7d-markdown-fidelity-and-honest-dirty-state.md`.
5. Planned: Slice 7E, semantic editor and persistence diagnostics. It has a hard
   post-7D refresh gate before promotion. Its plan is
   `docs/slices/planned/slice-7e-semantic-editor-and-persistence-diagnostics.md`.
6. Required immediately after 7E: Slice 7F, a focused editor-correctness repair
   using the 7A runtime, 7B correlation, 7C route owner, 7D Markdown-authority
   contract, and 7E semantic evidence to fix the mobile Markdown source-mode
   newline reversion. No unrelated feature slice may intervene.
   Its plan file is intentionally deferred until Slice 7E evidence identifies
   the durable cause; the Slice 7E immediate-handoff section and
   `docs/qa/mobile-markdown-newline-reversion.md` are authoritative meanwhile.
7. Candidate after Slice 7F: a measured editor-loading and bundle-performance
   slice using the deferred boundary in
   `docs/technical-architecture.md`. Milkdown with Crepe remains the selected
   editor architecture.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
