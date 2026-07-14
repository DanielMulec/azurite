# Slice 7D Markdown Fidelity And Honest Dirty State QA Evidence

## Status

- Product, lifecycle-harness, route-gate, storage-fault, desktop, and Pixel 6
  decisions: **Passed on 2026-07-14**.
- Repository completion decision: **Blocked pending two explicit-authority
  gates**.
- QA date and timezone: 2026-07-13 through 2026-07-14, Europe/Vienna.
- Browser-tested implementation commit:
  `9a3666c0eccf8c834c31535f48358955ab9ae4f4`.
- Scope: exact Markdown authority, honest dirty state, stable Crepe ownership,
  ordered browser-draft persistence, failure restoration, same-session Save,
  route-gate composition, legacy recovery disposition, future-schema
  preservation, and the shared product guardrails.
- Authoritative contract:
  `docs/slices/active/slice-7d-markdown-fidelity-and-honest-dirty-state.md`.

Every selected product and fault scenario passed. Two non-product gates remain
incomplete and are not counted as passing:

1. the runbook requires Daniel's explicit authorization before cloning an
   authenticated Chrome profile to inspect the selected Sentry-enabled
   exercise in the Sentry UI; and
2. repository-wide `pnpm validate` stops at Prettier because the unrelated,
   user-owned
   `docs/follow-ups/slice-7d-simplification-discussion.md` is unformatted.
   Slice 7D introduced no Prettier ignore, ESLint ignore, override, disable, or
   policy exception, and this QA run did not edit that document.

This record becomes `Passed` only after both gates complete, final validation
runs from the beginning, cleanup finishes, and the completed slice is archived.

## Environment And Run Ownership

| Item                         | Recorded value                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository before QA         | Clean `main`, synchronized with `origin/main`; no unrelated tracked changes were modified                                                                                                                                              |
| Browser-tested commit        | `9a3666c0eccf8c834c31535f48358955ab9ae4f4`                                                                                                                                                                                             |
| Operating system             | macOS `26.5.1` build `25F80`, Apple Silicon                                                                                                                                                                                            |
| Node / pnpm                  | Node `v26.0.0`; pnpm `11.7.0`                                                                                                                                                                                                          |
| Playwright                   | Codex Playwright CLI wrapper `0.1.17`; bundled Chromium with Chrome `151.0.7922.10` user agent in the final Pixel 6 cell                                                                                                               |
| `QA_RUN_ID`                  | `slice-7d-20260713T225854Z-3211d9d`                                                                                                                                                                                                    |
| `QA_ROOT`                    | Owned temporary root under `/var/folders/.../azurite-slice-7d-20260713T225854Z-3211d9d.i5ClGS`                                                                                                                                         |
| Browser artifacts            | Owned subdirectories under `QA_ROOT/browser-evidence`; no artifact was written to tracked paths or `output/playwright`                                                                                                                 |
| Product origins              | Vite development `http://127.0.0.1:5173`; optimized preview `http://127.0.0.1:4173`; both proxied to loopback Fastify at `127.0.0.1:3000`                                                                                              |
| Product cluster IDs          | Development desktop `eb2229d2-4030-4e3e-b5aa-e883f64c2d60`; development Pixel 6 `b0663079-8748-4bd1-b8fa-41cf8bf7555c`; preview desktop `e557368b-fd6c-472e-ab5b-dcb8979d5a09`; preview Pixel 6 `beababcc-c762-4167-8287-6c7c1352eff9` |
| Fault cluster IDs            | Preview desktop `9f2406b2-3e06-46b3-ad97-d41e96de831e`; ready-identity preview Pixel 6 `fbbdb272-11b7-403d-8959-39981c991212`; a separate Pixel cluster deliberately made cluster identity unwritable                                  |
| Sentry                       | Disabled in all four product cells; one optimized desktop local Sentry-enabled diagnostic cell emitted 11 configured envelope resources with no uncaught browser fault; authenticated UI inspection remains pending                    |
| Supplemental authorized data | None. No authenticated Chrome clone was created because Daniel has not yet given the runbook's explicit authorization                                                                                                                  |

