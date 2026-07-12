# Slice 7B Request-Correlation QA Evidence

## Status

- Automated verification: passed on 2026-07-11.
- Desktop Sentry-enabled QA: passed on 2026-07-11.
- Desktop Sentry-disabled QA: passed on 2026-07-11.
- Post-implementation adversarial code review: two save-integrity findings open.
- Production desktop QA route finding: Back/sidebar regression classification
  open.
- Synthetic Pixel 6 Playwright QA: completed on 2026-07-12 against optimized
  production preview and Vite development builds, each with Sentry enabled and
  disabled. Detailed evidence and findings appear below.
- Physical-phone QA: no longer a standard Slice 7B completion gate. It is
  optional supplemental evidence only when Daniel explicitly requests it.
- Completion decision: Slice 7B remains active and is **not complete**. Repair
  and verify both adversarial findings, classify the route finding, and then
  re-run the closing synthetic Pixel 6 matrix. The 2026-07-12 baseline run was
  explicitly authorized before those repairs; it surfaces mobile evidence but
  does not waive the repair or route-classification gates.

This document is the authoritative implementation and QA evidence record for
Slice 7B. The active slice links here instead of duplicating these results.

## Automated Verification

The final pre-documentation implementation state passed:

```text
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

`pnpm validate` included formatting, the 400-line code-file limit, strict ESLint
with zero warnings, repository-script typechecking, every package typecheck,
and every package test suite. The passing test totals were:

| Package   |   Tests |
| --------- | ------: |
| Shared    |      56 |
| Core      |      43 |
| Web       |     127 |
| Server    |      56 |
| **Total** | **282** |

The production build passed with the existing non-blocking Vite chunk-size
warning. No ESLint configuration, rule, or package script was weakened. Slice
7B adds no `eslint-disable` directive; the repository's sole directive remains
the pre-existing Slice 7A `no-console` exception in
`apps/web/src/observability/web-sentry-test-events.ts`.

## Desktop Environment

- Disposable two-note cluster:
  `technical-architecture.md` and `overlap-and-conflict.md`.
- Browser: installed Google Chrome controlled through the Codex Playwright CLI.
- App origin: `http://127.0.0.1:5173` through the Vite API proxy.
- Backend: `127.0.0.1:3000` only.
- Observability: explicit local-debug Sentry web and server projects.
- Sentry access: a disposable copy of Daniel's Chrome authentication stores was
  used after direct Chrome control stalled while the Mac display was off. The
  clone and Playwright artifacts were deleted after QA; no authentication value
  was printed, committed, or retained.

## Exact Desktop Sentry Evidence

Sentry Logs, Trace Explorer, and Replay were queried through the authenticated
Sentry UI session. A process-local transport observer corroborated the exact
server envelopes while forwarding them unchanged to Sentry.

