# Playwright Browser Acceptance

## Purpose

Operate and evolve Azurite's repeatable real-browser acceptance workflow. This
runbook defines the stable matrix, participating state owners, reusable scenario
catalogue, evidence rules, and cleanup procedure. A slice plan selects the
behavior it changes and the guardrails it must preserve; its `docs/qa/` record
captures the run-specific fixtures, results, findings, and exact evidence.

This is an operational QA procedure, not a supported-browser product policy and
not a replacement for deterministic Vitest coverage. The completed Slice 7B
record in `docs/qa/slice-7b-request-correlation.md` is the seed evidence for
this runbook and remains historical rather than becoming a mutable checklist.

## Full-Stack State Boundary

Playwright acts through the rendered product, so it exercises state management
indirectly but genuinely. A passing browser flow must keep the following owners
coherent; seeing the correct DOM alone is insufficient.

| Layer or state owner                | Product truth it owns                                                                                                            | Browser acceptance evidence                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Chrome, React, and Milkdown/Crepe   | Rendered editor, controls, selection, input, and responsive interaction                                                          | Visible content and controls match the intended state; interactions work without unexpected console output or overflow.        |
| TanStack Router and browser history | Canonical note URL, typed search state, Back/Forward behavior, and replace-versus-push semantics                                 | URL, rendered note, focused item, and `aria-current` remain coherent after direct navigation and history traversal.            |
| Zustand note-browser store          | Selected note, editor-session ownership, exact Markdown authority, dirty/recovery state, request sequencing, and save settlement | Status and controls reflect the latest user intent; stale or superseded async work cannot change the active session.           |
| Editor controller boundary          | Live rich-editor instance, readiness, mode, document projection, selection, and Undo history                                     | WYSIWYG and Markdown transitions preserve the slice's authority and lifecycle guarantees.                                      |
| Dexie and IndexedDB                 | Cluster-scoped recovery drafts and durable browser recovery state                                                                | Draft creation, absence, recovery, reconciliation, and deletion match the user-visible state after reload.                     |
| Web API client and Vite proxy       | Validated request/response traffic between the browser origin and local API                                                      | Real requests use relative routes, preserve required headers, and receive actual Fastify responses without API-response mocks. |
| Fastify routes and request context  | API validation, safe results, correlation context, and local network boundary                                                    | Expected status and response shapes arrive through the proxy while Fastify stays loopback-only.                                |
| Core domain and filesystem          | Safe note resolution, exact persisted Markdown, hashes, conflicts, and write ordering                                            | Disposable files contain the expected bytes after save and remain unchanged after clean or rejected operations.                |
| Sentry debug runtime, when selected | Cross-runtime errors, logs, traces, Replay, and browser/server joins                                                             | Enabled evidence is diagnostically complete; disabled mode cannot change product behavior or emit Sentry traffic.              |

State management is therefore not synonymous with Zustand. Router state,
Zustand, the live editor controller, IndexedDB, request ownership, and filesystem
authority participate in one workflow while retaining separate ownership.

## Safety And Prerequisites

- Inspect `git status --short --branch` before QA and preserve unrelated work.
- Use a disposable markdown cluster. Never open or write Daniel's real cluster
  for acceptance testing.
- Keep Fastify on `127.0.0.1:3000`. Routine Pixel 6 acceptance uses the Vite
  proxy and does not require a Tailscale bind.
- Use fresh named browser sessions and dedicated fixture notes for matrix cells
  that write, conflict, or persist drafts.
- Keep generated screenshots, traces, snapshots, and profiles under
  `output/playwright/<slice-or-date>/`; this path is ignored by Git.
- Do not mock API responses. Controlled delay may postpone a real response when
  a slice must prove ordering, but it must not replace its body or status.
- Run the slice's automated verification before final browser acceptance. Move
  every stable, deterministic browser discovery into Vitest when it can be
  proved without weakening the real-browser assertion.