Before each stateful cell, the selected ports and owned process identities were
checked, Fastify remained loopback-only, `/health` and the expected API/frontend
origin responded, and `/api/notes` exposed only that cell's disposable
fixtures. No real cluster, real note, credential, DSN, authorization header, or
authenticated browser profile entered the run or this record.

## Fixture Manifest

The four verbatim fixture files use `.markdown-fixture`, not `.md`, so the
repository's normal Markdown formatter does not claim them as documentation.
No formatter ignore is involved.

| Fixture                                   | Bytes | SHA-256                                                            | Purpose                                                                   |
| ----------------------------------------- | ----: | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `hyphen-lists.markdown-fixture`           |   267 | `f5f439999071258aeda3474fb6fbf2774803f5891cb59ad94fd025a66d71bb5e` | Hyphen markers, nested lists, ordered lists, link, and trailing newline   |
| `mixed-dialect.markdown-fixture`          |   667 | `97031b118c846d7f83fc65e17e11068f27136c77976ecf585be923ea6e488117` | CommonMark, GFM table, blockquote, lists, code, emphasis, and blank lines |
| `whitespace-choices.markdown-fixture`     |   192 | `bc24a9b038723447480786a3f8e34c15bdc8149fdbfe34a752ad6ed13a732735` | Blank-line and hard-break choices plus one trailing newline               |
| `long-mixed-note.markdown-fixture`        | 7,933 | `be0d2c1bde2efd0956d5a1822125d36634d18a946af9038f7ace76e31a404547` | Production-sized mixed-format regression                                  |
| Programmatically constructed CRLF fixture |     — | Compared in-memory                                                 | Proves CRLF/LF-only equality without Git normalizing the test input       |

Each product cell copied the four file fixtures into a fresh cluster. The
fixture sweep opened each note, waited beyond Crepe readiness and the
200-millisecond listener debounce, verified disabled Save and zero drafts,
switched WYSIWYG to Markdown to WYSIWYG, recomputed the source hash in the
browser, and verified clean state, zero drafts, and no horizontal overflow.
Network evidence contained zero `PUT` requests for the pristine sweep.

The deliberate edit/save scenarios used separate sentinel copies. Unedited
fixture copies retained the hashes above. Deliberately edited sentinels and the
one accepted-WYSIWYG boundary were expected writes and were recorded separately
from pristine fidelity evidence.

## Coverage Selection And Result

| Scenario family                                                | Development desktop | Preview desktop | Development Pixel 6 | Preview Pixel 6                       | Sentry dimension                           | Result  |
| -------------------------------------------------------------- | ------------------- | --------------- | ------------------- | ------------------------------------- | ------------------------------------------ | ------- |
| Pristine open, readiness, mode cycle, reload, zero draft/PUT   | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| Exact source edit, draft completion, Save, and reload          | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| Immediate WYSIWYG edit before mode/Save/sidebar/Back/Forward   | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| Same-session rerender, deferred Save, and post-Save no-op      | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| Busy/inert replacement and later-intent route ownership        | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| Pending-create and rejected-create lifecycle harness           | Selected            | Selected        | Selected            | Selected                              | Not applicable to product build            | PASS    |
| Slice 7C acceptance decorator around the real editor gate      | Selected            | Selected        | Selected            | Selected                              | Disabled                                   | PASS    |
| IndexedDB ordering, read/write/cleanup/Discard fault injection | Not selected        | Selected        | Not selected        | Interaction-sensitive subset selected | Disabled                                   | PASS    |
| Unknown future schema and unread recovery preservation         | Not selected        | Selected        | Not selected        | Interaction-sensitive subset selected | Disabled                                   | PASS    |
| Optimized diagnostic exercise                                  | Not selected        | Selected        | Not selected        | Not selected                          | Local enabled transport passed; UI pending | BLOCKED |

Storage and queue faults were concentrated in optimized desktop because the
injected boundary is independent of presentation. The touch/focus/freeze
variants required by the slice were repeated in optimized Pixel 6. Automated
controllable-adapter tests cover every ordering permutation and exact typed
result without relying on browser timing.

## Product And Harness Results

### Exact Authority And Pristine Fidelity

