# Planned Product Slices

This directory contains future slices that depend on the active slice or may
still change before implementation.

Planned slices describe stable product intent and the expected handoff. They
must be refreshed against the actual codebase before promotion to `active/`.

Before promotion, convert any exhaustive future-workflow inventory into the
compact boundary table from `docs/working-agreement.md`. Replace copied baseline
regression catalogs with a link to `docs/reference/product-guardrails.md` and
retain only risks unique to that slice.

Current order after the active Slice 7C correction:

1. Slice 7D, Markdown fidelity and honest dirty state, including post-Save
   committed-owner coherence and failed-write retry ownership from the Slice 7C
   adversarial review.
2. Slice 7E, semantic editor and persistence diagnostics, gated by a substantive
   refresh against the completed Slice 7D implementation.
3. Required Slice 7F editor correctness immediately after 7E; no unrelated
   capability may intervene.
4. Select and deliver the first complete visible Cluster product workflow.
5. Route Failure Resilience, deliberately deferred until after that visible
   product progress.

Slice 7F intentionally has no speculative plan file yet. Slice 7E must write it
from completed diagnostic evidence; until then, Slice 7E's immediate handoff and
`docs/qa/mobile-markdown-newline-reversion.md` define the committed outcome.
