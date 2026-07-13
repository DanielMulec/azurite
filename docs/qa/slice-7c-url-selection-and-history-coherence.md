# Slice 7C URL Selection And History Coherence QA Evidence

## Status

- Original completion decision: **Passed on 2026-07-13**.
- Reopened decision: **Reopened on 2026-07-13 for the pending-predecessor
  cancellation correction**.
- Current decision: **Correction passed and Slice 7C completed on
  2026-07-13**.
- QA date and timezone: 2026-07-13, Europe/Vienna.
- Original browser-tested implementation commit:
  `250f14501caf34c7f7acb5974da1079dc6f64cc6`.
- Correction browser-tested implementation commit:
  `8831867b1de57ffa67fc89d529ba6d2aff777923`.
- Scope: validated route-intent ownership, exact browser-history cancellation,
  selected/rendered/committed-view coherence, route-or-reload authorization,
  target-free gate lifecycle, the acceptance-only fault harness, and preserved
  Slice 7B correlation/save/recovery guarantees.
- Authoritative contract:
  `docs/slices/archive/slice-7c-url-selection-and-history-coherence.md`.

This document is the authoritative implementation and review evidence for Slice
7C. The original green matrix remains valid for the scenarios it selected. The
later adversarial evidence superseded that decision until the correction below
passed.

## Pending-Predecessor Correction Completion

Implementation commit `8831867b1de57ffa67fc89d529ba6d2aff777923`
centralizes Zustand route-intent activation at the existing admitted-execution
boundary. Application start, route-intent registration, and late executor
registration no longer activate a candidate before its gate continues and its
exact location is confirmed. The acceptance-only Cancel control now returns the
reviewed `prerequisite_unavailable` reason.

The exact production-store regression first failed on the reviewed baseline:
A's response settled, but `noteState.status` remained `loading`. After the
correction it proves that B settles `cancelled/entry_not_committed`, creates no
entry or read, and A's original response commits the ready A route view with the
same selected note and history occurrence.

### Correction Run Ownership

| Item                  | Recorded value                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation commit | `8831867b1de57ffa67fc89d529ba6d2aff777923`                                                                                                                                                                       |
| Operating system      | macOS `26.5.1` build `25F80`, Apple Silicon                                                                                                                                                                      |
| Node / pnpm           | Node `v26.0.0`; pnpm `11.7.0`                                                                                                                                                                                    |
| Playwright / browser  | Codex Playwright wrapper `0.1.17`; Google Chrome `150.0.7871.114`                                                                                                                                                |
| `QA_RUN_ID`           | `slice-7c-correction-20260713T180044Z-de68e9e`                                                                                                                                                                   |
| `QA_ROOT`             | `/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T/azurite-slice-7c-correction-20260713T180044Z-de68e9e.qKpdz3`                                                                                                   |
| `ARTIFACT_ROOT`       | `/Users/danielmulec/Projekte/azurite/output/playwright/slice-7c-correction-20260713T180044Z-de68e9e`                                                                                                             |
| Origins               | Harness development `http://127.0.0.1:5174`; harness preview `http://127.0.0.1:4174`; both proxied to loopback Fastify at `127.0.0.1:3000`                                                                       |
| Sentry                | Explicitly disabled in server, Vite development, optimized build, and preview. Sentry permutations were not selected because the correction changes no observability boundary.                                   |
| Fault boundary        | Playwright delayed A's request for 30 seconds before Fastify ran, then continued the unmodified request. The existing acceptance-only gate held and cancelled B. No response body, status, or header was mocked. |

Every selected cell owned a separate disposable cluster and runtime:

| Cell                | Cluster ID                             | Server / frontend PID | Browser session                                                       |
| ------------------- | -------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Development desktop | `9a98cf37-469d-4596-9f7e-8382421c18b7` | `74190` / `74324`     | `slice-7c-correction-20260713T180044Z-de68e9e-dev-desktop-retry3`     |
| Development Pixel 6 | `44843263-029c-44d9-b876-c49ef2862db1` | `76064` / `76198`     | `slice-7c-correction-20260713T180044Z-de68e9e-dev-pixel`              |
| Preview desktop     | `b21f0209-c256-496e-a682-a786da2761d2` | `78347` / `78481`     | `slice-7c-correction-20260713T180044Z-de68e9e-preview-desktop-retry2` |
| Preview Pixel 6     | `73a8418f-8734-480a-a073-312128184a65` | `79419` / `79521`     | `slice-7c-correction-20260713T180044Z-de68e9e-preview-pixel`          |