| Workflow          | Exact correlation                                                                                                                                                                                                                            | Result and event proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note list         | Request `975a8e02-4e72-4561-91d0-dd65a280b494`; no note-operation ID                                                                                                                                                                         | Browser `notes.list.started/succeeded` and `api.request.started/succeeded` joined server `notes.list.started/succeeded`; server status `200`, result `succeeded`, and duration `4.421ms`.                                                                                                                                                                                                                                                                                                                              |
| Note read         | Request `754ea531-15dc-4e2e-8c5b-92a566105ec2`; operation `c622db8d-90ba-44b0-ba4e-292da04c3a97`                                                                                                                                             | Browser load/API lifecycle joined server `note.read.started/succeeded`; status `200`, content hash `sha256:6c0dacf70551ce74763fffaf89af2dce894086516a064e8636e6377c752b3b1a`, and duration `9.173ms`.                                                                                                                                                                                                                                                                                                                  |
| Manual save       | Request `faaca4f4-6079-43a5-83f2-e63e02c134fc`; operation `41b5ee1c-adf7-45da-9e8c-b626b9170612`                                                                                                                                             | Browser `note.save.started`, API start/success, and `note.save.succeeded` joined server start/success. Expected hash `sha256:19e1bb86581c3ce2cc5d5254e82458bbb5f5db4f4361d31f64f10a82a8822f1f`; returned hash `sha256:fda9e5f17d6ef0214b6e8ae1912026511bfc96670a3f2b5f508a8b365cfdf7ba`; `PUT` returned `200`. The saved marker survived reload.                                                                                                                                                                       |
| Save conflict     | Request `b70f5b14-2e62-499e-96db-6d0e7a258a24`; operation `0e047192-613c-414f-ba21-d051f3aa0fab`                                                                                                                                             | Browser `note.save.started`, `api.request.failed`, and `note.save.conflicted` joined server start/conflict. Expected hash `sha256:fda9e5f17d6ef0214b6e8ae1912026511bfc96670a3f2b5f508a8b365cfdf7ba`; shared code `note_write_conflict`; status `409`. Sentry created no error issue. Chrome reported only the expected failed-resource line for the HTTP 409, with no unhandled `WebApiError`.                                                                                                                         |
| Overlapping reads | Stale request `424673e4-25a8-49f5-9406-1260d0897e7f`, operation `e3f1ba3c-d719-426a-8d62-7f02ec2dd181`, sequence `2`; current request `2c3b2d94-adf1-4f68-b3c6-d67f5138ce89`, operation `7ec368dd-8867-4b8a-af99-c13114cb5fb5`, sequence `3` | Both server reads started and succeeded independently. The first browser result emitted `note.load.stale_ignored` for `overlap-and-conflict.md` with `stale_completion=succeeded`; the second emitted `note.load.succeeded` for `technical-architecture.md`. The active UI remained on the current note.                                                                                                                                                                                                               |
| Edit during save  | Request `97ac8435-77a3-4ba8-a20c-07bd6f4c1394`; operation `18d74385-c169-48ab-b0ef-521a9c3b8df5`                                                                                                                                             | One browser save/API lifecycle joined one server start/success lifecycle. While Fastify was reversibly paused with its listener intact, Save stayed disabled and newer markdown was accepted in the editor. After resume, only the original snapshot reached disk, the newer marker remained dirty, and Save became available again. Expected hash `sha256:a28e7640a121496ae128d84ecd5bad01772dadaa505cfa775d9895d5847d7445`; returned hash `sha256:ad075394d42a6e72c03b448b108cf3cca289c60bc4544e5a0de6d77e3c6ddad1`. |

The overlap trace `c1ed177ef83146278af4cba834499c35` was sampled on
both surfaces. Sentry Trace Explorer showed:

- web `azurite.note.operation` spans for `notes.list` and `note.load`;
- web `azurite.api.request` spans;
- server `azurite.server.route` spans for `notes.list` and both independent
  `note.read` requests.

Replay `4cd9e345863d46d09c438c5680b34418` loaded in Sentry with zero
errors and 28 available recording segments. The recording data contained the
unmasked Azurite heading, `Technical Architecture`, the successful-save marker,
the conflict marker, and the newer-dirty marker.

## Expected-Error And Fail-Open Proof

The first desktop conflict exposed a real adapter edge case: the Sentry span
carrier can return a wrapper promise distinct from the product promise. Ignoring
that wrapper allowed an expected caught product rejection to surface as an
unhandled rejection. The shared fail-open span helper now settles any distinct
carrier promise without replacing or altering the exact product promise,
result, throw, or rejection. A regression test covers the distinct rejected
carrier promise. The post-fix conflict produced only the expected HTTP 409
resource line and no Sentry error issue.

Throwing tag, context, record, capture, and span carriers are covered on both
web and server. The strict tests prove product callbacks execute once and keep
their original synchronous and asynchronous semantics.

## Sentry-Disabled Desktop Evidence

The same disposable cluster was restarted with both web and server Sentry flags
disabled. The browser completed:

- `GET /api/notes` with `200`;
- `GET /api/notes/content` with `200`;
- `PUT /api/notes/content` with `200`;
- recovery-draft save to the normal `Saved` state; and
- zero Sentry envelope requests.

Automated disabled-runtime and throwing-carrier tests additionally prove that
correlation headers, Fastify request context, URL behavior, conflict behavior,
and product results do not depend on an initialized SDK.

## Synthetic Pixel 6 QA — 2026-07-12

### Decision And Method

