# Post-StrictMode Store Workflow Boundaries QA

## Outcome

Task 3D implementation passed on 2026-07-14. The distributed 26-member
`StoreContext` and its late-filled runtime are gone. Route execution remains a
six-operation cross-layer seam constructed directly over private store-side
route state; Save single-flight is private to Save; snapshot and session
identities are allocated by their consuming workflows; and both recovery
surfaces use one current-draft Discard command. Zustand remains accepted live
product truth and exposes only the six product/gate commands.

The immutable architecture and measurement baseline is
`8a37b3dbff19b24d70af82bd5560723fd4b52e46`. A later policy-only `agents.md`
commit advanced operational `main`, so the Task 3D Git start is
`7c228c2254568b03f27fafe3c21f5603c131c1d5`. The completed code implementation
range is `7c228c2..9a5f703`; repository policy synchronized intermediate
integrated writes as `chore: sync Azurite` commits without changing the
approved scope or baseline.

## Delivered Boundaries

- `NoteBrowserStore` exposes `discardCurrentDraft`, `flushPendingDraft`,
  `publishMarkdownChange`, `retryDraftPersistenceIssue`, `saveSelectedNote`,
  and `updateEditorMode` only.
- `NoteBrowserStoreApi.routeExecutor` carries exactly
  `activateRouteIntent`, `applyRoute`, `ensureNotes`, `getCoherentView`,
  `getRenderedOwnerKey`, and `reportHistoryUnavailable`. The operations execute
  directly against one private route runtime and are not Zustand actions.
- The route workflow privately owns active list/read requests, intent identity,
  request sequences, editor-session allocation, coalescing, and rollback.
- The editor/draft workflow privately owns snapshot allocation. The Save action
  factory owns its per-note `Map<string, Promise<void>>` and releases only the
  matching promise in `finally`.
- One terminal current-draft Discard workflow serves existing-note recovery and
  missing-note recovery without changing either surface's confirmation,
  restoration, failure, or retry behavior.

No dependency, framework, storage boundary, schema, state authority,
instrumentation, QA application, build entry, or product behavior was added.
The two new production files are narrow private workflow state:
`note-browser-route-runtime.ts` has seven route-only fields and
`note-browser-draft-runtime.ts` supplies three exact draft dependencies plus the
snapshot allocator. Neither is a universal service, engine, dependency
container, or renamed context.

## Measurements And Deletions

All figures are physical lines measured with `wc -l`; searches use `rg` or
`git grep` against the immutable baseline.

| Measure                                       |           Before |            After | Delta |
| --------------------------------------------- | ---------------: | ---------------: | ----: |
| `StoreContext` members                        |               26 |                0 |   -26 |
| Production consumers                          |               20 |                0 |   -20 |
| Production textual occurrences                |              144 |                0 |  -144 |
| Original 20-file physical envelope            | 4,048 / 20 files | 3,935 / 20 files |  -113 |
| Full `apps/web/src/state` envelope            | 4,868 / 29 files | 4,945 / 29 files |   +77 |
| Public Zustand actions                        |               13 |                6 |    -7 |
| Route operations represented as store actions |                6 |                0 |    -6 |
| `RouteStoreExecutor` operations               |                6 |                6 |     0 |
| Public Save-map accessors                     |                3 |                0 |    -3 |
| Public Discard commands                       |                2 |                1 |    -1 |
| `NoteBrowserRuntime` fields                   |               14 |                0 |   -14 |
| Late-filled universal context layers          |                1 |                0 |    -1 |
| Dead capabilities                             |                2 |                0 |    -2 |
| Route-executor forwarding copies              |                1 |                0 |    -1 |
| Legitimate product authorities                |                7 |                7 |     0 |

The full state folder rises by 77 lines because explicit route-only runtime,
draft-only allocation, and extracted evidence keep responsibilities and every
code file within 400 lines. The acceptance envelope is the identical 20 former
context-consumer files, which falls by 113 lines. Searches return zero
`StoreContext`, old Save accessor, old Discard command, `configureContext`,
`createRouteRollbackContext`, late cast, or `setCurrentRouteIntent`
occurrences in production.