### Correction Four-Cell Matrix

All four selected cells passed the same contract:

1. A's real content request remained pending while the URL and
   `aria-current` item named A and the article showed `Loading note`.
2. Holding a transition to B produced one gate lease with no rendered outgoing
   owner because A had not rendered yet. The URL, selected/current item, history
   key, index, and length remained A's; only A's pending content request existed.
3. Cancel settled that lease once with `terminalStatus: cancelled` and
   `surfaceEffect: retained`. B issued no content request and created no history
   entry.
4. A's original unmodified response then rendered its unique sentinel. URL,
   article `data-note-id`, `aria-current`, history key/index/length, and the
   committed product state agreed on A.
5. A subsequent ordinary B action issued exactly one B read, pushed one entry,
   and settled URL, article, and `aria-current` on B. Reset returned the harness
   to `idle`.

| Cell                | A occurrence before / after cancel | Requests before recovery | Normal recovery                        | Console                                             |
| ------------------- | ---------------------------------- | ------------------------ | -------------------------------------- | --------------------------------------------------- |
| Development desktop | key `c7k7k`, index `0`, length `2` | one A read; zero B reads | B at index `1`, length `3`; one B read | Existing Vue feature-flag warning only; zero errors |
| Development Pixel 6 | key `voww4`, index `0`, length `2` | one A read; zero B reads | B at index `1`, length `3`; one B read | Existing Vue feature-flag warning only; zero errors |
| Preview desktop     | key `5h3tr`, index `0`, length `2` | one A read; zero B reads | B at index `1`, length `3`; one B read | Zero warnings and errors                            |
| Preview Pixel 6     | key `grnfd`, index `0`, length `2` | one A read; zero B reads | B at index `1`, length `3`; one B read | Zero warnings and errors                            |

The two Pixel 6 cells reported a `412` by `839` CSS viewport, `412` by `915`
CSS screen, device scale factor `2.625`, touch support, coarse pointer, no hover,
and no horizontal overflow before or after cancellation. Hold, B, Cancel,
recovery B, and Reset used real Playwright `tap()` actions.

No clean selected cell emitted a Sentry envelope or made a `PUT`. All note
responses came through the frontend proxy from the real loopback Fastify and
disposable filesystem cluster.

### Correction Attempts And Disposition

| ID        | First attempt                                                                                                                          | Disposition                                                                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7C-C-QA-1 | The first development-desktop delay used runner-global `setTimeout`, which is unavailable inside the Playwright CLI callback.          | Runner setup error; the owned session was closed. The clean retry used `page.waitForTimeout` and did not mock the response.                                                             |
| 7C-C-QA-2 | A 12-second delay expired before headed-browser startup and semantic interactions completed, so A was ready before B reached the gate. | Coverage-selection miss, not a product failure; the clean retry used a 30-second window and captured B holding while A was still loading.                                               |
| 7C-C-QA-3 | The first preview bundle inherited enabled local Sentry configuration because disabled values were supplied only when preview started. | Invalid matrix dimension; the session and runtimes were closed, the optimized harness was rebuilt with Sentry disabled at build time, and both preview cells reran with zero envelopes. |

### Correction Automated Verification

The exact focused web run passed all `181` web tests. Full repository validation
passed with `336` tests: `56` shared, `43` core, `181` web, and `56` server.
The ordinary build, explicitly disabled optimized harness build, ordinary-bundle
harness exclusion check, and `git diff --check` also passed. The first full
validation attempt stopped on Prettier for the new regression; the second
reached strict lint and required splitting its oversized `describe` callback.
No lint rule, ignore, configuration, or validation boundary changed. The next
complete validation passed from the beginning.

### Correction Cleanup Ledger

| Owned resource                                                                                                       | Result                                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Seven named sessions, including the two discarded development-desktop attempts and discarded preview-desktop attempt | Closed; final Playwright list reported no browsers              |
| Four selected Fastify runtimes, four selected Vite/preview runtimes, and discarded-attempt runtimes                  | Gracefully stopped; ports `3000`, `5174`, and `4174` are free   |
| Four disposable clusters beneath `QA_ROOT`                                                                           | Exact owned root deleted after this record was written          |
| Correction `ARTIFACT_ROOT`                                                                                           | Exact owned artifact root deleted after this record was written |

Correction decision: **PASS**. `7C-AR-1` is resolved without annexing
`7C-AR-2` through `7C-AR-5`; their owners below remain unchanged.

