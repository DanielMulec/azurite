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

Slice 7C's archive record establishes validated action-aware route ownership,
exact browser-history cancellation, selected/rendered/committed-view coherence,
route-or-reload authorization, and the target-free editor-durability seam. Its
desktop/Pixel 6 normal and deterministic fault-harness evidence is in
`docs/qa/slice-7c-url-selection-and-history-coherence.md`.