Daniel changed Azurite's standard phone-acceptance path from a deferred physical
Pixel 6 session to Codex-operated Playwright emulation. The synthetic matrix
uses the bundled Playwright CLI with installed Google Chrome and the built-in
`Pixel 6` descriptor. It exercises the actual frontend and Fastify processes,
not mocked API responses, against disposable markdown clusters.

The verified device profile was Android Chrome with a `412` by `839` CSS
viewport, `412` by `915` CSS screen, `2.625` device scale factor, one touch
point, coarse pointer, and no hover. Every run used a fresh browser session and
disposable workspace, then deleted its browser profile, screenshots, traces,
and fixture files after evidence was recorded. No Daniel note was opened or
written.

Synthetic QA is now the normal completion path. It proves mobile layout, touch
emulation, browser storage, URL behavior, browser-to-proxy traffic, correlation
headers, and the local-only backend boundary. It does not claim to reproduce a
physical Android IME, device performance, remote tailnet transport, or
hardware-specific Chrome behavior; Daniel may request those as optional
supplemental evidence.

### Runtime Matrix

| Runtime                      | Sentry   | Synthetic phone result                                                                                                                                       | Observability and preservation proof                                                                                                          |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimized production preview | Enabled  | List, direct read, WYSIWYG save, reload, draft recovery, conflict, missing-note route, traversal-like URL, history, and local-only backend checks completed. | Browser sent successful envelopes; list/read/save requests carried correlation IDs plus `sentry-trace` and `baggage`.                         |
| Optimized production preview | Disabled | List, read, WYSIWYG save, and reload completed with the same product responses.                                                                              | Zero envelope requests; correlation IDs remained present while `sentry-trace` and `baggage` were absent.                                      |
| Vite development build       | Enabled  | List, read, WYSIWYG save, reload, and diagnostics-panel interactions completed.                                                                              | Deliberate web evidence succeeded; deliberate server event returned `sentry-trace=true` and `baggage=true`; browser envelopes returned `200`. |
| Vite development build       | Disabled | List, read, WYSIWYG save, reload, and disabled diagnostics-path checks completed.                                                                            | Zero envelope requests; the diagnostics panel was absent and its guarded backend route returned `404`.                                        |

Across the matrix, the document width remained exactly `412` CSS pixels with no
horizontal page overflow. Sidebar note buttons measured `56` CSS pixels high.
Save measured `38` pixels and WYSIWYG/Markdown mode buttons `36` pixels high;
that is an ergonomic observation against a common `44`-pixel recommendation,
not an established accessibility failure.

### Exact Correlation And Product Evidence

The enabled-production phone session produced these browser request identifiers:

| Workflow     | Request ID                             | Note operation ID                      | Evidence                                                                                                                                                                         |
| ------------ | -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List         | `c3a33470-4e65-4294-849a-844fe5443113` | none                                   | `GET /api/notes` returned `200`; its Pixel 6 request carried `sentry-trace` and `baggage`.                                                                                       |
| Read         | `1f1f591a-4815-47b4-b41b-100abe1e2e76` | `a35f317c-523b-4f7a-919c-2978fc4f6fd2` | `GET /api/notes/content` returned `200`; both correlation headers and trace headers crossed the proxy.                                                                           |
| WYSIWYG save | `c7b9c1a9-b861-46f3-bad1-485b21e2981a` | `ca88b731-d17b-408a-b0f5-9b2ef756f1db` | `PUT /api/notes/content` returned `200`; `PHONE-QA-7B-PROD-ENABLED-SAVED-2026-07-12` survived reload.                                                                            |
| Conflict     | `964dc876-55ad-4dbc-b88c-3abcec79c401` | `6c2679c9-db2c-4df4-81bf-dc639f13b331` | A real external fixture edit produced one `409 note_write_conflict`; the disk retained the external text, the client draft remained recoverable, and discard reloaded disk text. |

