# StrictMode Lifecycle Conformance Foundation QA

## Status

Completed implementation evidence. The archived scope is
`docs/slices/archive/strictmode-lifecycle-conformance-foundation.md`.

Daniel resumed production implementation on 2026-07-14 with Milkdown kept in
its officially released, unmodified form. Azurite must release every resource it
owns and qualify successful public Milkdown lifecycle; terminal cleanup of
Milkdown's private partial resources after rejected creation is the sole
explicit upstream exclusion.

All destructive browser and persistence acceptance uses disposable clusters and
isolated browser storage. Daniel's note data is out of scope.

## Approved Baseline

Baseline commit: `de2b400edc6fac8937e36e767072f19f1956128a`.

The implementation began from a clean `main` whose `HEAD` and `origin/main`
both resolved to that commit on 2026-07-14.

### Passing Tests

Fresh baseline command:

```sh
/opt/homebrew/bin/pnpm -r test
```

| Workspace            | Test files |   Tests |
| -------------------- | ---------: | ------: |
| `packages/shared`    |          7 |      58 |
| `packages/core`      |          9 |      41 |
| `apps/web`           |         43 |     270 |
| `apps/server`        |         13 |      56 |
| **Repository total** |     **72** | **425** |

The existing web suite emitted its established jsdom `scrollTo` diagnostic and
the server suite emitted expected exercised-error logs; all tests passed.

### Relevant Physical Production Lines

This fixed baseline scope covers the current roots and the production files
that directly own route, editor, registration, or persistence lifecycle. Final
measurement will use the same scope plus any approved new production files.

| Production file                                             |     Lines |
| ----------------------------------------------------------- | --------: |
| `apps/web/src/main.tsx`                                     |        22 |
| `apps/web/src/qa/route-transition-main.tsx`                 |        38 |
| `apps/web/src/qa/markdown-fidelity-main.tsx`                |        25 |
| `apps/web/src/app-router.tsx`                               |       193 |
| `apps/web/src/routing/route-transition-owner.ts`            |       350 |
| `apps/web/src/routing/route-owner-disposal.ts`              |        83 |
| `apps/web/src/routing/route-transition-runtime.ts`          |       117 |
| `apps/web/src/components/use-milkdown-editor-controller.ts` |       235 |
| `apps/web/src/components/markdown-authority-controller.ts`  |       391 |
| `apps/web/src/components/markdown-authority-state-owner.ts` |        64 |
| `apps/web/src/components/crepe-runtime.ts`                  |        49 |
| `apps/web/src/components/editor-session-gate.ts`            |       367 |
| `apps/web/src/use-note-browser.ts`                          |       156 |
| `apps/web/src/persistence/draft-persistence-coordinator.ts` |       388 |
| `apps/web/src/persistence/draft-database.ts`                |       383 |
| **Total**                                                   | **2,861** |

Line movement or a lower total is not simplification evidence by itself.

### Authority Owners

Authority is counted by product responsibility, not by object or file count.

| Responsibility                             | Baseline owner                                             | Boundary                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Canonical saved Markdown                   | Workspace filesystem through the revision-aware server API | Durable user-owned truth.                                                                |
| Validated selection and history transition | `RouteTransitionOwner`                                     | URL target, action, admission, cancellation, restoration, and exact occurrence.          |
| Accepted live note session                 | Zustand note-browser store                                 | Selected note, accepted Markdown, revision, mode, dirty/save/conflict/disposition state. |
| Active editor projection and checkpoint    | `MarkdownAuthorityController`                              | Synchronous source/WYSIWYG projection adapter; not durable storage.                      |
| Transition freeze and editor capability    | `EditorSessionGateRuntime`                                 | Capability registration and leases; not content authority.                               |
| Ordered draft obligations                  | Draft persistence coordinator                              | Pending snapshots, sequencing, settlement, and cleanup obligations.                      |
| Durable browser recovery                   | Dexie draft database                                       | Persisted recovery records and future-schema protection.                                 |

