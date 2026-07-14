# Post-StrictMode Editor-Session Authority QA

## Outcome

Task 3B passed on 2026-07-14. Zustand is the sole accepted live editor truth;
the Markdown controller retains only projection/checkpoint adapter state, and
`EditorSessionGateRuntime` is the sole freeze/lease authority. Tasks 3C–3E and
Slice 7E were not changed or started.

The kickoff baseline was clean `main` at
`9bb787889ad6cad4e4d55ae02ed7c0397dce494f`, synchronized with `origin/main`
and `origin/HEAD`. The requested 4,274-line envelope and every structural count
were reproduced. One Task 3A prose count was corrected: direct inspection of
the TypeScript contract found 14 top-level `EditorSession` fields, not 15. The
repository had not advanced; the other baseline measurements were exact.

## Ownership And Simplification

The seven legitimate product authority responsibilities remain **7 -> 7**.

| Responsibility               | Before                                  | After                                                            |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Canonical saved Markdown     | Workspace filesystem/server API         | Unchanged                                                        |
| Route selection and history  | `RouteTransitionOwner`                  | Unchanged                                                        |
| Accepted live editor session | Zustand, with four controller mirrors   | Zustand alone; controller reads the exact current session by key |
| Projection and checkpoint    | `MarkdownAuthorityController`           | Same adapter owner, narrowed to projection-local truth           |
| Freeze and editor capability | Gate snapshot plus controller `#frozen` | `EditorSessionGateRuntime` alone                                 |
| Ordered draft obligations    | Draft persistence coordinator           | Unchanged                                                        |
| Durable browser recovery     | Dexie                                   | Unchanged                                                        |

Crepe remains a disposable projection runtime. Its lifecycle coordinator still
owns unique hosts, current-generation identity, predecessor ordering, stale
callback rejection, public teardown, rejected-create qualification, and the
four terminal outcomes. It owns no accepted Markdown.

| Measure                            | Before | After |
| ---------------------------------- | -----: | ----: |
| Editor envelope physical lines     |  4,274 | 3,791 |
| Store/contracts bucket             |  1,204 | 1,133 |
| Controller-family bucket           |    935 |   612 |
| Crepe/hook bucket                  |    532 |   539 |
| Gate bucket                        |    569 |   458 |
| React-chain bucket                 |  1,034 | 1,049 |
| Controller accepted-truth mirrors  |      4 |     0 |
| Freeze owners                      |      2 |     1 |
| Controller lifecycle states        |      4 |     3 |
| Registered controller capabilities |      3 |     2 |
| Zustand actions                    |     16 |    15 |
| Gate-preparation variants          |      5 |     0 |
| Gate translation layers            |      1 |     0 |

The identical physical envelope decreased by 483 lines. The bucket increases
are the exact session-reader transport and its tests; the net reduction is code
deletion, not movement or renaming.

Publication changed from three statuses and six reasons to the caller decision
`accepted/rejected` with four exact rejection reasons. Commit changed from four
variants and three statuses to `proceed/block`, with the four publication
reasons plus projection-read failure. Synchronization retains its meaningful
three statuses but removes dead `already_current` and checkpoint-restore result
causes. The five-way editor preparation result and `mapEditorRouteResult` are
gone; the gate returns the existing two-way `RouteGateResult` directly.
Decision-bearing editor-chain arms therefore reduce **12 -> 4** before the
unchanged route result: publication **3 -> 2**, commit **4 -> 2**, and gate
preparation **5 -> 0**. Production callers now branch only on publication
accepted/rejected, commit proceed/block, and route continue/cancel.

The only new production contract is `EditorSessionReader`, a synchronous
exact-key function returning the already-owned current Zustand `EditorSession`.
It owns, copies, caches, persists, or subscribes to no state, so it does not
recreate the removed mirrors. A small private synchronization-guard helper was
added only to satisfy the existing complexity limit; it adds no result or
product branch. No dependency, framework, product-state owner, storage
boundary, schema, migration, QA surface, build entry, or policy changed.

## Production Files

Changed production files:

- React assembly: `apps/web/src/App.tsx`, `components/MilkdownEditor.tsx`,
  `components/NoteEditorSurface.tsx`, `components/SaveableNoteEditor.tsx`,
  `components/use-milkdown-editor-controller.ts`, and `use-note-browser.ts`.
- Authority and lifecycle: `domain/markdown-authority-types.ts`,
  `components/markdown-authority-controller.ts`, its four `markdown-authority-*`
  helper/type files, and `components/crepe-generation-lifecycle.ts`.