The enabled-development WYSIWYG save used request
`18cabb3b-f209-483f-b451-ce1510bbee38` and operation
`3a17c292-b03f-40a4-bbdd-8294aa92e1ac`; it persisted the development marker
through reload. The disabled-production save used request
`d64476a3-d7bc-48e5-935c-98ace0b6b8d5` and operation
`34ee3a00-ca42-46ed-9d3b-1d954e761273`. The disabled-development save used
request `23f1092a-5617-42f4-b3c2-b1ad1de77ba5` and operation
`5db47bef-9843-427d-b1e7-07feefc85b77`. Both disabled requests retained only
the Azurite correlation headers, as intended.

An unsaved WYSIWYG edit recovered after reload with the visible
`Recovered unsaved draft` state and remained browser-only before manual save.
The normal missing-note route showed `Note not found` without a save action, and
a traversal-like URL normalized to a safe first note without issuing an unsafe
note request. The history test returned the correct article and current
`aria-current` sidebar item in the small disposable fixture; it does not settle
the separate desktop Back/sidebar classification because that production finding
depends on a different fixture and pre-7B comparison.

The expected conflict produced only Chrome's failed-resource line for the
intentional `409`, not an unhandled product error. The known source-mode Enter
reversion was not used as a save path. A synthetic keypress retained a marker,
but that does not resolve or contradict the recorded physical Android-IME
finding in `docs/qa/mobile-markdown-newline-reversion.md`.

### Development Diagnostics And Boundary Evidence

The enabled-development Pixel 6 session displayed the explicit diagnostics
panel and unmasked `AZURITE-SENTRY-7A-UNMASKED-REPLAY-MARKER`. Its web button
reported `Web event and console evidence emitted.` Its server button returned
the marker with `status: sent`, `sentryTrace: true`, and `baggage: true`.
Browser envelope requests returned `200` throughout the enabled runs.

Fastify listened only on `127.0.0.1:3000`; Vite preview listened only on
`127.0.0.1:4173`. A direct probe to the Mac's Tailscale address could not reach
Fastify, while the loopback health check succeeded. This preserves the current
network boundary without making a physical-phone session a prerequisite.

### Authenticated Sentry Dashboard Follow-Up — 2026-07-12

The initial persistent Playwright clone of Chrome's `Default` profile reached
Sentry's anonymous welcome page. That did not prove Daniel's live Chrome session
was logged out: the Playwright CLI launched Chrome with `--use-mock-keychain`
and `--password-store=basic`, which cannot reliably read a macOS Chrome clone's
encrypted authentication state.

After Daniel opened Sentry in ordinary Chrome and explicitly authorized a retry,
Codex copied the entire on-disk Chrome user-data root into a disposable
directory, excluding only Chrome's live singleton locks. The copy included the
profile state, cookie databases and WAL files, local storage, service-worker
data, session-restore data, and `Local State`. Codex launched ordinary Chrome
against that clone, attached Playwright over its local CDP endpoint, then deleted
the clone and all Playwright artifacts after inspection. No cookie, token,
authorization header, DSN, or other credential value was read into QA evidence.

The authenticated Sentry UI then provided the previously missing visual proof:

| Surface                 | Direct Sentry UI evidence                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web issue and Replay    | `AZURITE-WEB-1` issue `133335046` displayed the deliberate web event and three linked Replays. Its newest Replay, `7502f91ad76f4e8290b53241338da3dc`, rendered the recorded Azurite diagnostics panel with the full unmasked `AZURITE-SENTRY-7A-UNMASKED-REPLAY-MARKER`.               |
| Server lifecycle        | `AZURITE-SERVER-2` issue `133754205` displayed server event `4f9cab3df6c2427e89c5fc48cd41d74a` for `POST /__azurite/dev/sentry-test-event`. Its event context showed the full marker plus `sentry.trace_header_seen: true` and `sentry.baggage_seen: true`.                            |
| Trace Explorer and logs | Trace `62df793ae011489688e69ee01fef4dd8` rendered a synthetic Android Chrome pageload, one linked Replay, two issues, `107` spans, and `29` logs. Its waterfall contained the browser interaction and Fastify `GET /api/notes`, `GET /api/notes/content`, and server test-route spans. |

This closes the dashboard/Replay evidence limitation for the 2026-07-12
baseline. It does not waive the existing save-integrity repair, route
classification, or closing synthetic-matrix gates.

### Findings And Scope Classification