## Post-Completion Adversarial Review

A read-only adversarial review at clean synchronized commit
`d425d6ec0b71fc8f6eede45facd36344d45f398b` found five coverage gaps while the
existing 335 tests, full validation, ordinary build, QA build, bundle-exclusion
check, and diff integrity remained green.

| ID      | Finding and evidence                                                                                                                                                                                                                                                                        | Scope disposition                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 7C-AR-1 | Cancelling B while A's real route read is pending invalidates A before gate admission. B cancels without an entry, but A's response is stale and the article remains permanently loading. Confirmed in rendered desktop development, Pixel 6 development, and Pixel 6 optimized production. | Resolved in implementation commit `8831867b1de57ffa67fc89d529ba6d2aff777923` and the correction matrix above.            |
| 7C-AR-2 | `navigate()` rejection after its history echo leaves URL/history on B while selection, article, and committed view retain A. Deterministically reproduced through the production router adapter; real-router reachability was not established.                                              | Planned Route Failure Resilience slice after Slice 7F and at least one visible Cluster workflow.                         |
| 7C-AR-3 | Successful real Fastify Save creates a new live editor owner without refreshing the committed route view; clicking the already-selected note issues another GET and replaces the editor instead of settling `coherent_noop`.                                                                | Active Slice 7D same-session Save owns the correction and its zero-I/O post-Save acceptance proof.                       |
| 7C-AR-4 | With malformed `..%2Fsecret.md` search and the real backend stopped, the notes-list request fails, zero note reads occur, and the unsafe search remains instead of canonicalizing.                                                                                                          | Planned Route Failure Resilience slice. The zero-read security boundary remains current product truth.                   |
| 7C-AR-5 | Browser-level IndexedDB failure produces one failed draft write and degradation, but no retry without another edit because the baseline retry flag is cleared.                                                                                                                              | Active Slice 7D ordered persistence owns an immutable retry obligation and visible retry without requiring another edit. |

No new finding appeared during the targeted browser pass. All owned browser
sessions, disposable content, QA processes, and ports were cleaned up; the
ordinary product bundle was rebuilt after the harness and contained no harness
markers. No source file changed during review.

The scope decision intentionally does not equate finding severity with roadmap
priority. `7C-AR-1` is inseparable from Slice 7D because 7D introduces the first
production cancellation on unavailable exact durability. `7C-AR-3` and
`7C-AR-5` are completed by architecture already selected in 7D. `7C-AR-2` and
`7C-AR-4` form an independently useful infrastructure-failure resilience
outcome that does not block editor durability or visible Cluster progress.

## Environment And Run Ownership

| Item                  | Recorded value                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository before QA  | Clean `main`, equal to `origin/main`; no unrelated paths                                                                                                                                                                    |
| Browser-tested commit | `250f14501caf34c7f7acb5974da1079dc6f64cc6`                                                                                                                                                                                  |
| Operating system      | macOS 26.5.1, build 25F80                                                                                                                                                                                                   |
| Node / pnpm           | Node `v26.0.0`; pnpm `11.7.0`                                                                                                                                                                                               |
| Playwright CLI        | Codex Playwright wrapper, CLI `0.1.17`                                                                                                                                                                                      |
| Browser               | Installed Google Chrome `150.0.7871.114`; Pixel descriptor reported Android 12 / Chrome `151.0.7922.10` user agent                                                                                                          |
| `QA_RUN_ID`           | `slice-7c-20260713T111721Z-917377a`                                                                                                                                                                                         |
| `QA_ROOT`             | `/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T/azurite-slice-7c-20260713T111721Z-917377a.T5b3KB`                                                                                                                         |
| `ARTIFACT_ROOT`       | `/Users/danielmulec/Projekte/azurite/output/playwright/slice-7c-20260713T111721Z-917377a`                                                                                                                                   |
| Runtime ownership     | One cell-owned Fastify process on `127.0.0.1:3000` and one cell-owned Vite/preview process on the selected origin; numeric PIDs were verified through `lsof` before use and stopped but were not retained in durable output |
| Frontend origins      | Normal development `http://127.0.0.1:5173`; normal preview `http://127.0.0.1:4173`; harness development `http://127.0.0.1:5174`; harness preview `http://127.0.0.1:4174`                                                    |
| Sessions              | Exact run prefix plus the eight normal cells, four harness cells, final normal baseline, metadata, and isolated supplemental sessions                                                                                       |
| Sentry                | Explicit disabled or enabled local-debug configuration; no DSN, credential, or authorization value recorded                                                                                                                 |