- Use authenticated Chrome data only when Daniel explicitly authorizes Sentry
  dashboard inspection. Follow the complete-clone procedure below and
  `docs/runbooks/sentry-debug.md`; a selected profile, cookies-only copy, or
  Playwright-created profile is not an acceptable substitute.

The Codex Playwright CLI wrapper depends on `npx`. Verify it and configure the
wrapper before proposing or running browser commands:

```sh
command -v npx >/dev/null 2>&1
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" --help
```

Use the wrapper even when Playwright is not a repository dependency. Do not add
`@playwright/test` merely to perform slice acceptance.

## Permanent Runtime And Device Matrix

The stable baseline contains four cells:

| Runtime                      | Device         | Default origin          |
| ---------------------------- | -------------- | ----------------------- |
| Vite development             | Desktop Chrome | `http://127.0.0.1:5173` |
| Optimized production preview | Desktop Chrome | `http://127.0.0.1:4173` |
| Vite development             | Pixel 6        | `http://127.0.0.1:5173` |
| Optimized production preview | Pixel 6        | `http://127.0.0.1:4173` |

The changed behavior and every preserved guardrail named by the active slice
must run in every relevant matrix cell. Each cell also receives the compact
baseline flow below. Specialized destructive or fault-injection scenarios may
run in fewer cells when the slice does not touch that boundary; the QA record
must name the selected cells and the concrete reason.

Sentry is a conditional dimension, not an automatic doubling of every slice:

- If a slice changes observability, request correlation, trace propagation,
  Replay, or fail-open behavior, run every relevant cell with Sentry enabled and
  disabled.
- If a slice only needs Sentry as diagnostic evidence, use the configured debug
  cell or cells and record that selection.
- If a slice does not touch or rely on Sentry, the four-cell product matrix is
  sufficient unless its plan says otherwise.

Pixel 6 acceptance must record Android Chrome emulation, a `412` by `839` CSS
viewport, `412` by `915` CSS screen, device scale factor `2.625`, touch support,
coarse pointer, and no hover. These values verify the intended descriptor; they
do not redefine physical-device performance or Android IME behavior.

## Start Disposable Runtimes

Prepare a temporary cluster with purpose-built fixtures for the active slice.
Record its initial filenames, exact content, byte lengths, and SHA-256 hashes
when fidelity or persistence is under test.

Start Fastify in its own terminal with explicit Sentry overrides appropriate to
the matrix cell:

```sh
AZURITE_WORKSPACE_PATH=/absolute/path/to/disposable-cluster \
SENTRY_ENABLED=false SENTRY_DSN= SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/server dev
```

For development, start Vite in another terminal:

```sh
VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= \
VITE_SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/web dev
```

For optimized production, build first and then start preview:

```sh
/opt/homebrew/bin/pnpm build
VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= \
VITE_SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/web preview
```

Use the root `.env.local` procedure in `docs/runbooks/sentry-debug.md` for
enabled cells. Environment values consumed by Vite must be present during the
production build, not introduced only when preview starts.

Verify `/health`, `/api/notes`, the frontend origin, and the listening addresses
before driving the UI.

## Open And Drive Browser Cells

Run each cell from its own artifact directory and use a unique session name.
For example:

```sh
mkdir -p output/playwright/<slice-or-date>/<cell>
cd output/playwright/<slice-or-date>/<cell>

"$PWCLI" --session <cell> open <origin> --browser chrome --headed
"$PWCLI" --session <cell> snapshot
```

For Pixel 6:

```sh
"$PWCLI" --session <cell> open <origin> \
  --browser chrome --device "Pixel 6" --headed
"$PWCLI" --session <cell> snapshot
```

Use the normal CLI loop:

1. Snapshot before using element references.
2. Interact through current semantic references with `click`, `fill`, `type`,
   and `press`.
3. Snapshot again after navigation, mode changes, editor replacement, dialogs,
   or other substantial DOM changes.