The route `renderedOwnerKey` is an opaque identity, not another content owner.
Crepe is a disposable WYSIWYG projection runtime, not accepted product state.
The lifecycle defect is duplicated terminal/session responsibility between the
replay-stable Markdown controller and disposable Crepe effect generations, not
the legitimate coexistence of Zustand and Dexie.

### Known Lifecycle Resources

These Phase A probes characterize the approved failure before repairs:

| Checkpoint                                                 | `beforeunload` |                               `popstate` | Crepe creates | Crepe destroys | Controller ready        |
| ---------------------------------------------------------- | -------------: | ---------------------------------------: | ------------: | -------------: | ----------------------- |
| After StrictMode initializer/effect replay                 |              2 | 4 before retained-owner cleanup; 3 after |             2 |              1 | `false`                 |
| After final unmount of retained tree                       |              2 |                                        3 |             2 |              2 | controller unregistered |
| After manual cleanup of abandoned owner and both histories |              0 |                                        0 |           n/a |            n/a | n/a                     |

- Router effect cleanup is terminal and idempotent for the retained owner, so
  final unmount does not reduce the already leaked history resources.
- The current router path never calls the installed browser history's
  `destroy()` method.
- Editor gate registration itself balanced at two registrations and two
  unregistrations by final unmount, but the retained controller stayed
  permanently non-ready after diagnostic replay.
- Current tests do not globally enable StrictMode and do not expose exact
  settled/final counts for gate, executor, page lifecycle, store subscriptions,
  draft timers, or pending persistence obligations. Those are implementation
  proof requirements, not assumed-zero baseline facts.

## Implementation Evidence

### Architecture Delivered

- The product, route-QA, and Markdown-QA entries wrap their full trees in
  StrictMode. `apps/web/vitest.config.ts` merges the product Vite configuration
  with a shared Testing Library setup that enables `reactStrictMode` by default.
- `AzuriteRouterProvider` creates only an inert publication during render. A
  committed effect owns each browser-history/router/route-owner generation,
  identity-retires it before cleanup, destroys the matching TanStack history,
  and publishes only the retained generation.
- The Markdown authority controller remains replay-stable session authority.
  `CrepeGenerationLifecycle` owns serial disposable generations, unique hosts,
  current-generation callbacks, creation outcomes, and public destruction.
  Retired async completions cannot publish or affect a successor.
- Gate, store-executor, page lifecycle, store, and gate subscriptions are
  identity-balanced. Final root cleanup uses the existing draft coordinator
  with a typed `unmount` cause, clears the debounce timer synchronously, and
  settles the accepted recovery obligation without inventing another owner.
- No dependency, state owner, storage boundary, QA app, build entry, private
  Milkdown access, or Milkdown patch was added. Slice 7E behavior is absent.

The first red characterizations were converted into direct passing contracts;
no existing test was skipped, relaxed, broadly mocked, or deleted to obtain the
result.

### Resource Ledger

| Resource or boundary               | StrictMode settled                                 | Final unmount                                     |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Router render-only pass            | 0 listeners, histories, owners, or native wrappers | unchanged                                         |
| TanStack `beforeunload` listeners  | 2 created, 1 destroyed, 1 live                     | 2 created, 2 destroyed, 0 live                    |
| TanStack `popstate` listeners      | 4 created, 2 destroyed, 2 live                     | 4 created, 4 destroyed, 0 live                    |
| Native history method wrappers     | retained generation installed                      | original methods restored                         |
| Successful Crepe generations       | 2 created, 1 destroyed, 1 live and ready           | 2 created, 2 destroyed, 0 live                    |
| StrictMode remount sequence        | 4 created, 3 destroyed, 1 live and ready           | 4 created, 4 destroyed, 0 live                    |
| Gate and store-executor registry   | 2 setup, 1 cleanup, 1 live each                    | 2 setup, 2 cleanup, 0 live                        |
| Page lifecycle listeners           | 2 setup, 1 cleanup, 1 live per event               | 2 setup, 2 cleanup, 0 live                        |
| Gate and Zustand subscriptions     | 2 setup, first cleanup observed, 1 live each       | second cleanup observed, 0 live                   |
| Concurrent lifecycle draft flushes | 2 callers, 1 receipt, 1 write, 1 settlement        | 0 timers, pending snapshots, or active keys       |
| Dirty draft final-unmount flush    | 1 scheduled timer                                  | timer synchronously 0; 1 exact write; 0 remaining |