- All four fixture hashes matched in all four product cells after editor
  readiness and mode-only switching.
- Save remained disabled, no draft record appeared, reload showed no recovery
  state, and the defensive clean Save path issued no `PUT`.
- The installed Crepe projection visibly normalizes some list/table syntax, but
  creation, readiness, and synchronization did not publish that projection as
  authority.
- A deliberate accepted WYSIWYG edit adopted Milkdown's broader serialized
  projection. That is the slice's honest real-edit boundary; token-preserving
  localized source patches remain outside 7D.
- The programmatic CRLF case proved CRLF/LF-only equality while every syntax,
  spacing, and trailing-newline difference remained dirty.

### Creation, Same-Session Ownership, And Save

- The real component lifecycle harness held `crepe.create()` pending in
  development and optimized builds on desktop and Pixel 6. Source stayed
  editable, pre-ready WYSIWYG activation was refused, and readiness synchronized
  the newest source without an echo.
- Rejected creation kept exact editable source, disabled WYSIWYG, showed the
  rich-editor availability error, and created no content callback or draft.
- Ordinary mode, disposition, issue, recovery, and save-status rerenders kept
  one Crepe DOM/controller. Component tests prove the exact instance count,
  checkpoint, selection, and Undo preservation.
- A deferred Save settled before Milkdown's listener while a newer WYSIWYG edit
  was pending. The existing session survived; the later publication became
  dirty and recoverable against the new saved baseline.
- After ordinary Save, clicking the already-selected note remained a Slice 7C
  `coherent_noop`: no gate lease, navigation, history mutation, note read,
  route-evidence operation, or editor replacement.

### Transition Gate And Browser Lifecycle

- Immediate WYSIWYG edits were synchronously committed before source mode,
  Save, sidebar selection, Back, and Forward. The edit was present before the
  transition continued and its matching draft was observed complete before
  reload recovery was claimed.
- Held replacement reads put `aria-busy` on the outgoing article and `inert` on
  the complete outgoing interaction region while leaving visible/live status
  outside that subtree and the note list available for a newer intent.
- Pointer, keyboard, touch, toolbar, and editor input could not mutate the
  frozen outgoing surface. Cancellation restored the same controller and focus
  when the attempted control still existed; success did not steal focus from
  navigation.
- The Slice 7C acceptance controller decorated the real editor gate. Every
  terminal route outcome, overlapping lease, cancellation, supersession,
  failed load, and contained settlement throw released the correct lease and
  never stranded a controller busy, inert, frozen, or closed.
- `visibilitychange` and `pagehide` committed the live projection before the
  existing flush attempt. Recovery was claimed only after the exact IndexedDB
  record completed, never from a merely started lifecycle mutation.
- The ordinary rebuilt product contains no lifecycle-harness entry, global
  controller marker, or fault control.

## Optimized Desktop Fault Evidence

### Failed Write And Explicit Retry

An exact current snapshot first became durable. A disposable IndexedDB upgrade
then removed the real `drafts` object store, forcing the next exact write to
fail. The accepted source stayed authoritative and Saveable, the disposition
remained generated-pending, and `Retry draft persistence` retained the exact
failed revision without another edit. After deleting the disposable database,
the visible retry recreated schema version 10 and made that same snapshot
durable. No automatic retry loop or duplicate revision appeared.

### Successful Save With Failed Cleanup

A durable dirty draft was followed by the same real object-store failure.
Manual Save issued exactly one successful `PUT`, advanced disk and saved
baseline, disabled Save, and showed `Saved; browser draft cleanup needs retry`.
Sidebar handoff issued no note read while cleanup was unavailable and restored
the same source/controller. A failed retry remained actionable. After storage
repair, `Retry draft cleanup` cleared the state without a second `PUT`; later
handoff issued one read and proceeded.

### Recovery Read Failure

Opening a note while the real store was missing installed the exact disk-backed
editor with `Browser recovery could not be read`, disabled clean Save, no
Discard, and visible `Retry browser recovery`. Repeated failure neither deleted
nor wrote a record. Editing removed the destructive retry while preserving
exact live authority and manual Save. Successful filesystem Save retained the
unread state without browser cleanup. After repair, clean retry resolved absence,
removed both the exact issue and the legacy global degradation banner, and left
schema version 10 with no record.

