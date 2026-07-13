# Slice 7C URL Selection And History Coherence QA Evidence

## Status

- Completion decision: **Passed and complete on 2026-07-13**.
- QA date and timezone: 2026-07-13, Europe/Vienna.
- Browser-tested implementation commit:
  `250f14501caf34c7f7acb5974da1079dc6f64cc6`.
- Scope: validated route-intent ownership, exact browser-history cancellation,
  selected/rendered/committed-view coherence, route-or-reload authorization,
  target-free gate lifecycle, the acceptance-only fault harness, and preserved
  Slice 7B correlation/save/recovery guarantees.
- Authoritative contract:
  `docs/slices/archive/slice-7c-url-selection-and-history-coherence.md`.

This document is the authoritative completion evidence for Slice 7C. The
archived slice links here instead of duplicating the result matrix.

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

No unresolved product, harness, architecture, security, data-integrity, or
regression finding remains. No finding introduced a separate product
capability or storage owner, so the working agreement's scope re-selection rule
did not require another slice.

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

## Completion Gate

- [x] Every selected browser-matrix and harness cell is `PASS`.
- [x] Every changed behavior and preservation guardrail has required evidence.
- [x] Every finding has an explicit disposition and no unresolved in-scope owner.
- [x] No blocked, omitted, or inconclusive result is counted as passing.
- [x] Final repository validation, both builds, and diff integrity pass.
- [x] Owned QA cleanup is complete and fixed ports are free.
- [x] The repository is clean on `main` and synchronized with `origin/main`.

Final decision: **Passed**.
