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

The Codex Playwright CLI ran four isolated cells against real Fastify and Vite
or optimized-preview paths. Every cell used a disposable two-note cluster.

| Cell                         | Result                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development desktop          | Startup, sidebar, Back/Forward, exact source edit, durable reload recovery, WYSIWYG edit and Undo, Save plus zero-record cleanup, existing and missing-note Discard, external-disk conflict and restoration passed. |
| Development Pixel 6          | Startup, touch sidebar, Back/Forward, exact source edit, durable reload recovery, Save and cleanup passed; 412/412 document width had no horizontal overflow.                                                       |
| Optimized-production desktop | Startup, sidebar, Back/Forward, exact source edit, durable reload recovery, Save and cleanup passed with zero console warnings or errors.                                                                           |
| Optimized-production Pixel 6 | Startup, touch sidebar, Back/Forward, source/WYSIWYG switching, exact edit, durable reload recovery, Save and cleanup passed; 412/412 width had no overflow and console was clean.                                  |

Both phone cells used the Playwright `Pixel 6` descriptor: 412 × 839 CSS
viewport, 2.625 device-pixel ratio, and coarse pointer. Each save produced one
PUT; expected navigation and reload produced one current read per transition.
No unexpected browser error, duplicate write/action, incoherent sidebar/history
state, or leaked lifecycle resource appeared. Development emitted only the
existing Vue esm-bundler feature-flag warning.

All Playwright sessions, profiles/artifacts, four temporary clusters, browser
draft records, ports 3000/4173/5173, and server/Vite runtimes were removed.

## Independent Review And Delivery

The required bounded independent review is recorded after the final integrated
diff review. Task 3E, Slice 7E, Slice 7F, Route Failure Resilience, performance
work, and unrelated product changes remain untouched and unapproved.