- Gate: `components/editor-session-gate.ts`,
  `components/editor-session-gate-types.ts`, and
  `components/editor-session-gate-results.ts`.
- Zustand: `state/note-browser-authority-actions.ts`,
  `state/note-browser-contracts.ts`, `state/note-browser-store.ts`,
  `state/note-browser-types.ts`, `state/note-browser-save-rebase.ts`, and
  `state/note-browser-state-application.ts`.
- Existing Markdown QA adaptation: `qa/MarkdownFidelityQaApp.tsx` and
  `qa/markdown-fidelity-controller.ts`.
- Deleted: `state/note-browser-publication-results.ts`.

## Automated Verification

| Verification                                                                                                                          | Result                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Focused controller, Milkdown, StrictMode, gate, route, store, Save, recovery, future-schema, lifecycle, concurrency, and Dexie suites | 28 files, 227 tests passed               |
| `/opt/homebrew/bin/pnpm validate`                                                                                                     | Passed; 449 workspace tests passed       |
| `/opt/homebrew/bin/pnpm build`                                                                                                        | Passed                                   |
| Markdown QA optimized build                                                                                                           | Passed                                   |
| Product exclusion assertion                                                                                                           | Passed; 197 ordinary product files clean |
| `git diff --check` and 400-line governance                                                                                            | Passed                                   |

Focused proof covers latest-session mode/revision and asynchronous disposition
settlement, exact source and WYSIWYG publication, rejected visible retry and
Save/handoff blocking, one freeze truth for route and terminal actions,
same-session generation retention, successful-Save ownership, retired
generation callbacks, StrictMode resource/action ledgers, route continuation
and cancellation, edit-during-save, recovery, cleanup, conflict, and protected
future-schema records.

## Browser Acceptance

Codex Playwright CLI wrapper `0.1.17`, Node `26.0.0`, and pnpm `11.7.0` drove
fresh Chrome sessions. Product origins were `127.0.0.1:5173` and `:4173`; the
existing Markdown QA roots were `:5175` and `:4175`; Fastify remained on
`127.0.0.1:3000`. Sentry was disabled.

| Cell                | Cluster ID                             | Product and Markdown-QA result |
| ------------------- | -------------------------------------- | ------------------------------ |
| Development desktop | `db2fb6f9-b0b1-4201-8876-ce5852be4b57` | Passed                         |
| Development Pixel 6 | `f6d81388-4d73-4b64-8c12-ece5a70f739d` | Passed                         |
| Preview desktop     | `fecc093d-7bbe-4e71-baff-b6d6e3146b28` | Passed                         |
| Preview Pixel 6     | `73b48d4a-10f7-47b3-bbf3-0277052b5fa4` | Passed                         |

All product cells proved a WYSIWYG edit and Undo, exact source editing, an
unchanged Crepe generation through mode round trips, one successful real PUT,
one live editor host, coherent sidebar/Back/Forward routing, and zero horizontal
overflow. Development cells additionally proved durable reload recovery and
Discard back to exact saved disk truth. Optimized desktop and Pixel 6 proved an
external-write conflict: one expected 409, visible retained browser draft,
disabled Save, and Discard restoring external filesystem truth.

Every Markdown-QA cell rejected creation, retained exact editable source,
published one fallback edit, reset/remounted the editor, resolved the successor,
and finished with one enabled current host. This proportionally covers
rejected-create fallback, retry, stale-generation exclusion, and final
unmount/remount on the existing deterministic surface.

Both Pixel 6 cells recorded a 412 x 839 CSS viewport, 412 x 915 screen, device
scale factor 2.625, one touch point, coarse pointer, no hover, and zero overflow;
mobile Save, mode, route, conflict, Discard, and QA controls used Playwright
touch actions. Product preview console errors were limited to the expected 409
resource response; development product emitted the existing Milkdown/Vue
feature-flag warning. QA roots had zero errors and warnings.

Two setup corrections were recorded rather than silently retried. Running both
development Vite configurations concurrently caused their shared optimization
cache to return `504 Outdated Optimize Dep`; the matrix was restarted with the
two development roots served sequentially and then remained clean. The product
exclusion assertion was initially invoked after the nested QA build and
correctly saw that QA output; the required order—product build, exclusion
assertion, QA build—passed. One immediate Pixel reload preceded draft durability;
the selected recovery attempt waited for the admitted write and then recovered
the exact value. None was a product or Task 3B finding.

Owned browser sessions were closed, all five runtime ports were confirmed free,
and the four disposable clusters and ignored Playwright artifacts were deleted.
No credential, DSN, cookie, token, real note, or unrelated user work entered the
run.