Ports `3000`, `5173`, `5174`, `4173`, and `4174` were free before their
respective runtimes started. Each cell verified `/health`, `/api/notes`, its
frontend origin, its unique sentinel, and a loopback-only Fastify listener
before browser interaction.

### Disposable Cluster IDs

The twelve primary cells used independent clusters:

| Cell                                 | Cluster ID                             |
| ------------------------------------ | -------------------------------------- |
| Development desktop, Sentry disabled | `861c64c6-b03c-43f0-aa8a-83289f41df6d` |
| Development desktop, Sentry enabled  | `69a0a712-6c3f-4671-9bec-81b530a1e60d` |
| Development Pixel 6, Sentry disabled | `96da60f0-08c3-40cd-a7d6-ba5ef83e90d1` |
| Development Pixel 6, Sentry enabled  | `886c64b6-88a9-4a9e-95a5-c045282e3fb7` |
| Harness development desktop          | `431354a9-8107-4687-9042-adf00c49a95b` |
| Harness development Pixel 6          | `058a3fed-1fa5-49cf-9bb8-4e0744e2d2f3` |
| Harness preview desktop              | `5c25f230-9d29-4133-8739-1878903614ba` |
| Harness preview Pixel 6              | `b48b53d2-303b-4aa5-bbb2-5cb5fd11aad7` |
| Preview desktop, Sentry disabled     | `d75babc5-2973-4d72-92b8-ab494f148cc9` |
| Preview desktop, Sentry enabled      | `9501b159-c7f1-4bfb-a797-544788a8a431` |
| Preview Pixel 6, Sentry disabled     | `603656f4-fb91-4627-8688-22ea22f1da60` |
| Preview Pixel 6, Sentry enabled      | `bd4eb04b-7d26-48b6-b574-0f4af4b07661` |

Each primary cluster contained unique `a-*.md`, `b-*.md`, and `c-*.md`
sentinels plus `100%.md` and `foo%2Fbar.md`. Request inspection showed zero
`PUT` operations during route-only cases. The one external-write/Discard fixture
was restored to its generated bytes; its final SHA-256 was
`70ff233866445512f5518c0c1ac444f5380e6f86ddb0ea059513d940f3139892`.
No Daniel-owned note or cluster participated.

## Coverage Selection

| Scenario                                                                                                              | Dev desktop  | Preview desktop                                                    | Dev Pixel 6                               | Preview Pixel 6                           | Sentry dimension                                  | Evidence                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Normal selection, same-target no-op, Back/Forward, delayed `A -> B -> A`                                              | Selected     | Selected                                                           | Selected                                  | Selected                                  | Enabled and disabled                              | URL, article owner, `aria-current`, history state, exact reads and headers     |
| Gate hold/cancel/throw/supersede and history restoration                                                              | Selected     | Selected                                                           | Selected                                  | Selected                                  | Not applicable; normal matrix proves independence | Dedicated production-tree harness, browser keys/indexes, settlements, requests |
| Unsafe/percent/missing/startup canonicalization                                                                       | Selected     | Not selected: runtime-independent adapter also has Vitest coverage | Not selected: no device-specific behavior | Not selected: no device-specific behavior | Disabled                                          | URL, requests, article/current state                                           |
| Pending same-target click, repeated stored target, Discard reload, unavailable IndexedDB, backend down, empty cluster | Selected     | Not selected: deterministic supplemental ownership proof           | Not selected: no device-specific behavior | Not selected: no device-specific behavior | Disabled                                          | Requests, history keys/index, visible state, disk, IndexedDB degradation       |
| Post-harness ordinary application baseline                                                                            | Not selected | Selected                                                           | Not selected                              | Not selected                              | Disabled                                          | Normal production entry, URL/article/current, console                          |

## Normal Eight-Cell Matrix

All eight normal cells passed the same assertions:

- startup began at history length `2`; selecting B pushed exactly one entry to
  length `3`;
- a coherent same-target click kept length `3` and issued no additional read;
- the complete race contained six exact note-read occurrences;
- delaying the real B request with request continuation, then navigating
  Forward to B and Back to A, settled the URL, article owner, selected note, and
  `aria-current` on A at index `0`, length `3`;
- all six reads carried Slice 7B request/operation correlation;
- disabled cells sent zero `sentry-trace`, `baggage`, or Sentry-envelope
  requests;
