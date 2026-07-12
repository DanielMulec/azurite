# Slice 7B Request-Correlation QA Evidence

## Status

- Completion decision: **passed and complete on 2026-07-12**.
- Automated verification: passed after both save-integrity repairs with 287
  tests, both typecheck layers, strict lint, formatting, the 400-line limit,
  production build, and diff-integrity checks.
- Save-integrity review gate: closed by exact editor-session result ownership
  and post-persistence revalidation, with five deterministic race regressions.
- Back/sidebar classification: closed as a pre-7B route-state defect. The exact
  historical tree reproduced it with real API responses under controlled
  latency; it is ordered separately as Slice 7F.
- Closing Playwright matrix: passed on desktop Chrome and Pixel 6 across Vite
  development and optimized production, each with Sentry enabled and disabled.
- Authenticated Sentry proof: passed through a disposable full Chrome clone;
  closing Replay, Trace Explorer, web/server joins, exact IDs, unmasked content,
  and absence of unexpected issues were visibly verified.
- Physical-phone QA: optional supplemental evidence only when Daniel explicitly
  requests behavior not modelled by the standard Pixel 6 path.

This document is the authoritative implementation and QA evidence record for
Slice 7B. The archived slice links here instead of duplicating these results.

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
| Web       |     132 |
| Server    |      56 |
| **Total** | **287** |

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

## Closing Repair And Acceptance Evidence — 2026-07-12

### Save-Integrity Repairs

`getCurrentEditorForSession` now requires the exact originating `sessionKey`
before a save result can mutate an editor. Failure and conflict settlement also
revalidate that exact session after awaiting latest-draft persistence instead of
reusing a pre-await editor snapshot.

`apps/web/test/note-browser-save-session-ownership.test.ts` adds five focused
regressions:

- failure and conflict pause draft persistence, accept a newer edit, and prove
  the latest Markdown, revision, dirty state, recovery state, and terminal
  result survive settlement;
- stale success, failure, and conflict settle after close/reopen of the same
  note and prove the fresh session remains entirely unchanged.

The repairs preserve edit-during-save reconciliation in the original session,
single-flight same-note saves, exact matching-draft cleanup after navigation,
different-note isolation, correlation identity, and the server's same-path
write coordinator. The implementation commits are `87e29cf` and `01a0555`.

### Back/Sidebar Classification

The exact pre-7B baseline is
`ac4f4a709b52c78537adf493dbd368039fa5e4fc`, the parent of the 7B
implementation commit. An initial unthrottled comparison happened to complete
coherently, but code ownership and a deterministic real-runtime comparison
proved the timing-dependent defect predates 7B:

- `shouldSkipNoteSelection` and `keepRenderedNoteWhileLoading` originate in
  `271c820` on 2026-07-08;
- the shortcut treats a requested note as already selected when its editor is
  merely still rendered, without requiring `selectedNoteId` to own that note;
- on the exported pre-7B tree, Playwright delayed only the real nested-note
  response by five seconds, never replacing or mocking its body;
- after a fully settled Back, the exact `Forward` then immediate `Back` sequence
  remained at URL `qa-enabled-prod-pixel.md` while the rendered article,
  `aria-current`, and focused item all became
  `nested/overlap-and-conflict.md`, even after 6.5 seconds;
- the pre-7B requests were real list/read calls, with no final target read after
  the last Back.

This is a pre-existing route-selection race, not a 7B regression. Repair is
therefore excluded from 7B and 7C and ordered as Slice 7F, URL Selection And
History Coherence. Ordinary awaited Back/Forward navigation remained coherent
in every final matrix cell. Slice 7F owns the overlapping-history failure.

### Final Eight-Cell Playwright Matrix

Each cell used a fresh Chrome session and a dedicated disposable note. The
browser exercised real Vite or preview assets, the relative API proxy, Fastify,
IndexedDB, and filesystem writes without mocked API responses.

| Runtime           | Device         | Sentry   | Result                                                                 |
| ----------------- | -------------- | -------- | ---------------------------------------------------------------------- |
| Vite development  | Desktop Chrome | Enabled  | Passed; only the already classified Vue feature-flag warning appeared. |
| Optimized preview | Desktop Chrome | Enabled  | Passed with no unexpected console output.                              |
| Vite development  | Pixel 6        | Enabled  | Passed; only the already classified Vue feature-flag warning appeared. |
| Optimized preview | Pixel 6        | Enabled  | Passed with no unexpected console output.                              |
| Vite development  | Desktop Chrome | Disabled | Passed with zero envelopes and no tracing headers.                     |
| Optimized preview | Desktop Chrome | Disabled | Passed with zero envelopes and no tracing headers.                     |
| Vite development  | Pixel 6        | Disabled | Passed with zero envelopes and no tracing headers.                     |
| Optimized preview | Pixel 6        | Disabled | Passed with zero envelopes and no tracing headers.                     |

