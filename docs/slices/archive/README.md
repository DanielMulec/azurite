# Archived Product Slices

This directory contains completed product-slice plans and their verification
records. Archived slices explain how the current product baseline was
established, but they are not instructions for current implementation work.

Current architecture belongs in `docs/technical-architecture.md`, stable
contracts belong in `docs/reference/`, and operational procedures belong in
`docs/runbooks/`.

Slice 7A's archive record includes its desktop Sentry/runtime evidence, the
original decision to defer physical-phone QA, and the successful follow-up
phone-Sentry evidence from 2026-07-10.

Slice 7B's archive record establishes request/note-operation correlation,
fail-open observability, exact-session save-result ownership, in-process
same-note write ordering, and desktop/Pixel 6 acceptance across both builds and
Sentry modes. Its detailed implementation and dashboard evidence is in
`docs/qa/slice-7b-request-correlation.md`.

Slice 7C establishes the validated action-aware route owner, exact browser
history cancellation, route-or-reload authorization, and target-free gate. Its
narrow pending-predecessor correction completed on 2026-07-13 in implementation
commit `8831867b1de57ffa67fc89d529ba6d2aff777923`; the exact regression and
development/optimized desktop/Pixel 6 evidence are in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`.

Slice 7D establishes exact Markdown authority, one same-session Crepe owner,
ordered browser-draft reads and mutations, honest record disposition and
persistence issues, terminal Discard epochs, and target-free editor handoff
through Slice 7C. Its full development/optimized desktop/Pixel 6, fault,
lifecycle-harness, authenticated Sentry, and final repository evidence is in
`docs/qa/slice-7d-markdown-fidelity-and-honest-dirty-state.md`.

The unnumbered StrictMode Lifecycle Conformance Foundation makes the product,
route-QA, Markdown-QA, and component-test roots Strict by default; establishes
render-pure committed router generations, replay-stable editor-session authority,
disposable Crepe generations, balanced registrations, and final draft settlement;
and keeps official Milkdown unmodified with its rejected-create limitation
qualified. Exact evidence is in
`docs/qa/strictmode-lifecycle-conformance-foundation.md`.