### Future-Version Preservation

A raw schema-version-7 value with an opaque sentinel was seeded for a real note.
The older build showed `A newer Azurite build owns this recovery record`, gave
compatible-newer-build guidance, exposed no Discard, and kept clean Save
disabled. Mode changes, source edits, dirty handoff cancellation, manual Save,
and clean handoff left the opaque value JSON-equivalent. No current-version
write or cleanup targeted the key.

### Discard, Conflict, And Missing Note

- A compatible recovered draft retained exact source and editor mode. Forced
  deletion failure performed no reload and restored the same textarea/controller,
  caret, recovered disposition, Save action, and `Retry discard` under a fresh
  epoch. Repair plus explicit retry deleted first and only then reloaded exact
  disk Markdown cleanly.
- An external filesystem write produced one expected `409`; the live draft
  remained exact under conflict. Confirmed Discard removed the draft, reloaded
  the new disk bytes, and stayed clean through readiness and mode switching.
- A recovered draft equal to disk remained explicitly Saveable and discardable;
  explicit Save made one `PUT`, deleted the compatible record, and returned to
  clean state.
- A valid ambiguous pre-7D current-version record was preserved as recovered
  until explicit disposition instead of being inferred away from projection
  equality.
- Missing-note recovery showed exact source with no Save. Confirmed Discard
  removed its record, returned to `Note not found`, and did not resurrect after
  wait and reload.

## Optimized Pixel 6 Fault Evidence

Both optimized Pixel sessions reported a `412` by `839` CSS viewport, `412` by
`915` CSS screen, device scale factor `2.625`, Android 12 Pixel 6 user agent,
one touch point, coarse pointer, no hover, and no horizontal overflow. Mode,
navigation, Save, cleanup retry, recovery retry, Discard, and retry controls in
the selected interaction scenarios used Playwright `tap()`.

- Making `.azurite` a regular file produced unavailable cluster identity.
  Touch-focused source input became exact dirty authority, enabled Save, and
  exposed no false durability. Touch navigation remained on the current URL,
  issued no target read, retained source, and restored interactivity/focus.
  One manual `PUT` made the file clean; clean handoff then issued one read and
  proceeded as preserved.
- Failed cleanup repeated the desktop restoration contract through touch. It
  blocked handoff with no target read, retained exact source, left no busy/inert
  state, and cleared after repair with no second `PUT`.
- Failed Discard preserved the same textarea DOM node, exact recovered bytes,
  caret position 17, Save availability, and interactive surface. Touch retry
  reloaded exact disk only after deletion succeeded and left schema version 10
  empty.
- Clean recovery-read retry stayed unavailable while faulted, then resolved to
  Saved after repair with the degradation banner cleared.
- A schema-version-7 future record showed the preserved state and newer-build
  guidance, exposed no destructive touch control, and retained its opaque raw
  sentinel through a touch mode change.
- Deliberate store upgrade/delete faults emitted only the expected Dexie
  connection-close/reopen warnings. A fresh post-fault Pixel session had zero
  console errors and warnings, no overflow, clean state, and no Sentry transport.

## Sentry Diagnostic Cell

The optimized desktop product was rebuilt with explicit non-secret Sentry debug
configuration and exercised through the same core authority/save/route path.
The browser reported zero uncaught errors, and local network evidence observed
11 configured envelope resources. Slice 7D adds no Sentry semantics and does
not rely on Sentry for product behavior.

The runbook separately requires an authenticated Sentry UI inspection to prove
the selected exercise introduced no uncaught fault. That inspection requires an
ephemeral clone of Daniel's authenticated Chrome profile and therefore explicit
authorization. No clone or authenticated inspection has occurred. This cell is
`BLOCKED`, not silently accepted from transport evidence alone.

## Slice 7E Diagnostic Input Boundary

Slice 7D leaves typed, telemetry-free product results in these authoritative
implementation homes:

- `AcceptedChangeResult`, authority decision patches, `PublicationResult`,
  `SynchronizationResult`, and `CommitResult` describe observed editor authority
  without treating raw projection callbacks as accepted content;
