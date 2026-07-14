# Planned Product Slices

This directory contains future slices that depend on preceding foundations or
may still change before implementation.

Planned slices describe stable product intent and the expected handoff. They
must be refreshed against the actual codebase before promotion to `active/`.

Before promotion, convert any exhaustive future-workflow inventory into the
compact boundary table from `docs/working-agreement.md`. Replace copied baseline
regression catalogs with a link to `docs/reference/product-guardrails.md` and
retain only risks unique to that slice.

Current order after the completed StrictMode lifecycle foundation:

1. Task 3B editor authority is complete in the active
   [Post-StrictMode Ownership Simplification](../active/post-strictmode-ownership-simplification.md),
   so request explicit approval separately for Tasks 3C–3E. No later unit is
   active or authorized.
2. Refresh Slice 7E, semantic editor and persistence diagnostics, against the
   completed Slice 7D and
   [StrictMode lifecycle](../archive/strictmode-lifecycle-conformance-foundation.md)
   baselines plus the completed simplification units before requesting
   promotion. It remains planned, unrefreshed, and unimplemented.
3. Required Slice 7F editor correctness immediately after 7E; no unrelated
   capability may intervene.
4. Select and deliver the first complete visible Cluster product workflow.
5. Route Failure Resilience, deliberately deferred until after that visible
   product progress.

Slice 7F intentionally has no speculative plan file yet. Slice 7E must write it
from completed diagnostic evidence; until then, Slice 7E's immediate handoff and
`docs/qa/mobile-markdown-newline-reversion.md` define the committed outcome.
