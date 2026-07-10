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
2. Planned: Slice 7B, request correlation and note-route evidence. Its plan was
   reconciled on 2026-07-10 against the implemented 7A runtime, desktop and
   physical-phone evidence, and mobile editor findings, then hardened through a
   focused adversarial contract review on 2026-07-11. It awaits Daniel's review
   before promotion and implementation.
3. Planned: Slice 7C, semantic editor and persistence diagnostics.
4. Required immediately after 7C: a focused editor-correctness slice that uses
   the 7A runtime, 7B correlation, and 7C semantic evidence to fix the mobile
   Markdown source-mode newline reversion. No unrelated feature slice should
   intervene.

When a slice is completed, add concise completion evidence to its document and
move it to `archive/`. Promote the next planned slice to `active/` only after its
scope reflects the implemented baseline left by the previous slice.
