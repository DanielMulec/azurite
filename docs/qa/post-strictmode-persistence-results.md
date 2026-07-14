# Post-StrictMode Persistence Results QA

## Outcome

Task 3C passed on 2026-07-14. Dexie keeps exact validation and transaction
detail; the coordinator exposes ordered read and mutation decisions; Zustand
owns visible disposition, exact failure evidence, and retry availability; and
the gate consumes only `continue/block`. Recovery and Discard now return
`Promise<void>`, while one issue-selected command replaces the three ordinary
retry actions and React callback chains. Tasks 3D–3E and Slice 7E were not
started.

The accepted baseline was clean `main` at
`efb472a17eefbbe727365cabcd8eef60f157cd8d`. Characterization commit `2496254`
and Daniel's disjoint policy commit `7ecb706` are ancestors of the completion
tree; the policy files are not part of the Task 3C diff. The requested 6,697-line
baseline and all structural counts were reproduced exactly. The active proposal's
older 6,859 figure was its pre-Task-3B state: Task 3B reduced state by 67 lines
and gate/UI by 95 lines, producing the accepted 6,697 baseline.

## Decision Architecture

The seven product authorities remain **7 -> 7**:

| Authority                      | Retained owner                                            |
| ------------------------------ | --------------------------------------------------------- |
| Canonical saved Markdown       | Workspace filesystem/server API                           |
| Route selection and history    | `RouteTransitionOwner`                                    |
| Accepted live editor session   | Zustand                                                   |
| Projection and checkpoint      | `MarkdownAuthorityController`                             |
| Freeze and destructive handoff | `EditorSessionGateRuntime`                                |
| Ordered draft obligations      | `DraftPersistenceCoordinator` over `KeyedTaskCoordinator` |
| Durable browser recovery       | Dexie                                                     |

Caller decisions are now:

- ordered read: `absent/current/protected/failed`;
- mutation: `cleared/unchanged/protected/failed`, with exact storage outcome
  retained only as non-branching evidence;
- handoff: `continue/block`.

`decideDraftMutation` is the one raw mutation translation. Save cleanup,
cleanup retry, and Discard consume it; Save and retry share the same cleanup
state classifier. Snapshot settlement remains internal and retains only
`written/cleared/protected/failed/superseded`; supersession never enters Zustand
or a product result. The single public `retryDraftPersistenceIssue` command
selects recovery, exact immutable snapshot, or cleanup retry from the current
`DraftPersistenceIssue`. `retry_discard` remains terminal Discard behavior.

## Measurements And Deletions

| Measure                                 |                   Before |                   After |                      Delta |
| --------------------------------------- | -----------------------: | ----------------------: | -------------------------: |
| Complete persistence envelope           |         6,697 / 34 files |        5,752 / 35 files |                 -945 lines |
| Storage/coordinator                     |         1,532 / 11 files |        1,430 / 11 files |                 -102 lines |
| Zustand translations/actions            |         3,746 / 15 files |        3,018 / 16 files |                 -728 lines |
| Gate/UI                                 |          1,419 / 8 files |         1,304 / 8 files |                 -115 lines |
| Primary result/decision families        |                       12 |                       9 |                         -3 |
| Expanded union members                  |                       55 |                      34 |                        -21 |
| Unique result status literals           |                       22 |                      21 |                         -1 |
| Failure/rejection reasons               |                       18 |                      15 |                         -3 |
| Draft dispositions                      |                        8 |                       8 |                  unchanged |
| Persistence operations                  |                        6 |                       6 |                  unchanged |
| Retry-action literals                   |                        4 |                       4 |                  unchanged |
| Public Zustand actions                  |                       15 |                      13 |                         -2 |
| Ordinary retry callback threading       | 3 names / 66 occurrences | 1 name / 24 occurrences | -2 names / -42 occurrences |
| Immediately removable declaration lines |                      131 |             0 remaining |                       -131 |

The file count rises by one because storage deletes one/adds one while Zustand
deletes one/adds two; the physical line envelope still falls by 14.1%.

Deleted files:

- `apps/web/src/persistence/draft-coordinated-operations.ts`;
- `apps/web/src/state/note-browser-discard-results.ts`.

Deleted contracts include `CleanupResult`, `RecoveryReadResult`,
`DiscardResult`, `DiscardActionResult`, `DurabilityResult`, `DurabilityFailure`,
`CoordinatedDraftReadResult`, `CoordinatedDraftMutationResult`,
`DraftMutationResult`, and `DraftStorageFailure`. Deleted builders include
`createFailedDiscardResult`, `createPreservedDiscardResult`,
`createSupersededDiscardResult`, and `createTargetSupersededResult`.
`queue_failed`, recovery/cleanup/Discard payload builders, the four-way
durability ladder, duplicate cleanup classifiers and terminal-status sets,
`record_protected`, and the unreachable synchronous
`snapshot_admission_failed` reason arm are gone. The latter remains only as
blocked-path failure evidence when no admitted snapshot exists.