4. Use focused evaluation or `run-code` only for evidence that cannot be
   obtained through explicit commands, such as device metrics, IndexedDB state,
   overflow measurements, or tightly controlled timing.
5. Inspect console and network activity after each scenario. Capture traces and
   screenshots when they materially explain a result or finding.

Prefer visible product actions over store calls. Direct store or lifecycle
harness actions are valid only when the slice explicitly defines a test-only
browser boundary for a state that cannot be made deterministic through ordinary
interaction.

## Complete Authenticated Chrome Clone

Use this procedure only when acceptance depends on Daniel's existing signed-in
Chrome state, such as authenticated Sentry Logs, Trace Explorer, Issues, or
Replay inspection, and Daniel has explicitly authorized the clone for that QA
run. Ordinary Azurite product cells use fresh isolated browser sessions and do
not clone Chrome.

When authorized, the clone must contain the entire on-disk Chrome user-data
root, normally `~/Library/Application Support/Google/Chrome`. Do not copy only
`Default`, one named profile, `Local State`, cookies, or selected storage. The
clone includes every profile and all available cookies and WAL files, sessions,
session restore data, local and session storage, IndexedDB, service workers,
caches, extensions, preferences, account metadata, browser metadata, and every
other file and directory present in the root. Preserve directory structure,
permissions, timestamps, extended attributes, resource forks, and other
filesystem metadata supported by the copy mechanism.

The only permitted omissions are Chrome's live `SingletonLock`,
`SingletonCookie`, and `SingletonSocket` process locks. Exclude them during the
copy or remove them only from the disposable clone before launch; never remove
them from Daniel's real Chrome root. Do not introduce any other allowlist,
exclusion pattern, privacy filter, or profile reduction.

Before launching the clone:

1. Record the source and clone aggregate byte totals plus regular-file and
   directory counts without listing filenames or reading credential values.
2. Reconcile every difference. Only the three live singleton locks and changes
   made by a still-running source Chrome process may explain a mismatch.
3. If live writes prevent a trustworthy clone, ask Daniel to close Chrome or
   authorize a controlled shutdown, then repeat the complete copy. Do not claim
   complete authenticated evidence from a knowingly partial clone.

Do not launch the clone through `playwright-cli open --persistent --profile` on
macOS. Its mock-keychain and basic-password-store flags may make the cloned
authentication unreadable. Instead:

1. Launch ordinary Google Chrome with the disposable root as
   `--user-data-dir` and `--remote-debugging-port=0`.
2. Read the local endpoint from the clone's `DevToolsActivePort` file and attach
   the Playwright CLI over CDP.
3. Inspect only the authenticated surfaces required by the QA plan. Never print
   cookie values, session tokens, authorization headers, DSNs, passwords, or
   other credentials into terminal output or evidence.
4. Detach Playwright, stop the disposable Chrome process, and delete the entire
   cloned user-data root and all clone-specific artifacts immediately after the
   durable non-secret evidence is recorded.

The clone is sensitive disposable QA infrastructure. It must never enter Git,
be retained as a reusable test profile, or be treated as an Azurite fixture.

## Compact Baseline Flow

Every matrix cell must prove:

1. The app starts through the intended origin, lists the disposable notes, and
   shows no unexpected console error or warning.
2. A direct note URL, sidebar selection, Back, and Forward keep URL, rendered
   article, focused item, and `aria-current` aligned.
3. One WYSIWYG edit becomes dirty and recoverable, saves once, reaches the real
   filesystem, and survives reload.
4. One unsaved edit survives reload through IndexedDB, remains visibly
   recoverable, and can be saved or explicitly discarded according to the
   current product contract.
5. The final UI status, Zustand-owned session state, IndexedDB record, API
   result, and disk content tell the same story.
6. Desktop controls remain usable and the Pixel 6 page has no horizontal
   overflow; responsive and touch-specific behavior matches the active slice.
7. Fastify remains on loopback and browser API traffic succeeds through the
   frontend proxy.

