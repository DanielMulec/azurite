# Temporary Slice 7B Closing Checklist

## Purpose And Lifetime

This tracked checklist is the compaction-safe execution record for closing
Slice 7B. It is not a second product plan and does not replace the active slice,
architecture, working agreement, or authoritative QA evidence.

Keep this file until every completion gate below is proven, the evidence is
integrated into the authoritative documents, Slice 7B is archived, the final
repository state is clean and pushed to `origin/main`, and the active goal is
ready to be marked complete. Delete this temporary file as part of that final
documentation commit.

## Mandatory Reorientation After Compaction Or Continuation

- [x] Read `agents.md` completely.
- [x] Read `docs/working-agreement.md` completely.
- [x] Read `docs/engineering-standards.md` and
      `docs/reference/product-guardrails.md` completely.
- [x] Read
      `docs/slices/active/slice-7b-request-correlation-and-note-route-evidence.md`
      completely.
- [x] Read `docs/qa/slice-7b-request-correlation.md` completely.
- [x] Read this checklist completely and inspect its current checked state.
- [x] Read the Codex Playwright skill completely before browser QA and confirm
      `npx` plus the bundled wrapper are available.
- [x] Run `git status --short --branch`; remain on `main`, preserve unrelated
      work, create no side branch, and keep the full repository state synced to
      `origin/main` after every completed write batch.
- [x] Inspect the current diff, recent commits, test baseline, and relevant
      editor/save/router code before changing anything.

## Scope And Decision Ownership

- [x] Treat the active 7B slice as the implementation authority and
      `docs/qa/slice-7b-request-correlation.md` as the evidence authority; do
      not create another implementation proposal for the closing work.
- [x] Repair only work required to close the two confirmed 7B save-integrity
      defects and any Back/sidebar regression proven to have been introduced by
      7B.
- [x] If Back/sidebar divergence predates 7B, record and order a separate
      route-state correctness slice instead of annexing its repair.
- [x] Apply scope re-selection if implementation or QA reveals another product
      capability, state owner, persistence boundary, architectural foundation,
      or independently useful outcome.
- [x] Keep the already classified Markdown-fidelity, local-runtime recovery
      copy/duplicate-read, Vue warning, mobile ergonomics, block-menu, and
      Android newline findings outside 7B.

## Baseline And Reproduction

- [x] Identify the exact pre-7B Git baseline used to classify Back/sidebar
      behavior and record its commit ID in the QA evidence.
- [x] Record the current implementations and tests governing save-operation
      ownership, editor-session identity, draft reconciliation, route/store
      synchronization, history navigation, and sidebar selection.
- [x] Run focused existing tests before edits and record any genuine baseline
      failure without weakening lint, formatting, validation, or test policy.
- [x] Use only disposable note clusters and browser state for destructive QA;
      never open, edit, or overwrite Daniel's real Markdown notes.

## Save-Integrity Repair 1: Revalidate After Draft Persistence

- [x] Reproduce the `applySaveFailure` stale pre-await editor overwrite with a
      deterministic test that pauses latest-draft persistence, accepts a newer
      edit, and then settles the original save failure/conflict path.
- [x] Change failure application so it revalidates and mutates the exact current
      editor session after the await instead of applying a copied stale editor
      snapshot.
- [x] Prove the newer Markdown, revision, dirty state, recovery availability,
      save availability, and correct failure/conflict state survive settlement.
- [x] Prove draft-persistence failure remains visible and cannot destroy the
      only live dirty copy.
- [x] Prove successful save, expected conflict, unexpected failure, and
      edit-during-save behavior remain correct.

## Save-Integrity Repair 2: Exact Editor-Session Result Ownership

- [x] Reproduce an old same-note save settling after the note was closed and
      freshly reopened into a new editor session.
- [x] Require exact editor-session ownership, not note ID alone, before a save
      result may mutate editor/session state.
- [x] Preserve intended reconciliation for a newer edit made inside the
      original still-active session while its save is pending.
- [x] Prove stale success, conflict, and failure settlements cannot mutate a
      reopened same-note session, its saved baseline, dirty state, recovery
      state, status, or draft.