## Preserved Guarantees

Automated proof covers scheduled and queued same-note ordering, rejected-tail
release, different-note independence, exact failed-snapshot retry, conditional
Save cleanup, invalid-record deletion, future-schema preservation, dirty
recovery exclusion, exact cleanup retry without a second Save, terminal Discard
ordering and fresh-epoch restoration, and closed-epoch callback exclusion.

The bounded review found and resolved two adversarial gaps before completion:

1. cleanup-required state now blocks handoff before an old durable-key shortcut;
2. a started write that fails after Discard closes its epoch cannot re-enter the
   coordinator's failed-snapshot map.

Both have direct regression tests. Failed Discard also verifies that only the
same owner and exact closed epoch may receive restoration. Lifecycle proof
shares one receipt/write across `visibilitychange`, `pagehide`, and unmount and
finishes with zero timers, keyed work, or obligations. Task 3B's rejected
publication, exact Markdown, mode, Undo, Save, route, recovery, conflict, and
StrictMode guarantees remain covered by the full repository suite and browser
matrix.

## Automated Verification

| Verification                                   | Result                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Accepted focused baseline                      | 7 files / 49 tests passed before production edits                          |
| Final focused persistence suite                | 7 files / 56 tests passed                                                  |
| Final web suite before documentation           | 49 files / 311 tests passed                                                |
| Full repository suite                          | 65 files / 466 tests passed                                                |
| `/opt/homebrew/bin/pnpm validate`              | Passed; formatting, governance, 400-line limit, lint, types, and all tests |
| `/opt/homebrew/bin/pnpm build`                 | Passed; optimized bundle built                                             |
| `git diff --check`, governance, 400-line check | Passed                                                                     |

No test was skipped, relaxed, broadly mocked, or preserved around a deleted
return payload. Replacement assertions inspect Zustand, exact issues, storage,
call counts, ordering, owners, and epochs.

## Browser Acceptance

Codex Playwright CLI wrapper `0.1.17`, Chrome `150.0.7871.115`, Node `26.0.0`,
and pnpm `11.7.0` drove fresh headed Chrome sessions on macOS `26.5.2`. Sentry
was disabled. `QA_RUN_ID` was `task3c-20260714T193722Z-7ecb706`; Fastify stayed
on `127.0.0.1:3000`, development used `127.0.0.1:5173`, and optimized preview
used `127.0.0.1:4173`.

| Cell                | Disposable cluster ID                  | Result |
| ------------------- | -------------------------------------- | ------ |
| Development desktop | `8bc2d01e-b208-4e1d-87c9-757e8cf3488f` | PASS   |
| Development Pixel 6 | `1229b0e4-0bf0-4f4e-b928-5e492c6ee76a` | PASS   |
| Optimized desktop   | `755ba685-465d-4ee6-9bc9-f87fe0cce9b2` | PASS   |
| Optimized Pixel 6   | `4a1ce672-9518-4061-b59c-87957ea8061f` | PASS   |

Every cell used its own sentinel cluster and isolated browser storage. Exact
source input became a version-one IndexedDB record, reload recovered the exact
bytes and editor mode, Discard restored disk authority and left zero records,
one later WYSIWYG or source edit issued exactly one successful PUT, and matching
Save cleanup again left zero records. The four final fixture hashes were
`50dd1ad1...` (83 bytes), `1904c0ee...` (55 bytes), `e85a29bf...` (78 bytes),
and `978b30f8...` (85 bytes). Desktop cells additionally proved WYSIWYG Undo
returned exactly to disk content. Sidebar selection, Back, and Forward kept URL,
heading, and `aria-current` coherent in every cell.

Both Pixel 6 cells recorded a 412 x 839 CSS viewport, 412 x 915 screen, device
scale factor 2.625, one touch point, coarse pointer, no hover, and zero horizontal
overflow. Mode, Save, Discard, and sidebar controls used Playwright `tap()`.
Optimized cells had zero console errors or warnings. Development had zero errors
and only the existing Vite/Vue feature-flag warning. All observed API requests
completed with 200 responses; each cell recorded exactly one PUT and no duplicate
Save, recovery application, or terminal action.

## Final Review, Cleanup, And Scope

One bounded read-only review reported two blockers, both fixed above, then
completed with no remaining blocking findings. The four browser sessions were
closed, owned runtimes stopped gracefully, and ports 3000, 5173, and 4173 were
confirmed free. Disposable clusters and ignored Playwright artifacts were
deleted after this durable record was written. No real note, credential, DSN,
cookie, token, unrelated process, or unrelated work entered the run.

`StoreContext`, `NoteBrowserRuntime.context`, `configureContext`, Save
single-flight ownership, `baseline-route-draft-gate.ts`, the
`note-browser-actions.ts` barrel, both public Discard entries, and all current
Sentry/Slice 7E boundaries remain intact. Tasks 3D–3E and Slice 7E are untouched.

Final decision: **Passed**.