Reproduction commands:

```sh
git show 8a37b3d:apps/web/src/state/note-browser-contracts.ts \
  | sed -n '/export type StoreContext = {/,/^};/p' | rg -c '^  readonly '
git grep -l StoreContext 8a37b3d -- apps/web/src
git grep -o StoreContext 8a37b3d -- apps/web/src | wc -l
git grep -l StoreContext 8a37b3d -- apps/web/src | cut -d: -f2- \
  | while read -r file; do git show 8a37b3d:"$file" | wc -l; done \
  | awk '{ total += $1 } END { print total }'
rg --files apps/web/src/state -g '*.ts' | xargs wc -l
rg -o 'StoreContext|getActiveNoteSave|setActiveNoteSave|clearActiveNoteSave' \
  apps/web/src -g '*.ts' -g '*.tsx'
sed -n '/export type NoteBrowserStore =/,/^};/p' \
  apps/web/src/state/note-browser-contracts.ts | rg -c '^  readonly '
sed -n '/export type RouteStoreExecutor = {/,/^};/p' \
  apps/web/src/routing/route-store-executor.ts | rg -c '^  readonly '
```

Deleted files:

- `apps/web/src/state/baseline-route-draft-gate.ts`;
- `apps/web/test/baseline-route-draft-gate.test.ts`;
- `apps/web/src/state/note-browser-actions.ts`.

Deleted symbols and layers include `StoreContext`, `NoteBrowserRuntime`,
`NoteBrowserRuntime.context`, the `{ } as StoreContext` construction,
`configureContext`, `createRouteRollbackContext`, `setCurrentRouteIntent`,
the forwarding `createNoteBrowserRouteExecutor`, the public active-Save
get/set/clear protocol, the second public Discard alias, and redundant
`draftPersistence` runtime/context state. Production had no importer of the
baseline gate; the real editor gate already blocks on failed durability and now
has a direct failed-flush/retry regression test.

## Retained Authorities And Guarantees

The seven authorities remain unchanged:

| Authority                      | Retained owner                                            |
| ------------------------------ | --------------------------------------------------------- |
| Canonical saved Markdown       | Workspace filesystem/server API                           |
| Route selection and history    | `RouteTransitionOwner`                                    |
| Accepted live editor session   | Zustand                                                   |
| Projection and checkpoint      | `MarkdownAuthorityController`                             |
| Freeze and destructive handoff | `EditorSessionGateRuntime`                                |
| Ordered draft obligations      | `DraftPersistenceCoordinator` over `KeyedTaskCoordinator` |
| Durable browser recovery       | Dexie                                                     |

Automated and browser proof retained exact Markdown spelling and accepted
authority, source/WYSIWYG switching, WYSIWYG Undo, honest dirty state, Save
success/conflict/session ownership/conditional cleanup, same-note ordering,
different-note independence, rejected-tail release, durable recovery and retry,
future-schema protection, dirty-recovery exclusion, terminal closed-epoch
Discard, route-gate blocking, startup/sidebar/history coherence, predecessor
restoration, stale-result rejection, and StrictMode cleanup without duplicate
product operations.

Task 3C's accepted decisions remain unchanged: ordered reads are
`absent/current/protected/failed`; mutations are
`cleared/unchanged/protected/failed`; handoff is `continue/block`; recovery and
Discard return `Promise<void>`; the one ordinary retry command remains
issue-selected; and `DraftPersistenceIssue` remains detailed visible evidence.

On 2026-07-15 local time (2026-07-14 UTC), one bounded Sentry-enabled
optimized-production Pixel 6 preservation cell also passed. It changed no
production code and introduced no telemetry. The cell starts from clean,
synchronized `ee10775d366de8ca43cc81431b6b66b0e591baf9`; the evidence-only
correction from that commit is the sole reopened-session delta.

## Automated Verification

The focused production-path proof passed **15 files / 116 tests** (baseline
**15 / 115**) across store, hardening, route predicates/races, all four route
owner suites, app router, Save-session ownership, concurrency, recovery,
Discard, editor gate, and lifecycle evidence.

