# Production Desktop QA — 2026-07-11

## Status

- Environment: optimized Vite production artifact served through `vite preview`
  on `127.0.0.1:4173`, with Fastify on `127.0.0.1:3000`.
- Browser: headed Google Chrome at a 1440 by 1000 desktop viewport.
- Data safety: all notes were disposable copies; Daniel's real cluster was not
  opened or changed.
- Validation: `/opt/homebrew/bin/pnpm validate` and
  `/opt/homebrew/bin/pnpm build` passed with 282 tests.
- Release decision: **not passed** because an untouched note can become dirty
  and eligible for an unintended formatting rewrite.

This document is the authoritative repository record of the production desktop
QA report supplied after Slice 7B desktop observability QA. The original report
was delivered as a task attachment; this durable record keeps the evidence and
scope decisions available to successor tasks.

## Passed Product Behavior

- Production preview, the API proxy, and backend health checks worked.
- The normal production browser console contained no errors or warnings.
- Markdown discovery, nested notes, tables, lists, code blocks, and a long
  document rendered correctly.
- Deliberate WYSIWYG and Markdown-source edits saved and survived reload.
- Unsaved drafts recovered across reload.
- Missing-note recovery prevented saving and allowed explicit discard.
- External-write conflicts preserved the draft and did not overwrite disk.
- Empty and invalid cluster states remained visible and understandable.
- Missing-note and traversal-like URLs were handled safely; a literal
  `100%.md` route worked.
- Browser history restored the URL and article content.
- The long-document view had no horizontal overflow at the tested viewport.

No functional finding was production-only. The P1 and both P2 findings were
also reproduced through the development server. Production QA therefore found
coverage gaps and shared defects, not an optimized-build-only regression.

## Findings

| Severity | Finding                                                                                 | Evidence                                                                               | Disposition                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | An untouched Markdown note can immediately become dirty.                                | Several real-format documents showed `Unsaved changes` and enabled Save before input.  | Slice 7C, Markdown Fidelity And Honest Dirty State.                                                                                                  |
| P2       | Browser Back can restore URL and content while leaving the wrong sidebar item selected. | Product Vision content returned while Technical Architecture remained `aria-current`.  | Classify against the pre-7B baseline before 7B phone QA; repair in 7B if regressed there, otherwise create a separate route-state correctness slice. |
| P2       | Crepe's block `+` handle can insert a blank paragraph instead of keeping its menu open. | Reproduced in production and development without a console error.                      | Existing editor-interaction finding; not part of the fidelity slice.                                                                                 |
| P3       | A stopped backend produces misleading recovery copy.                                    | Vite's proxy `502` body became “Azurite returned an unexpected response shape.”        | Separate local-runtime resilience and recovery-copy work.                                                                                            |
| P3       | The production entry bundle remains large.                                              | Main JavaScript was about 1.51 MB raw and 471 KB gzip; Vite emitted its chunk warning. | Existing measured editor-loading and bundle-performance candidate after correctness work.                                                            |

## P1 Integrity Evidence

Opening raw Markdown in WYSIWYG can make Crepe serialize the same document into
a semantically equivalent but textually different form. Azurite currently
accepts that projection as if Daniel edited the note, then raw-string dirty
comparison, draft persistence, recovery, conflict, and save behavior all treat
it as user intent.

Observed effects:

- a newly opened note showed `Unsaved changes` and enabled Save before typing;
- switching between WYSIWYG and Markdown source could itself make the note
  dirty;
- one 7,933-character source became a 7,966-character serialized projection;
- a no-op save changed hyphen list markers to `*` and inserted blank lines;
- that no-op diff contained 72 added and 39 deleted lines;
- the false change could persist as a draft and produce a false
  `Recovered unsaved draft` message after reload; and
- discarding a legitimate conflict could reload disk and then immediately
  become dirty again because of the same projection mismatch.

No plaintext loss was observed in the sampled notes. The defect still violates
Azurite's canonical-file, preservation, honest-status, recovery, and conflict
guarantees by permitting unintended writes, Git churn, false recovery state,
and unnecessary conflicts.

## Slice Boundary

Slice 7C owns only the P1 fidelity and dirty-state capability. It must preserve
the exact loaded or recovered Markdown until Daniel actually edits content,
keep mode-only navigation clean, and prove that no draft or file write follows
from editor projection normalization.

The Back/sidebar divergence, block-menu interaction, backend-unavailable copy,
and bundle size are independently useful outcomes with different state owners
or verification boundaries. The working agreement's scope re-selection rule
therefore keeps them out of Slice 7C.

## Required Regression Matrix For Slice 7C

- pristine open remains clean after editor readiness and listener debounce;
- WYSIWYG to Markdown to WYSIWYG mode switches remain clean;
- reload does not recover a draft created only by editor normalization;
- conflict discard reloads the disk bytes and remains clean;
- no-op manual save is unavailable and a defensive programmatic save makes no
  API request;
- exact source bytes and the file content hash remain unchanged without a real
  edit;
- a genuine source edit and a genuine WYSIWYG edit still become dirty, persist
  a recovery draft, save, and survive reload; and
- a WYSIWYG edit followed immediately by a mode switch is not lost while
  Milkdown's debounced listener is pending.