- enabled cells sent trace and baggage on all six reads. Development cells sent
  `16` Sentry envelopes and preview cells sent `14`, without changing product
  state.

The normal preview bundle contained neither `Slice 7C route QA` nor
`__azuriteRouteTransitionQa`.

## Dedicated Fault-Harness Matrix

The dedicated development and optimized harness passed on desktop and Pixel 6:

| Scenario                           | Exact result                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel application push            | The gate held A's exact rendered owner and a non-empty lease; selection and B read did not start; cancellation preserved A, the key/index, and stack length                                           |
| Throw from `prepare`               | One `throw_prepare` settlement retained A and later normal navigation recovered                                                                                                                       |
| Throw from `settle`                | B applied, one `throw_settle` settlement was contained, and later navigation remained healthy                                                                                                         |
| Supersede held B with C            | C became coherent; two leases settled; stale B continuation could not overwrite C                                                                                                                     |
| Cancel Back, Forward, and `Go(-2)` | Every predecessor key, index, and stack length was restored exactly; every original entry remained reachable with its original key                                                                    |
| Fail restoration confirmation      | One settlement retained the predecessor and showed “Browser history could not confirm the previous note. Retry navigation from the current page.”; reset plus normal A navigation cleared degradation |
| Selected B while rendered A        | During a real delayed B response, held C received A's exact rendered-session owner key; C settled coherently and late B stayed stale                                                                  |

The harness mounted the production route tree, App, Zustand store, API client,
Dexie path, and real Fastify/filesystem responses. Its controls acted only at
the reviewed gate/restoration seams. The first clean four-cell matrix ran after
the dedicated Vite root, public assets, and Tailwind source boundary were fixed.

## Supplemental Product Results

| Scenario                            | Result and exact evidence                                                                                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup fallback                    | `/?azurite-dev=sentry-test#focus` canonicalized to `/?note=100%25.md&azurite-dev=sentry-test#focus`; one list and one note read; diagnostics search/hash preserved                                                                       |
| Percent filenames                   | `100%25.md` opened `100%.md`; `foo%252Fbar.md` opened literal `foo%2Fbar.md`                                                                                                                                                             |
| Unsafe target                       | `..%2Fsecret.md` canonicalized without losing diagnostics/hash and issued zero note-content reads                                                                                                                                        |
| Missing and empty                   | Explicit missing showed target-owned “Note not found” with no unrelated current item; an empty cluster showed “No markdown notes found in this cluster” and explicit `ghost.md` remained a coherent missing view with zero content reads |
| Pending same-target double click    | History moved from length `2` to `3`, issued exactly one B read, and settled B coherently                                                                                                                                                |
| Independent same-target occurrences | `A -> B -> A -> B` created distinct B keys `jztp8` and `kvc3u`; both remained reachable around the intervening A occurrence                                                                                                              |
| Explicit Discard reload             | External disk change plus recovered-draft conflict followed by Discard issued exactly one fresh correlated read, preserved key `qlzhkk`, index `0`, length `4`, removed the draft marker, and retained the disk marker                   |
| IndexedDB unavailable               | Removing IndexedDB before startup displayed degraded draft recovery; source editing remained dirty and selecting B issued one read and settled coherent B while manual-save availability remained honest                                 |
| Backend down                        | Graceful Fastify shutdown produced the expected proxy `502`; B owned the URL/current/error surface with no unrelated article. Restart followed by A then B restored coherent B                                                           |

## Browser And Device Evidence

Every Pixel 6 cell reported a `412` by `839` CSS viewport, `412` by `915` CSS
screen, device scale factor `2.625`, touch support, coarse pointer, no hover, and
no horizontal overflow. Product and harness navigation controls were exercised
with Playwright `tap()` in the Pixel cells, not mouse-style `click` alone.

## Console And Request Evidence

| Cell or scenario          | Console                                                 | Requests and expected failures                                           |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Normal development        | Only the existing Vue feature-flag warning; no errors   | All product requests succeeded                                           |
| Normal preview            | Zero warnings or errors                                 | All product requests succeeded                                           |
| Harness development       | Only the existing Vue feature-flag warning; zero errors | Real list/read requests; controlled gate did not mock responses          |
| Harness preview           | Zero warnings or errors                                 | Real list/read requests; controlled gate did not mock responses          |
| Backend-down supplemental | One expected failed-resource line                       | One expected Vite proxy `502`; recovery requests succeeded after restart |