The web suite passed **48 files / 309 tests** (baseline **49 / 311**). The
obsolete three-test baseline-gate file was removed and one stronger real-gate
test was added, hence one fewer file and two fewer tests. Repository validation
passed **77 files / 464 tests**. The approved baseline's test total of 466 was
correct, but its **65 files** was stale arithmetic: direct baseline execution
proved **78 files / 466 tests** because the earlier count omitted 13 server test
files.

Commands passed:

```sh
/opt/homebrew/bin/pnpm --filter @azurite/web exec vitest run \
  test/note-browser-store.test.ts \
  test/note-browser-store-hardening.test.ts \
  test/note-browser-route-predicates.test.ts \
  test/note-browser-route-races.test.ts \
  test/route-transition-owner.application.test.ts \
  test/route-transition-owner.cancellation.test.ts \
  test/route-transition-owner.outcomes.test.ts \
  test/route-transition-owner.lifecycle.test.ts \
  test/app-router.test.ts \
  test/note-browser-save-session-ownership.test.ts \
  test/note-browser-concurrency.test.ts \
  test/note-browser-recovery-workflows.test.ts \
  test/note-browser-discard-actions.test.ts \
  test/editor-session-gate.test.ts \
  test/note-browser-lifecycle-evidence.test.ts
/opt/homebrew/bin/pnpm --filter @azurite/web test
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

Formatting, governance, TypeScript, lint, build, and the hard 400-line code-file
limit all passed.

## Browser Acceptance

The Codex Playwright CLI ran four original isolated cells against real Fastify
and Vite or optimized-preview paths, then one additional Sentry-enabled
optimized-production Pixel 6 preservation cell. Every cell used a disposable
cluster.

| Cell                         | Result                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development desktop          | Startup, sidebar, Back/Forward, exact source edit, durable reload recovery, WYSIWYG edit and Undo, Save plus zero-record cleanup, existing and missing-note Discard, external-disk conflict and restoration passed. |
| Development Pixel 6          | Startup, touch sidebar, Back/Forward, exact source edit, durable reload recovery, Save and cleanup passed; 412/412 document width had no horizontal overflow.                                                       |
| Optimized-production desktop | Startup, sidebar, Back/Forward, exact source edit, durable reload recovery, Save and cleanup passed with zero console warnings or errors.                                                                           |
| Optimized-production Pixel 6 | Startup, touch sidebar, Back/Forward, source/WYSIWYG switching, exact edit, durable reload recovery, Save and cleanup passed; 412/412 width had no overflow and console was clean.                                  |
| Optimized Pixel 6 + Sentry   | The cumulative workflow, correlation, browser/server SDK, Logs, Trace Explorer, Replay, expected-conflict, and cleanup proof below passed without changing product results or request ownership.                    |

All phone cells used the Playwright `Pixel 6` descriptor. The original matrix
recorded its 412 × 839 CSS viewport; the Sentry-enabled cell additionally
recorded its 412 × 915 CSS screen, 2.625 device-pixel ratio, one touch point,
and 412/412 document width. In the original cells each Save produced one PUT;
expected navigation and reload produced one current read per transition. No
unexpected browser error, duplicate write/action, incoherent sidebar/history
state, or leaked lifecycle resource appeared. Development emitted only the
existing Vue esm-bundler feature-flag warning.

All Playwright sessions, profiles/artifacts, five temporary clusters, browser
draft records, ports 3000/4173/5173, and server/Vite runtimes were removed.

## Sentry-Enabled Preservation Proof

### Mode, identity, and first-attempt result

The additional cell used the ignored root `.env.local` without displaying its
contents. A boolean-only preflight proved the real web and server Sentry modes,
DSNs, full tracing, and full Replay sampling were enabled. Vite built with that
enabled configuration present and with this unique non-secret identity:

- QA run: `task3d-sentry-preservation-20260714T231041Z-ee10775`;
- release: `azurite-task3d-sentry-preservation-20260714T231041Z-ee10775`;
- environment: `local-debug`;
- cluster: `1bcfcd66-7ec3-4a17-8310-33f58a521e65`.

The optimized build and every first actual product submission passed. The
Playwright wrapper needed bounded, non-product corrections: an already-handled
confirm callback, one pre-request ambiguous Save locator, an IndexedDB probe
moved into `page.evaluate`, an exact Replay Play locator, and Sentry Logs'
canonical `logsQuery` parameter. None repeated a product submission or created
an extra request. No Task 3D regression appeared, so production code and the
four Sentry-disabled acceptance cells remained unchanged.

The cell ran in actual Chrome **150.0.7871.116**. Its exact emulated Android
Chrome user agent was
`Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.10 Mobile Safari/537.36`;
Sentry consequently identified it as Chrome Mobile 151.0.7922 on Android 12.
The emulated screen was **412 × 915 CSS pixels**.
`matchMedia("(pointer: coarse)").matches` was `true`,
`matchMedia("(hover: none)").matches` was `true`, `maxTouchPoints` was one,
and the device-pixel ratio was 2.625.

The exact successful Playwright `tap()` interactions were:

- `page.getByRole("button", {name: /Task 3D Sentry Route 231041Z/}).tap()`;
- `page.getByRole("button", {name: "Markdown"}).tap()` three times, before
  existing-note recovery, Save, and missing-note recovery;
- `page.getByRole("button", {name: "Discard draft and reload disk version"}).tap()`;
- `page.getByRole("textbox").tap()` before WYSIWYG typing and Undo;
- `page.getByRole("button", {name: "Save"}).tap()` for the successful Save;
- `page.locator("article").getByRole("button", {name: "Save", exact: true}).tap()`
  for the expected-conflict submission;
- `page.getByRole("button", {name: /Task 3D Sentry Initial 231041Z/}).tap()`;
- `page.getByRole("button", {name: /Task 3D Cluster Sentinel 231041Z/}).tap()`.

Back and Forward used Playwright navigation commands. The conflict-restoration
and missing-note Discard confirmations used `click()` plus dialog acceptance.
The ambiguous pre-request Save locator performed no interaction and emitted no
request.

### Product preservation

The fresh three-note fixture used unique markers ending in `231041Z`. Startup
selected the initial note; touch sidebar selection and Back/Forward preserved
the note, URL, sidebar, and history. Source editing, reload recovery, WYSIWYG
editing, and macOS `Meta+z` Undo preserved exact Markdown and accepted editor
authority.

The existing-note Discard restored the original route-note marker. The
successful Save then wrote exact Markdown hash
`sha256:95b6dcfc120c5c96987bd7fd8243c9ca4f1a8af161b9b0231f221a03e38e9bf2`
and reduced the Dexie `drafts` count to zero. After a browser conflict marker
was durable, an external disk edit caused the first actual Save submission to
return the expected `409`; the browser intent remained visible, Save became
disabled, and the draft count remained one. Discard restored only the external
disk value, whose final hash was
`sha256:688b23527543c892f25a78ff201564cad2cb51198603e5be9d26004b8dd41db2`.

For the missing-note path, Azurite recovered the durable browser draft after
the disposable file was removed, then the same public Discard command produced
`Note not found` and zero durable drafts. The untouched sentinel stayed at
`sha256:41dd9b9af83ef4798c15c754cbf964e953a8a5b0ed865db6359ac61fa967a3a6`.
The final touch route was coherent, `maxTouchPoints` was one, and 412 CSS pixels
of viewport equalled 412 pixels of document width.

The browser made exactly **16** product API requests: four list GETs, ten read
GETs, one successful Save PUT, and one expected-conflict PUT. All **56 / 56**
browser Sentry envelope requests returned success. The product console had one
line only: the expected failed-resource line for the `409`. There was no
duplicate Save, read/write action, routing transition, cleanup, or unexpected
browser error.

### Correlation, SDKs, traces, and Replay

Every sampled proxied request carried both `sentry-trace` and `baggage`. The
list request correctly carried no note-operation ID; reads and Saves carried
the matching immutable request and note-operation pair:

| Workflow                | Request ID                             | Note-operation ID                      | Trace ID                           | Result |
| ----------------------- | -------------------------------------- | -------------------------------------- | ---------------------------------- | ------ |
| Initial list            | `9f8992bc-06a6-48cb-839c-4a46789e8c3d` | none                                   | `e6812e9968284636aec546a047477907` | `200`  |
| Initial read            | `fe124686-0a45-4edc-97c5-358ed2b523b0` | `9803f063-c307-4928-97d1-f1b6606f3ac8` | `e6812e9968284636aec546a047477907` | `200`  |
| Successful Save         | `b5284690-b1bc-418e-8bb2-85ed5b49f35e` | `4164a943-8580-46c3-80b5-7c6556564cf8` | `fcd9556c5f694413bda84c3eb190dd4d` | `200`  |
| Expected conflict       | `f0cfdc77-435b-4441-92fd-60b18d1a75c1` | `c591f741-d351-4d27-9e3a-0d994acad323` | `fcd9556c5f694413bda84c3eb190dd4d` | `409`  |
| Conflict Discard reload | `a3531748-320a-4e7b-8695-77b28f189ffa` | `d0873458-9af8-4f1d-8b2e-e22d40911687` | `fcd9556c5f694413bda84c3eb190dd4d` | `200`  |
| Final sentinel read     | `445fc74e-1ca6-4e04-a899-596b7a1a77ea` | `b5643b07-2422-42c5-a013-b1e3a0f23d07` | `775d2874c31544429303b2b59ab7d4ec` | `200`  |

Authenticated Sentry visibly identified the real SDKs as
`sentry.javascript.react` **10.64.0** and `sentry.javascript.node` **10.64.0**.
Server `telemetry.runtime.trace_headers.seen` evidence accompanied the sampled
list, read, and Save routes, proving both trace headers reached Fastify through
the Vite proxy.
The exact list request returned six joined browser/API/server list lifecycle
logs. Querying both identifiers for the sampled read returned six joined
`note.load`, `api.request`, and server `note.read` logs; the Save pair likewise
returned six joined browser/API/server `note.save` logs.

Trace Explorer trace `fcd9556c5f694413bda84c3eb190dd4d` reports one Replay,
zero issues, 54 spans, and 37 logs on Chrome Mobile / Android 12. Its waterfall
and Logs tab join natural `notes.list`, `note.route`, `note.load`, `note.save`,
`api.request`, Fastify HTTP, and `azurite.server.route` work. A direct
server-route query returned exactly two `note.save` spans: successful span
`9cff537a1aaa0ec5` and expected-conflict span `9b5ae2372ec845e5`.
Non-secret transaction event IDs were:

- browser pageload `770afe5e1f7c44c788ce68764e7e0dd5`;
- server list route `9f366a7d4f4b4d35849115e47861f1cb`;
- server successful Save `ea620eafac9e45ee9e08994b8232bb0c`;
- server conflict `ca67ac8a5a424618aaf2b194036473ab`.

The release-filtered Logs surface returned 126 matching logs. Filtering
`azurite.route_source:draft_discard_reload` returned exactly six entries: two
natural sequences of `note.route.navigation_requested`, `note.load.started`,
and `note.load.succeeded`, covering the existing-note Discard and the later
conflict restoration.

Replay `b98db5961c734cc4b8e40af24b06dd85` reported zero Replay errors,
dead clicks, and rage clicks. The rendered Pixel 6 recording visibly contained
`TASK3D_SENTRY_INITIAL_231041Z`, `TASK3D_SENTRY_SAVE_231041Z`, and the full
unmasked `Replay proof: disposable Azurite Task 3D preservation content
231041Z.` text. Its activity recognized the navigation and expected failed
Save. Both the trace's issue count and the release-filtered Issues feed were
zero (`No issues match your search`), so the expected conflict created no
unexpected issue.

### Cleanup and security ledger

The exact owned cleanup allowlist was:

| Resource                         | Exact identity                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Product Playwright session       | `task3d-sentry-preservation-20260714T231041Z-ee10775-optimized-pixel6-sentry-enabled`                                                      |
| Authenticated inspection session | `task3d-sentry-preservation-20260714T231041Z-ee10775-sentry-inspection`                                                                    |
| Complete Chrome clone            | `/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T/azurite-task3d-sentry-preservation-20260714T231041Z-ee10775.4E3ExL/chrome-profile-clone` |
| Disposable cluster               | `/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T/azurite-task3d-sentry-preservation-20260714T231041Z-ee10775.4E3ExL/cluster`              |
| Fastify runtime                  | PID 26512 at `127.0.0.1:3000`                                                                                                              |
| Optimized-preview runtime        | PID 26607 at `http://127.0.0.1:4173`                                                                                                       |
| Owned QA root                    | `/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T/azurite-task3d-sentry-preservation-20260714T231041Z-ee10775.4E3ExL`                      |
| Owned artifact root              | `/Users/danielmulec/Projekte/azurite/output/playwright/task3d-sentry-preservation-20260714T231041Z-ee10775`                                |