- [x] Prove exact matching draft cleanup after navigation remains safe and does
      not delete differing, newer-baseline, different-session, or different-note
      recovery data.
- [x] Preserve one active same-note save promise, operation/request correlation,
      and current server-side same-path write ordering.

## Back/Sidebar Divergence Classification

- [x] Define one deterministic fixture and exact steps that reproduce browser
      Back restoring URL/content while leaving the wrong sidebar item selected.
- [x] Reproduce and capture the behavior on current `main` in both development
      and optimized production builds.
- [x] Inspect the relevant 7B diff and history for route synchronization,
      selection ownership, `aria-current`, startup replacement, and stale-load
      changes.
- [x] Exercise the same deterministic scenario against the exact pre-7B
      baseline without switching `main` or creating a branch; use a disposable
      exported historical tree outside the repository if runtime comparison is
      needed.
- [ ] Record a decisive classification with code/history/runtime evidence.
- [ ] If introduced by 7B, repair it in 7B and add focused regression coverage
      for URL, content, selected note, sidebar `aria-current`, Back, Forward,
      rapid navigation, and stale responses.
- [ ] If it predates 7B, create and order a separate route-state correctness
      slice with its own coherent user story; do not repair it opportunistically
      in 7B or annex it to 7C.

## Automated And Static Verification

- [x] Run focused tests after each repair and add deterministic regression tests
      for both save-ownership defects plus any in-scope route repair.
- [x] Verify preserved list, read, save, conflict, draft, recovery, routing,
      stale-response, observability fail-open, correlation-isolation, filesystem,
      and security behavior named by the active slice and product guardrails.
- [x] Confirm every code file remains at or below 400 lines and responsibilities
      remain modular.
- [x] Run `/opt/homebrew/bin/pnpm validate` without adding or broadening lint
      exceptions, ignores, overrides, or policy changes.
- [x] Run `/opt/homebrew/bin/pnpm build`.
- [x] Run task-relevant focused typechecks/tests if they are not fully expressed
      by `pnpm validate`.
- [x] Run `git diff --check` and inspect the complete diff for unrelated changes,
      accidental formatting, generated artifacts, credentials, and secrets.

## Playwright Runtime Matrix

Use the Codex Playwright skill's bundled CLI and actual Chrome. Do not add
Playwright as a repository dependency and do not mock Azurite API responses.
Exercise the real Vite/preview frontend, proxy, Fastify backend, IndexedDB, and
filesystem behavior with disposable clusters.

- [ ] Desktop Chrome, Vite development build, Sentry enabled.
- [ ] Desktop Chrome, Vite development build, Sentry disabled.
- [ ] Desktop Chrome, optimized production preview, Sentry enabled.
- [ ] Desktop Chrome, optimized production preview, Sentry disabled.
- [ ] Pixel 6 Chrome emulation, Vite development build, Sentry enabled.
- [ ] Pixel 6 Chrome emulation, Vite development build, Sentry disabled.
- [ ] Pixel 6 Chrome emulation, optimized production preview, Sentry enabled.
- [ ] Pixel 6 Chrome emulation, optimized production preview, Sentry disabled.

For every applicable matrix cell:

- [ ] Start from a fresh app browser session and disposable browser storage so
      QA does not inherit unrelated drafts, service state, or prior navigation.
- [ ] Prove list, direct read, sidebar selection, Back/Forward URL-content-sidebar
      coherence, WYSIWYG edit, manual save, reload persistence, draft recovery,
      conflict recovery, missing-note handling, and traversal-like URL safety.
- [ ] Exercise edit-during-save and old-save-after-same-note-reopen scenarios in
      real browser flows where deterministic runtime control permits; automated
      tests remain the exact race proof.
- [ ] Record console errors/warnings, failed requests, unexpected duplicate
      operations, horizontal overflow on Pixel 6, and relevant control state.
- [ ] Confirm no new product failure or regression is introduced. Classify every
      newly observed issue under the working agreement rather than hiding it or
      silently expanding 7B.

For Sentry-enabled cells:

- [ ] Record exact request IDs and note-operation IDs for list, read, successful
      WYSIWYG save, conflict, and relevant navigation evidence.
- [ ] Confirm correlation headers plus `sentry-trace` and `baggage` cross the
      frontend proxy and join truthful browser/server lifecycle evidence.
- [ ] Confirm browser envelopes succeed, expected conflicts do not become fake
      error issues, and observability remains fail-open.

For Sentry-disabled cells:

- [ ] Confirm product and correlation behavior remains intact, no Sentry
      envelopes are emitted, and tracing headers are absent.

For production and mobile network-boundary proof:

- [ ] Keep Fastify bound to `127.0.0.1`, reach it only through the frontend
      proxy, and prove direct Tailscale access to the backend is unavailable.
- [ ] Use WYSIWYG for the mobile save marker; do not claim the separate Android
      source-mode Enter defect is fixed or accepted.

## Full Chrome Clone And Authenticated Sentry Verification

Daniel explicitly authorized a disposable full on-disk clone of his Google
Chrome data for Playwright authentication. Use that authority only for this QA
workflow and do not modify the original Chrome data.

- [ ] Locate the complete Google Chrome user-data directory and record only its
      path and non-secret inventory needed to confirm clone completeness.
- [ ] Make a disposable clone outside the repository containing all files,
      profiles, cookies, sessions, local state, extension state, metadata, and
      other on-disk entries found under the Chrome user-data root. Preserve its
      hierarchy and metadata; do not selectively omit discovered profile data.
- [ ] Avoid printing cookie values, tokens, credentials, encrypted secrets,
      authorization headers, or sensitive database contents into terminal/tool
      output, docs, Git, screenshots, or traces.
- [ ] Use the clone only in a separate Playwright persistent context for Sentry
      dashboard verification. Keep fresh isolated browser state for Azurite
      product matrix cells so Chrome history, IndexedDB, and service state do not
      contaminate acceptance evidence.
- [ ] Verify the clone is authenticated. If a live Chrome database snapshot is
      inconsistent, create a consistent disposable clone without altering the
      original and retry; never claim dashboard proof from an anonymous page.
- [ ] In Sentry, visually verify the closing enabled desktop and Pixel 6 sessions:
      Replay, Logs, Trace Explorer/waterfall, web/server lifecycle joins, exact
      request/operation IDs, unmasked Azurite marker/content, and the absence of
      unexpected issues.
- [ ] Do not claim evidence that the authenticated dashboard does not visibly
      provide. Record any limitation precisely.
- [ ] Close Playwright contexts and securely remove the disposable full Chrome
      clone plus temporary browser profiles after the evidence is recorded.

## Evidence, Archival, And Goal Completion

- [ ] Update `docs/qa/slice-7b-request-correlation.md` with repair tests, route
      classification, the complete desktop/mobile dev/production enabled/disabled
      matrix, exact IDs, authenticated Sentry proof, limitations, and any newly
      classified findings.
- [ ] Update the active slice with concise implementation and completion
      evidence without duplicating the full QA log.
- [ ] Confirm all active-slice acceptance criteria and slice-specific plus shared
      guardrails are proven, including the new behavior and preserved behavior.
- [ ] Move the completed 7B slice to `docs/slices/archive/` and update active,
      archive, sequence, architecture, standards, runbook, and research-source
      documentation only where the implemented truth requires it.
- [ ] Refresh 7C against the final 7B baseline and promote it according to the
      established single-active-slice workflow without changing its product
      decision unless new evidence requires scope re-selection.
- [ ] Remove this temporary checklist only after its durable evidence exists in
      the authoritative records and all other completion gates have passed.
- [ ] Inspect final `git status`, full diff, and recent commits; stage only
      task-owned files, write clear English commits, push `main`, and verify
      `main` is clean and exactly synced with `origin/main`.
- [ ] Mark the goal complete only after every required repair, classification,
      automated check, desktop/mobile browser matrix, Sentry verification,
      archival step, cleanup step, and push has succeeded with no known
      regression, newly introduced bug, unresolved in-scope issue, or falsely
      claimed evidence.