Two `popstate` listeners are the intended count for one installed TanStack
history generation. The rejected-create Milkdown qualification below is not
misreported as an Azurite-owned live generation.

### Duplicate-Action And Stale-Generation Proof

| Action or failure seam                          | Exact result                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Discarded route generation                      | 0 store applies and 0 navigations                                                               |
| Retained initial route generation               | 1 initial apply and 0 navigation                                                                |
| Successful Crepe replay                         | 1 ready retained generation; each successful retired generation destroyed once                  |
| Stale editor callback/completion                | 0 publications, mode changes, readiness changes, or successor destruction                       |
| Factory/create/rejected-create failure          | original failure; 0 destroys; 0 publications; 1 source fallback mode change; disconnected hosts |
| First accepted source edit after create failure | exactly 1 publication with exact Markdown                                                       |
| `visibilitychange` and `pagehide`               | exactly 1 commit each; post-unmount dispatch adds 0                                             |
| Repeated draft lifecycle flush                  | 2 callers produce exactly 1 draft write and 1 settlement                                        |
| Browser route cancellation/continuation         | cancel produces 0 target reads; continue produces exactly 1 target read and 1 settlement        |
| Accepted optimized manual Save                  | 1 click, 1 PUT, HTTP 200, 1 filesystem value, exact Markdown, and `Saved`                       |

Pending successful creation waits for predecessor destruction. Pending
rejection starts the successor without calling the unsupported Milkdown destroy
path. Final unmount during either pending outcome starts no successor, detaches
the old host, and permits no stale publication.

### Installed Milkdown Failure Contract

Before production edits, a direct installed-version probe forced Milkdown
7.21.2 configuration to reject during `Editor.create()`. The editor remained in
public status `OnCreate`. Calling the public `destroy()` scheduled another
50-millisecond retry every time the controlled callback ran; three manual turns
reported one replacement timer each: `{"status":"OnCreate","scheduled":[1,1,1,1]}`.

`apps/web/test/milkdown-installed-lifecycle.test.ts` preserves this evidence
under fake timers without leaking a real timer from the test. The installed
implementation has no public transition out of failed `OnCreate`; its cleanup
logic and status mutation are private.

Azurite currently installs 7.21.2. The latest official release is 7.21.3,
published on 2026-07-12; its released core source retains the same
`OnCreate`/rescheduled-destroy implementation. No released version therefore
demonstrates terminal rejected-create cleanup as of 2026-07-14.

Milkdown will remain officially released and unmodified. The characterization
test stays as truthful upstream qualification evidence. Azurite's rejected-
creation proof instead requires the original failure, retired generation, stale
callback rejection, exact Markdown, usable source fallback, no duplicate
product action, and zero Azurite-owned resources. It does not claim terminal
cleanup of Milkdown's private partial resources or internal retry timer.

## Browser Acceptance

The Codex Playwright skill exercised twelve isolated cells: product, route-QA,
and Markdown-QA roots on desktop and Pixel 6 in both Vite development and
optimized-production builds. Each build used a disposable filesystem cluster;
each browser session used isolated storage. Sentry was disabled.

| Root and viewport   | Development result                                                                                                | Optimized-production result                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Product desktop     | startup, exact source edit, 1 Save/PUT, WYSIWYG, sidebar, Back, and Forward; each requested note read once        | WYSIWYG startup, exact source Save, sidebar, Back, and Forward; accepted repeat proved 1 PUT/200 and exact disk bytes |
| Product Pixel 6     | 412 x 839, touch, 0 overflow; exact source draft survived reload, recovered once, and Discard restored exact disk | same geometry; exact draft recovered after reload, then Discard restored the unchanged disk value                     |
| Route QA desktop    | held transition retained URL/article; Cancel settled once and issued 0 target reads                               | same result: held settlement 0, Cancel settlement 1, 0 target reads                                                   |
| Route QA Pixel 6    | 412 x 839, touch, 0 overflow; Continue settled once and issued exactly 1 target read                              | same result with exactly 1 `index.md` read                                                                            |
| Markdown QA desktop | pending exact source, successful ready generation, reset/remount to generation 2, publications remained 0         | ready WYSIWYG selected through the production adapter; reset/remount reached generation 2 ready with 0 publications   |
| Markdown QA Pixel 6 | rejected creation retained exact source, disabled WYSIWYG, then one source edit produced exactly 1 publication    | same rejected-create fallback; exact source edit, generation 1, publications 1, touch and 0 overflow                  |