The authorized Chrome source remained running and untouched. A whole-profile
metadata-preserving `ditto` clone omitted only `SingletonLock`,
`SingletonCookie`, and `SingletonSocket`. A second reconciliation pass, needed
because the live source changed by 8,950 bytes during the first copy, matched
source and clone exactly at **33,483 files**, **2,911 directories**, and
**4,158,825,938 logical bytes**, with empty copy diagnostics and no further
exclusion. Ordinary Chrome used only that clone, rooted at PID 34317 and local
CDP port 60813; Playwright attached read-only and detached before shutdown.

The clone, its entire process group, all clone logs, and authenticated
Playwright inspection artifacts were deleted immediately after inspection.
The allowlisted QA and artifact roots were then deleted in full, including the
cluster, raw network/header captures, and product trace. Owned browser PID
27445, server PID 26512, preview PID 26607, the product and inspection
Playwright sessions, and listeners on 3000/4173 were stopped. The ignored
`.env.local` remained unmodified. Final inspection found no browser session,
clone process, artifact, QA root, runtime, listener, branch, or additional
worktree. No DSN, token, cookie, authorization header, secret value, or
authenticated clone data was printed, committed, or retained.

## Independent Review And Delivery

The bounded read-only review of `8a37b3d..780271f` found zero code or
architecture blockers. It independently reran the focused proof at **15 files /
116 tests**, passed `git diff --check`, reproduced the structural measurements,
confirmed that the route and draft access types are narrow workflow boundaries,
and verified that Task 3E and Slice 7E were untouched.

