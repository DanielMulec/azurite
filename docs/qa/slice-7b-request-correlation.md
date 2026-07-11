# Slice 7B Request-Correlation QA Evidence

## Status

- Automated verification: passed on 2026-07-11.
- Desktop Sentry-enabled QA: passed on 2026-07-11.
- Desktop Sentry-disabled QA: passed on 2026-07-11.
- Post-implementation adversarial code review: two save-integrity findings open.
- Production desktop QA route finding: Back/sidebar regression classification
  open.
- Physical Pixel 6 QA: deliberately deferred because Daniel was away from the
  Mac and participating by phone.
- Completion decision: Slice 7B remains active and is **not complete**. Repair
  and verify both adversarial findings, classify the route finding, and only
  then perform the physical-phone acceptance session with Codex. The phone gate
  is deferred, not passed or waived.

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

## Remaining Completion Gates

### Adversarial Review Repair Gate

The post-implementation adversarial review found two save-result ownership
defects that must be repaired before phone QA:

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

### Phone Acceptance After Repair

After both code findings are fixed and the route finding is classified, Daniel
and Codex must run the physical Pixel 6 acceptance session defined in the active
slice. That session must record exact phone request and operation IDs for list,
read, and a successful WYSIWYG save; confirm the marker persists; confirm trace
headers and an unmasked distinct Replay; and confirm Fastify remains unreachable
directly over Tailscale.

The phone save must use WYSIWYG. Markdown source Enter remains an explicitly
unfixed Slice 7D diagnostic target and is not a 7B completion path. After the
repair and phone evidence pass, update this record, mark the active slice
complete, move it to `archive/`, and only then promote Slice 7C.