- `DraftReadResult` and `DraftRecordMutationResult` preserve absent,
  invalid-deleted, compatible-current, mismatch, unavailable, and unknown-future
  outcomes from the transactional adapter;
- `DraftMutationSnapshot`, `SnapshotPreparationResult`, and the coordinator's
  exact snapshot/mutation results carry owner, epoch, revision, operation, and
  immutable content identity;
- `DraftPersistenceIssue`, `RecoveryReadResult`, `DurabilityResult`,
  `CleanupResult`, and `DiscardResult` retain underlying cluster, Dexie, record,
  coordinator, or owner-loss cause instead of a global degraded boolean; and
- `EditorGatePreparationResult` exposes target-free commit/durability truth for
  Slice 7C while route intent, target, history, and terminal ownership stay in
  the route owner.

Slice 7E must observe these results after implementation refresh. It must not
infer acceptance from every Milkdown projection, erase underlying failure
reasons, require an editor `sessionKey` before recovery read/editor creation,
or become a state owner. No 7E telemetry behavior was implemented in 7D.

## Console And Request Evidence

| Cell or scenario                | Console result                                      | Request/storage evidence                                                      |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Normal optimized desktop        | Zero errors and warnings                            | Expected reads/PUTs only; pristine sweep had zero PUTs                        |
| Normal optimized Pixel 6        | Zero errors and warnings                            | Expected reads/PUTs only; no overflow                                         |
| Development product/harness     | Existing Vue feature-flag warning only; zero errors | Real Fastify requests; harness changed lifecycle timing, not responses        |
| Optimized product/harness       | Zero errors and warnings                            | Real Fastify requests; product rebuilt afterward                              |
| External conflict               | One expected failed-resource entry                  | Exactly one deliberate `409`; no overwrite                                    |
| Missing note                    | One expected missing-note response                  | Expected `404`; Discard removed only the seeded compatible record             |
| IndexedDB fault sessions        | Expected Dexie upgrade/delete close/reopen warnings | Real schema version 1000 fault; repair recreated production schema version 10 |
| Fresh post-fault Pixel 6        | Zero errors and warnings                            | Clean disk editor, zero drafts, no remote Sentry transport                    |
| Local Sentry-enabled diagnostic | Zero uncaught browser errors                        | 11 configured envelope resources; authenticated Sentry UI result pending      |

## Findings And Attempt Disposition

| ID      | Type / severity | First evidence                                                                                           | Disposition                                                                                                                                                    |
| ------- | --------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7D-QA-1 | Product / P1    | Rejected Crepe creation initially lost its availability error after a later React callback               | In-scope lifecycle truth fixed in `8c96f25`; component tests and all four lifecycle-harness cells passed                                                       |
| 7D-QA-2 | Product / P1    | Successful recovery retry cleared the exact issue but left the legacy global degradation banner visible  | In-scope honest-state defect fixed in `c68ae0f`; automated and desktop/Pixel repair reruns passed                                                              |
| 7D-QA-3 | Product / P1    | Ready-note future-version state named ownership but omitted compatible-newer-build guidance              | In-scope future-record actionability fixed in `9a3666c`; automated and desktop/Pixel reruns passed                                                             |
| 7D-QA-4 | Runner setup    | One IndexedDB fault snippet was malformed, and early Discard attempts mishandled the confirmation dialog | Recorded runner mistakes. Isolated clean reruns used the real object store and explicit dialog acceptance; no product result was inferred from failed attempts |
| 7D-QA-5 | Runner setup    | A post-Discard probe called `inputValue()` after the product correctly returned to WYSIWYG               | Probe error only. A fresh snapshot and DOM/state/IndexedDB inspection proved the successful product result                                                     |
| 7D-QA-6 | Runner setup    | A fresh-session command selected a work directory before creating it                                     | No process started. The directory was created first and the fresh Pixel cell reran with zero errors/warnings                                                   |
| 7D-QA-7 | Completion gate | Authenticated Sentry UI inspection lacks explicit Chrome-clone authorization                             | Pending Daniel authorization; cannot count as passed                                                                                                           |
| 7D-QA-8 | Completion gate | `pnpm validate` stops on the unrelated user-owned follow-up Markdown file                                | No ignore or policy exception added. Pending explicit permission to format that file, followed by a complete validation rerun                                  |