The review raised one Task 3D documentation blocker: this section still
contained a placeholder instead of the actual review and delivery evidence.
This repair records the result and disposition; no implementation repair or
proportional code rerun was required beyond the already-passing final suite.

At implementation-review time, `HEAD`, `origin/main`, and `origin/HEAD` were
equal at `780271faf1e2e985436f2820268e3f9fa7992a57`; the root was clean and no
worker worktree or branch remained. This bounded preservation correction began
with the same three refs equal at
`ee10775d366de8ca43cc81431b6b66b0e591baf9`, a clean root, and one root
worktree. Delivery of the evidence-only correction rechecked clean equality of
`HEAD`, `origin/main`, and `origin/HEAD` after push with that sole root
worktree; the final report records the exact commit. This is
candidate-completion preservation evidence, not independent conformance
acceptance. Task 3E, Slice 7E, Slice 7F, Route Failure Resilience, performance
work, and unrelated product changes remain untouched and unapproved.

## Independent Conformance Acceptance

Independent conformance review session
`019f644f-d0f8-7973-b1af-946b7fec57b5` reviewed the final Task 3D candidate at
`1cbdbe3f598ae71dfac07e29e9b46ad91f1a46f0` against the approved architectural
baseline, operational implementation range, completion evidence, and preserved
product guarantees. It returned `ACCEPT` with zero mandatory corrections.

Daniel accepted Task 3D at that exact commit on 2026-07-15. Task 3D is complete;
Task 3E and Slice 7E remain separate, unapproved delivery checkpoints.