| Severity | Finding                                                                                   | Evidence                                                                                                                                                                                                                               | Disposition                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Untouched Markdown can become dirty and save an unintended formatting rewrite.            | Fresh enabled-production Pixel 6 sessions opened `index.md` and the nested note as `Unsaved changes`; a no-input save changed `-` list markers to `*`, added blank lines, and reformatted table separators.                            | Confirmed existing Slice 7C Markdown Fidelity And Honest Dirty State finding. It remains outside 7B.                                                                          |
| P2       | A failed note selection triggers two identical read attempts after the backend goes down. | One Pixel 6 click on `nested/overlap-and-conflict.md` generated two `502` reads and two failed-resource lines, then showed the recovery error. The relevant navigation code predates 7B in the 2026-07-08 `271c820`/`f068375` history. | Add to the already separate local-runtime resilience and recovery-copy outcome; do not annex it to 7B or 7C. It needs a dedicated failure-navigation and error-copy contract. |
| P3       | Backend-unavailable copy mislabels the proxy failure.                                     | With Fastify stopped, the mobile UI said `Azurite returned an unexpected response shape.` after the proxy returned `502`.                                                                                                              | Confirmed existing production-desktop finding; same separate local-runtime resilience and recovery-copy outcome as the duplicate-attempt finding.                             |
| P3       | Vite development sessions emit a Vue feature-flags warning.                               | Both enabled and disabled Pixel 6 dev sessions logged the missing `__VUE_OPTIONS_API__`, `__VUE_PROD_DEVTOOLS__`, and `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` warning. Production preview had no warning.                            | Separate dev-tooling/console-noise candidate. In enabled debug mode it can contaminate Sentry console evidence.                                                               |
| Advisory | Save and editor-mode controls are smaller than a common 44-pixel touch target.            | Save is `38` pixels high; WYSIWYG and Markdown are `36` pixels.                                                                                                                                                                        | Record as a future mobile ergonomics review, not a hard accessibility failure or Slice 7B scope.                                                                              |

The P2/P3 resilience findings are independently useful local-runtime behavior,
not required to complete the current request-correlation user story. The
existing desktop QA record already classified recovery copy as separate; this
run adds the failure-navigation duplication evidence. No implementation work was
silently annexed to Slice 7B.

## Remaining Completion Gates

### Adversarial Review Repair Gate

The post-implementation adversarial review found two save-result ownership
defects that must be repaired before the closing synthetic phone re-run:

1. `applySaveFailure` captures the current editor, awaits latest-draft
   persistence, and then applies a failure/conflict state copied from the stale
   pre-await editor. A newer edit made while IndexedDB persistence is pending can
   therefore be overwritten. The repair must revalidate and mutate the exact
   current session after the await, with a regression test that pauses draft
   persistence and edits before settlement.
2. Save result ownership currently looks up a current editor by note ID. If an
   old same-note save settles after that note is closed and freshly reopened,
   the old operation can mutate the new session. The repair must require exact
   editor-session ownership for result mutation while preserving the intended
   edit-during-save reconciliation inside the original session.

Production desktop QA also found that browser Back can restore URL and content
while leaving the wrong sidebar item selected. Classify this against the pre-7B
baseline. If 7B introduced it through route synchronization, repair and verify
it in 7B. If it predates 7B, record a separate route-state correctness slice;
do not annex it to Slice 7C.

### Closing Synthetic Pixel 6 Matrix After Repair

After both code findings are fixed and the route finding is classified, Codex
must re-run the synthetic Pixel 6 matrix defined in the active slice. It must
record exact request and operation IDs for list, read, and a successful WYSIWYG
save; confirm the marker persists; confirm trace headers, visible unmasked
marker, and successful envelopes; and confirm Fastify remains locally bound and
unreachable directly over Tailscale. When an authenticated dashboard session is
available, also record the distinct Replay; otherwise record that limitation
without claiming visual Replay proof.

The phone save must use WYSIWYG. Markdown source Enter remains an explicitly
unfixed Slice 7D diagnostic target and is not a 7B completion path. After the
repair and closing synthetic evidence pass, update this record, mark the active
slice complete, move it to `archive/`, and only then promote Slice 7C.