The three product findings were inseparable from the current 7D user story:
each made a required 7D state false after otherwise successful implementation.
They required no new workflow, durable owner, schema, dependency, or route
capability, so scope remained 7D. Runner issues changed no product scope.

## Automated Verification

At commit `9a3666c0eccf8c834c31535f48358955ab9ae4f4`:

| Command                                                               | Result                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/opt/homebrew/bin/pnpm --filter @azurite/web test`                   | 43 files, 270 tests passed                                                                                               |
| `/opt/homebrew/bin/pnpm test`                                         | Shared 58, Core 41, Web 270, Server 56; **425 total passed**                                                             |
| `/opt/homebrew/bin/pnpm check:file-lines`                             | Passed; every code file is at or below 400 lines                                                                         |
| `/opt/homebrew/bin/pnpm lint`                                         | Passed with zero warnings; no lint rule, config, ignore, override, or disable was changed                                |
| `/opt/homebrew/bin/pnpm typecheck:scripts`                            | Passed                                                                                                                   |
| `/opt/homebrew/bin/pnpm typecheck`                                    | Passed in shared, core, web, and server                                                                                  |
| `/opt/homebrew/bin/pnpm qa:markdown-fidelity:build`                   | Passed; optimized lifecycle harness built                                                                                |
| `/opt/homebrew/bin/pnpm build`                                        | Passed; existing measured editor chunk-size warning only                                                                 |
| `/opt/homebrew/bin/pnpm qa:markdown-fidelity:assert-product-excluded` | Passed; 197 ordinary product files contain no harness entry, marker, or fault control                                    |
| `git diff --check`                                                    | Passed                                                                                                                   |
| `/opt/homebrew/bin/pnpm validate`                                     | **Blocked at Prettier only** by `docs/follow-ups/slice-7d-simplification-discussion.md`; downstream stages pass directly |

The web tests emit happy-dom's existing `Window scrollTo` limitation. The
optimized builds emit the already-tracked Milkdown/editor chunk warning. Neither
is a new product warning or weakened validation.

`.prettierignore` contains only `node_modules/`, `dist/`, `coverage/`, and
`pnpm-lock.yaml`. Fixture fidelity comes from the non-document
`.markdown-fixture` extension plus exact hashes, not a formatter exclusion.

## Cleanup Ledger

| Owned resource                                             | Cleanup action                                                        | Current result                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| All product, harness, route, and fault Playwright sessions | Closed through the Playwright CLI                                     | Complete                                            |
| Fastify and Vite processes                                 | Graceful `SIGINT`/normal shutdown                                     | Complete; ports `3000`, `5173`, and `4173` are free |
| `output/playwright`                                        | Kept free of this run's temporary evidence                            | Complete                                            |
| Authenticated Chrome clone                                 | Never created                                                         | Complete                                            |
| `QA_ROOT` disposable clusters/evidence                     | Retain until the durable record is committed, then delete before pass | Pending                                             |

No unrelated process, browser profile, cluster, path, or tracked artifact was
changed. The final completion update must confirm `QA_ROOT` deletion and free
ports after the permission-bound gates finish.

## Completion Gate

- [x] Every selected product, lifecycle, route, storage, desktop, and Pixel 6
      scenario passed.
- [x] New behavior and preserved guardrails have automated and real-browser
      evidence.
- [x] Every product finding and runner attempt has an explicit disposition.
- [x] Harness and product build boundaries passed without a production fault
      switch.
- [ ] Authenticated Sentry UI inspection is authorized and passed.
- [ ] The unrelated formatter blocker is explicitly authorized and resolved
      without an ignore or policy exception.
- [ ] Complete `pnpm validate` passes from the beginning.
- [ ] `QA_ROOT` is deleted after durable evidence is committed.
- [ ] The completed slice is archived on clean `main` synchronized with
      `origin/main`.

Final decision: **`Blocked`** pending the two explicit-authority gates above.