Every accepted API response was 200. Accepted development cells had zero page
console errors; the product and route-QA dev entries emitted only their existing
Vite Vue feature-flag warning. Optimized cells had zero page console errors and
zero warnings. No unhandled rejection, stale callback, duplicate request,
changed history occurrence, changed recovery outcome, or unexplained network
failure remained.

One exploratory optimized browser-CLI session disconnected after its filesystem
write and was excluded from acceptance. A fresh isolated repeat qualified the
save with one observed PUT, HTTP 200 in both browser and backend, `Saved`, and an
84-byte exact disk value. Dialog and locator bookkeeping mistakes in discarded
CLI commands likewise supplied no acceptance evidence and caused no product or
network error.

## Final Measurements

### Physical Production Lines

The fixed baseline scope plus the new approved lifecycle file measures:

| Responsibility scope                      |  Baseline |     Final |    Delta |
| ----------------------------------------- | --------: | --------: | -------: |
| Product and two QA React roots            |        85 |        94 |       +9 |
| Router provider, owner, disposal, runtime |       743 |       808 |      +65 |
| Editor authority, gate, runtime lifecycle |     1,106 |     1,356 |     +250 |
| Note-browser and draft persistence        |       927 |       928 |       +1 |
| **Total**                                 | **2,861** | **3,186** | **+325** |

This is not a physical-code simplification. The former hook shrank by 39 lines,
but the explicit Crepe-generation lifecycle adds 287 lines and router committed
publication adds 65. The useful simplification is ownership: React cleanup no
longer terminally destroys replay-stable Markdown session authority, and a
retired route or Crepe generation can release only its own resources.

### Ownership And Vocabulary

- Product authority owners remain **7 -> 7**: filesystem, route owner, Zustand,
  Markdown authority, editor gate, draft coordinator, and Dexie retain their
  distinct responsibilities.
- One new lifecycle-only coordinator owns disposable Crepe generations; it owns
  no accepted Markdown, durable state, route intent, or storage.
- Existing public product result statuses and reasons are unchanged. One
  semantic cause, `unmount`, was added consistently to commit, publication, and
  durability cause unions so final cleanup is truthful rather than disguised as
  `pagehide`.
- Four internal generation terminal outcomes—`creation_failed`, `released`,
  `skipped`, and `teardown_failed`—make adapter sequencing exhaustive. They add
  no user-state branch or Slice 7E vocabulary.

## Automated And Repository Verification

Final `/opt/homebrew/bin/pnpm validate` passed formatting, governance, the
400-line code limit, lint, script/workspace typechecks, and all tests:

| Workspace            | Test files |   Tests |
| -------------------- | ---------: | ------: |
| `packages/shared`    |          7 |      58 |
| `packages/core`      |          9 |      41 |
| `apps/web`           |         46 |     291 |
| `apps/server`        |         13 |      56 |
| **Repository total** |     **75** | **446** |

Focused router lifecycle and ownership runs passed 26 tests; the broader route
regression set passed 74. The bounded adversarial recheck passed its three
focused files and 29 tests after both findings were repaired. Editor,
installed-Milkdown characterization, StrictMode default, gate, store,
persistence, draft recovery, conflict, save-session, page lifecycle, and final
unmount tests all remain in the 291-test web suite. The final combined lifecycle
and preservation selection passed 18 files and 135 tests.

The ordinary optimized product build, both existing QA builds, and the product-
bundle exclusion check passed; 197 ordinary product files contained no Markdown
QA entry, marker, or fault controls. The established large-chunk warning remains
diagnostic only. `git diff --check` passed. Slice 7E remains planned and its
production behavior is unimplemented.