## Attempt And Finding Disposition

The runbook requires first failed attempts to remain visible. These did not get
silently replaced by the closing green matrix:

| ID      | First attempt                                                                                                                                                     | Disposition                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7C-QA-1 | The initial nested harness URL rendered TanStack's Not Found surface; the Pixel harness also lacked Tailwind styling                                              | In-scope acceptance-harness defects. A dedicated Vite root, public directory, and QA CSS `@source` boundary fixed them; both builds and all four harness cells reran cleanly |
| 7C-QA-2 | Early evidence scripts used browser-unavailable `URL`/`setTimeout`, referenced runner-local variables after return, or read a counter only after later traversals | Playwright runner/setup mistakes. Isolated scripts were corrected and rerun; exact product evidence is recorded above                                                        |
| 7C-QA-3 | A preview-enabled script attempted the development-only Sentry test-event button                                                                                  | Coverage-script mistake. The clean preview rerun omitted the unavailable control and proved natural envelopes plus identical product state                                   |
| 7C-QA-4 | Two Discard evidence attempts mishandled the confirmation dialog or used `document` outside the browser closure                                                   | Runner mistakes. The third isolated run proved one fresh read, unchanged occurrence/history, draft deletion, and disk truth                                                  |
| 7C-QA-5 | Final strict lint could not type-parse the dedicated harness entry because it was outside the web TypeScript project                                              | In-scope integration omission. The exact QA entry was added to `apps/web/tsconfig.json`; full validation then passed                                                         |

That statement described the original completion run only. The later
post-completion review above found `7C-AR-1` through `7C-AR-5` and now owns their
authoritative dispositions. `7C-AR-1` was resolved by the correction above; the
other four retain stable owners outside Slice 7C.

## Automated Verification

The final repository state passed:

```text
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
/opt/homebrew/bin/pnpm qa:route-transition:build
git diff --check
```

`pnpm validate` passed Prettier, the 400-line code-file limit, strict ESLint
with zero warnings, repository-script typechecking, all package typechecks, and
all package tests:

| Package   |   Tests |
| --------- | ------: |
| Shared    |      56 |
| Core      |      43 |
| Web       |     180 |
| Server    |      56 |
| **Total** | **335** |

Both the ordinary optimized application and dedicated optimized harness built
successfully. The ordinary build was rebuilt after the harness and a final
search proved it contained neither harness marker nor harness output directory.
`git diff --check` passed.

The first final-validation attempt stopped on Prettier for this evidence record
and the in-scope pnpm patch configuration; both received only mechanical
formatting. The next attempt exposed 7C-QA-5. The final complete command reran
from the beginning and passed.

Known output is limited to happy-dom's existing `Window scrollTo not
implemented` diagnostic during tests, the existing development Vue feature-flag
warning, and Vite's existing non-blocking chunk-size warning. No lint rule,
configuration, ignore pattern, or validation boundary was weakened.

## Cleanup Ledger

| Owned resource                                        | Cleanup action                                                       | Current result                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| Named Playwright sessions for this run                | Close each owned session and delete its session data                 | Complete; final list showed no browsers         |
| Cell-owned Fastify and Vite/preview processes         | Graceful stop                                                        | Complete; all five QA ports are free            |
| `QA_ROOT` and all thirteen disposable clusters        | Delete exact owned root after this durable record exists             | Complete                                        |
| `ARTIFACT_ROOT`                                       | Delete exact owned artifact tree after this durable record exists    | Complete                                        |
| Four root `.playwright-cli` files created by this run | Delete exact timestamped files only; retain earlier shared artifacts | Complete; 32 earlier shared files remain intact |

No authenticated Chrome clone or Daniel-owned browser profile was used.

## Historical Completion Gate

- [x] Every selected browser-matrix and harness cell is `PASS`.
- [x] Every changed behavior and preservation guardrail has required evidence.
- [x] Every finding has an explicit disposition and no unresolved in-scope owner.
- [x] No blocked, omitted, or inconclusive result is counted as passing.
- [x] Final repository validation, both builds, and diff integrity pass.
- [x] Owned QA cleanup is complete and fixed ports are free.
- [x] The repository is clean on `main` and synchronized with `origin/main`.

Historical decision: **Passed for the selected original matrix**. The
post-completion adversarial review temporarily superseded that decision;
`7C-AR-1` now passes its correction boundary and proportional four-cell browser
verification, so the current Slice 7C decision is **PASS**.