## Reusable Scenario Catalogue

Select additional scenarios from this catalogue according to the slice's
changed behavior and guardrails:

| Scenario                             | Truth to prove                                                                                                          | Default selection when unchanged                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Pristine open and mode round trip    | Editor readiness or projection does not invent dirty state, drafts, saves, or disk changes.                             | Production desktop and Pixel 6.                                                 |
| External-write conflict              | Disk truth is not overwritten; the latest browser draft remains recoverable and discard returns to disk truth.          | Production desktop and Pixel 6.                                                 |
| Edit during save                     | Save settlement advances only its owned baseline and cannot replace newer editor intent or destroy the live session.    | One deterministic desktop cell plus any device/runtime implicated by the slice. |
| Rapid selection or overlapping reads | Stale completion cannot replace the current note, URL, focus, editor session, or correlation identity.                  | One deterministic desktop cell plus any history cell named by the slice.        |
| Missing note and traversal-like URL  | Safe routing and API boundaries expose no save action or unsafe filesystem request.                                     | Production desktop and Pixel 6.                                                 |
| Backend unavailable                  | Selection attempts, retry behavior, and recovery copy remain honest without duplicate or destructive state transitions. | One development cell unless resilience behavior changes.                        |
| Browser lifecycle                    | Supported visibility, page-hide, reload, and navigation boundaries commit or recover the latest accepted intent.        | Devices and runtimes named by the active editor slice.                          |
| Observability enabled                | Expected events, headers, envelopes, Replay, logs, and web/server joins exist without changing the product result.      | All relevant cells when observability changes.                                  |
| Observability disabled               | Correlation and product behavior remain while SDK traffic and tracing headers are absent.                               | All relevant cells when observability or fail-open behavior changes.            |

When a catalogue scenario becomes a named slice guardrail, its slice plan wins
over the default selection and expands it to every relevant matrix cell.

## Findings And Scope Re-Selection

Record every unexpected behavior before deciding its disposition. For each
finding, capture:

- severity and user-visible failure;
- exact runtime, device, fixture, and reproduction sequence;
- URL, UI state, IndexedDB state, request/response, and disk evidence relevant
  to the failure;
- whether it reproduces on the pre-slice baseline when regression ownership is
  uncertain; and
- disposition under the working agreement's scope re-selection rule.

Do not silently add a new capability, workflow, state owner, storage boundary,
or independently useful outcome to the current slice. Prove why it is required
for the current user story or create and order a separate slice.

## Evolving This Runbook

This is the living procedure. Update it when a completed QA run establishes a
repeatable improvement to setup, evidence, scenario selection, or cleanup.

- Add a scenario when it protects a recurring product risk that requires a real
  browser.
- Move deterministic behavior into Vitest, but retain the smallest browser
  proof needed for rendering, lifecycle, browser storage, proxy, or layout.
- Remove or narrow a scenario only when another proof owns the same product
  truth; explain that ownership in the change.
- Keep slice-specific fixtures, identifiers, dates, results, and findings in the
  slice QA record rather than accumulating history here.
- Do not turn current CLI snippets into a committed Playwright test suite until
  repeated slice evidence justifies a reusable harness and defines its stable
  ownership boundary.

## Shutdown And Evidence Record

1. Close every Playwright session.
2. Stop Vite or preview and Fastify gracefully.
3. Verify ports `3000`, `5173`, and `4173` are free.
4. Delete the disposable cluster, browser profiles, complete Chrome clone, and
   temporary artifacts after durable evidence has been recorded.
5. Confirm no credential, cookie, token, DSN, authorization header, or real note
   content entered Git or the QA record.
6. Record the chosen matrix cells, scenario coverage, fixture hashes where
   relevant, console/network findings, filesystem results, and any Sentry proof
   in `docs/qa/`.
7. Run the slice's final automated validation and confirm the repository is
   clean, on `main`, and synchronized with `origin/main`.