Every cell proved list, direct read, sidebar selection, ordinary Back/Forward
URL-content-`aria-current` coherence, WYSIWYG edit, successful manual save,
reload persistence, unsaved-draft recovery, recovered-draft save, a real
external-write conflict, conflict discard back to disk truth, missing-note UI,
and traversal-like URL normalization to `100%.md`. Expected conflicts produced
one browser failed-resource line for `409` and no unhandled product error.

The Pixel 6 cells verified Android Chrome, a `412` by `839` viewport, `412` by
`915` screen, DPR `2.625`, one touch point, coarse pointer, no hover, and zero
horizontal overflow. WYSIWYG was the phone save path. The separate physical
Android source-mode Enter finding remains unfixed and assigned to 7D diagnosis
plus its required follow-up repair.

### Exact Closing Correlation Examples

| Cell and workflow                   | Request ID                             | Note operation ID                      |
| ----------------------------------- | -------------------------------------- | -------------------------------------- |
| Enabled production Pixel list       | `94721b78-35a0-4cc0-93b5-494810bedc9a` | none                                   |
| Enabled production Pixel read       | `c2c32d0a-8a33-4bca-b142-a1e7f3f08d7a` | `42ea09d9-6aa0-4b5f-89d7-e243317b743c` |
| Enabled production Pixel save       | `2bc3ed69-5807-4cfe-bd17-732916bc5a96` | `3ea0b8e4-dc35-41a4-9bec-fea3aee0ff10` |
| Enabled production Pixel conflict   | `a81fb679-e821-41a1-b66b-516c783ec170` | `227b938a-8fbf-4a8e-b796-ef0521e7b004` |
| Enabled production desktop save     | `68aec645-cde9-4971-bb3c-bb3eeda3b6cc` | `8559e714-4cde-4e12-bd27-0ed24b0d66dd` |
| Enabled production desktop conflict | `bb211b5c-5fb5-4da7-8990-245b9b59d9ad` | `017897df-b91c-46ee-9ca0-2b98c78da25d` |
| Disabled production Pixel save      | `d307461e-1356-41d0-aa93-1e4e3d400013` | `fffb7014-f6da-4bf0-8107-cd81baa04d0f` |
| Disabled production Pixel conflict  | `699da4f4-64ac-409d-b30f-42f941cb8c14` | `7525e78c-af2e-408c-afce-7d67b2f3cfee` |

All enabled examples carried `sentry-trace` and `baggage`; their browser
envelopes returned `200`. All disabled examples retained Azurite correlation
headers while omitting both tracing headers, and their request logs contained
no Sentry envelope.

### Authenticated Sentry Closing Proof

Daniel authorized a complete disposable copy of the Google Chrome user-data
root. Codex copied the 3.8 GB root with all 31,538 regular files, profiles,
cookie databases and WAL files, sessions, local storage, service workers,
extensions, metadata, and `Local State`; only the clone's live `Singleton*`
process locks were removed before launch. Ordinary Google Chrome ran against
the clone, and Playwright attached over local CDP. No credential, cookie value,
token, authorization header, DSN, or secret was printed or retained. The cloned
browser and all clone data were deleted immediately after evidence capture.

Sentry visibly proved:

- Replay `9890d905f9b74dbc954ac6341f9e0992` is the closing optimized Pixel
  session, reports zero Replay errors, renders the actual narrow Android UI, and
  shows the full unmasked save, draft, and conflict text;
- Trace `4af3367352f0495ebef4c63c5dcda5c6` has zero issues, 17 spans, and 31
  logs; its waterfall joins the browser interaction to Fastify read and save
  routes;
- the server `azurite.server.route` `note.save` span visibly carries request
  `2bc3ed69-5807-4cfe-bd17-732916bc5a96`, operation
  `3ea0b8e4-dc35-41a4-9bec-fea3aee0ff10`, accepted/client ownership,
  `matrix-en-prod-pixel.md`, `PUT /api/notes/content`, and the expected content
  hash;
- conflict trace `88d7e489f4a4474992ee2408b5994eec` reports one linked Replay, 49 spans,
  29 logs, Android Chrome, and zero issues;
- the Logs surface visibly contains the closing `note.save.succeeded`,
  `note.save.conflicted`, API, route, load, and list lifecycle entries at the
  matching run times;
- the issue feed gained no issue from any expected final conflict.

### Network Boundary And Completion Decision

Fastify listened only on `127.0.0.1:3000`; loopback health returned success and
direct access through the Mac's Tailscale address was unreachable. Frontend
proxy access remained functional.

No new unclassified finding appeared. The known Markdown-fidelity, local-runtime
failure-copy/duplicate-read, Vue warning, mobile ergonomics, block-menu, and
physical Android newline findings retain their existing separate dispositions.
Both save-integrity findings are repaired, the route finding is decisively
classified, the closing matrix and authenticated Sentry proof pass, and Slice
7B is complete and ready for archive.
