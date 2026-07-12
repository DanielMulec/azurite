# Playwright Browser Acceptance

## Purpose

Operate and evolve Azurite's repeatable real-browser acceptance workflow. This
runbook defines the stable matrix, participating product layers, reusable scenario
catalogue, evidence rules, and cleanup procedure. A slice plan selects the
behavior it changes and the guardrails it must preserve; its `docs/qa/` record
captures the run-specific fixtures, results, findings, and exact evidence.

This is an operational QA procedure, not a supported-browser product policy and
not a replacement for deterministic Vitest coverage. The completed Slice 7B
record in `docs/qa/slice-7b-request-correlation.md` is the seed evidence for
this runbook and remains historical rather than becoming a mutable checklist.

Use `docs/qa/template.md` for new slice or workflow evidence records. Historical
records remain immutable evidence and do not need to be reshaped to match the
latest template.

## Full-Stack Evidence Boundary

Playwright acts through the rendered product, so it exercises state management
indirectly but genuinely. Seeing the expected DOM alone is insufficient. The
current ownership contract lives in `docs/technical-architecture.md`; a slice's
approved but unimplemented behavior remains authoritative in that active slice
until completion updates the durable architecture.

| Participating layer                 | Implemented baseline exercised by the browser                                                                  | Acceptance evidence                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chrome, React, and Milkdown/Crepe   | Rendered editor, controls, selection, input, mode presentation, and responsive interaction                     | Visible content and controls match current architecture plus the active slice; interaction causes the expected product state. |
| TanStack Router and browser history | URL-owned note navigation, typed search state, Back/Forward, and replace-versus-push behavior                  | URL, rendered state, focus, and `aria-current` satisfy the current navigation contract and selected slice guardrails.         |
| Zustand note-browser store          | Selected note plus current in-memory editor, save, conflict, recovery, and request-sequencing state            | Product-visible status and controls reflect the latest accepted intent; stale work cannot replace newer state.                |
| Editor integration                  | The current React-owned Milkdown/Crepe lifetime and WYSIWYG/Markdown interaction surface                       | Editor lifecycle and mode transitions preserve the guarantees already implemented plus the active slice's acceptance targets. |
| Dexie and IndexedDB                 | Cluster-scoped durable browser recovery state                                                                  | Draft creation, absence, recovery, reconciliation, and deletion match user-visible state after reload.                        |
| Web API client and Vite proxy       | Validated relative browser traffic to the loopback Fastify API                                                 | Requests preserve required contracts and receive real Fastify responses without API-response mocks.                           |
| Fastify routes and request context  | API validation, safe results, request context, and the local network boundary                                  | Expected status and response shapes arrive through the proxy while Fastify remains loopback-only.                             |
| Core domain and filesystem          | Safe note resolution, canonical Markdown files, hashes, conflicts, and current write guarantees                | Disposable files contain expected bytes after save and remain unchanged after clean or rejected operations.                   |
| Sentry debug runtime, when selected | Implemented cross-runtime errors, logs, traces, Replay, and browser/server joins behind explicit configuration | Enabled evidence is diagnostically complete; disabled mode cannot change product behavior or emit Sentry traffic.             |

The runbook must not promote an active slice's planned controller, state owner,
storage boundary, or failure semantics into implemented product truth. The slice
owns its new acceptance assertions. After the slice passes, update technical
architecture first and then evolve this operational evidence map if the completed
behavior changes the repeatable browser workflow.

## Safety And Prerequisites

- Inspect `git status --short --branch` before QA and preserve unrelated work.
- Use a unique disposable Markdown cluster for each stateful matrix cell. Never
  open or write Daniel's real cluster for acceptance testing.
- Keep Fastify on `127.0.0.1:3000`. Routine Pixel 6 acceptance uses the Vite
  proxy and does not require a Tailscale bind.
- Run cells sequentially while they share fixed local ports. Parallel execution
  requires a separately reviewed port and proxy-isolation procedure.
- Use fresh named browser sessions and dedicated fixtures for cells that write,
  conflict, or persist drafts.
- Keep generated screenshots, traces, snapshots, and profiles under
  `output/playwright/<QA_RUN_ID>/`; this path is ignored by Git.
- Do not mock API responses. Follow the deterministic fault-injection contract
  below when a slice must prove ordering or failure behavior.
- Run the slice's automated verification before final browser acceptance. Move
  every stable, deterministic browser discovery into Vitest when it can be
  proved without weakening the real-browser assertion.
- Use authenticated Chrome data only when Daniel explicitly authorizes Sentry
  dashboard inspection. Follow the complete-clone procedure below and
  `docs/runbooks/sentry-debug.md`; a selected profile, cookies-only copy, or
  Playwright-created profile is not an acceptable substitute.

The Codex Playwright CLI wrapper depends on `npx`. Check it first:

```sh
command -v npx >/dev/null 2>&1
```

If that fails, pause and ask Daniel to install Node.js/npm. Use these exact
verification and installation steps:

```sh
# Verify Node/npm are installed
node --version
npm --version

# If missing, install Node.js/npm, then:
npm install -g @playwright/cli@latest
playwright-cli --help
```

When `npx` exists, configure the wrapper and capture the toolchain used by the
QA record:

```sh
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" --help
"$PWCLI" --version
node --version
/opt/homebrew/bin/pnpm --version
git rev-parse HEAD
```

Use the wrapper even when Playwright is not a repository dependency. Do not add
`@playwright/test` merely to perform slice acceptance.

### Fail-Closed Port And Run Ownership

Before creating fixtures or starting a runtime, prove that the fixed QA ports
are free:

```sh
for port in 3000 5173 4173; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null; then
    echo "Port $port is already owned; stop and identify that process." >&2
    exit 1
  fi
done
```

Do not kill, reuse, or assume ownership of an existing listener. If a port is
occupied, stop the QA run until Daniel or the owning workflow resolves it.

Create one owned root for the run from the repository root:

```sh
export REPO_ROOT="$(git rev-parse --show-toplevel)"
export QA_RUN_ID="<slice>-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
export QA_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/azurite-${QA_RUN_ID}.XXXXXX")"
export ARTIFACT_ROOT="$REPO_ROOT/output/playwright/$QA_RUN_ID"
mkdir -p "$ARTIFACT_ROOT"
```

Record `QA_RUN_ID`, `QA_ROOT`, every disposable cluster path, browser session
name, artifact directory, runtime PID, and actual listening origin in the QA
record. These recorded values are the complete cleanup allowlist. Never delete
or stop a path, profile, session, or process merely because its name resembles an
Azurite QA resource.

## Permanent Runtime And Device Matrix

The stable baseline contains four cells:

| Runtime            | Device         | Default origin          |
| ------------------ | -------------- | ----------------------- |
| Vite development   | Desktop Chrome | `http://127.0.0.1:5173` |
| Built Vite preview | Desktop Chrome | `http://127.0.0.1:4173` |
| Vite development   | Pixel 6        | `http://127.0.0.1:5173` |
| Built Vite preview | Pixel 6        | `http://127.0.0.1:4173` |

The changed behavior and every preserved guardrail named by the active slice
must run in every relevant matrix cell. Each cell also receives the compact
baseline flow below. Specialized destructive or fault-injection scenarios may
run in fewer cells when the slice does not touch that boundary; the QA record
must name the selected cells and the concrete reason.

Plan coverage before opening a browser. In the QA record, give every scenario a
row with its changed behavior or guardrail, selected cells, evidence method, and
reason for each unselected cell. `Relevant` is not a post-run judgment used to
excuse missing evidence.

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

The built-preview cells prove behavior in the optimized web bundle served by
Vite preview. They do not claim to exercise Azurite's future production asset
server, packaging, installation, update, compression, or cache policy.

## Start Disposable Runtimes

Prepare a fresh cluster under `QA_ROOT` with purpose-built fixtures for the
selected cell. Include a unique sentinel filename so `/api/notes` can prove that
the browser-facing runtime opened this disposable cluster rather than another
Azurite process. Record the cluster ID, initial filenames, exact disposable
content, byte lengths, and SHA-256 hashes when fidelity or persistence is under
test.

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

For a built Vite preview, build first and then start preview:

```sh
VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= \
VITE_SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm build

VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= \
VITE_SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/web preview
```

Use the root `.env.local` procedure in `docs/runbooks/sentry-debug.md` for
enabled cells. Build a separate web bundle for each enabled or disabled
built-preview dimension. Environment values consumed by Vite must be present
during the build; preview-time overrides cannot change values already embedded
in the bundle.

After each process starts:

1. Record the PID that owns its listening port and confirm its command belongs to
   this run.
2. Confirm Fastify listens only on `127.0.0.1:3000` and the frontend uses exactly
   its planned origin. A runtime that silently selected another port fails setup.
3. Verify `/health`, `/api/notes`, and the frontend origin.
4. Confirm `/api/notes` includes the cell's unique sentinel and excludes fixtures
   from other cells or real clusters.
5. For a disabled cell, verify the diagnostics surface and Sentry envelope
   traffic are absent. For an enabled cell, follow the exact proof in
   `docs/runbooks/sentry-debug.md`.

Do not begin browser writes until every setup assertion passes.

## Open And Drive Browser Cells

Run each cell from its own artifact directory and use a session name derived from
the recorded `QA_RUN_ID`, runtime, device, and Sentry mode. List existing sessions
first so the cleanup ledger cannot claim a session owned by another workflow.
For example:

```sh
"$PWCLI" list
export CELL="<runtime>-<device>-<sentry-mode>"
export PW_SESSION="${QA_RUN_ID}-${CELL}"
mkdir -p "$ARTIFACT_ROOT/$CELL"
cd "$ARTIFACT_ROOT/$CELL"

"$PWCLI" --session "$PW_SESSION" open <origin> --browser chrome --headed
"$PWCLI" --session "$PW_SESSION" snapshot
```

For Pixel 6:

```sh
"$PWCLI" --session "$PW_SESSION" open <origin> \
  --browser chrome --device "Pixel 6" --headed
"$PWCLI" --session "$PW_SESSION" snapshot
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
5. Use the current CLI's `requests` command and targeted `request` inspection for
   network evidence. Record exact counts and expected status codes rather than
   relying on a screenshot of the final UI.
6. Inspect console and request activity after each scenario. Capture traces and
   screenshots when they materially explain a result or finding.

Pixel 6 emulation enables touch capability, but ordinary CLI `click` still uses a
mouse-style pointer. A scenario that claims touch-specific acceptance must use a
real Playwright tap through the CLI's function-form `run-code` boundary:

```sh
"$PWCLI" --session "$PW_SESSION" run-code \
  'async (page) => { await page.getByRole("button", { name: "Save" }).tap(); }'
```

Use a fresh semantic locator for the intended control and record which mobile
scenarios used touch actions. Responsive layout checks that do not claim touch
behavior may continue to use ordinary semantic `click` actions.

Prefer visible product actions over store calls. Direct store or lifecycle
harness actions are valid only when the slice explicitly defines a test-only
browser boundary for a state that cannot be made deterministic through ordinary
interaction.

## Deterministic Fault Injection

Fault injection must prove an exact product ordering or failure contract without
turning the browser run into a mocked application. Before using a delay, failure,
throttle, lifecycle harness, or direct internal action, the active slice must
define:

- the participating layer and exact event being delayed or failed;
- the state expected before activation, while held, after release, and after
  restoration;
- the test-only seam or external control that creates the condition;
- why ordinary product interaction cannot make the condition deterministic; and
- the evidence proving the real browser, API, storage, and filesystem layers
  still participated where the scenario claims they did.

Apply these shared rules:

1. Never replace an API response body, status, or headers with `route.fulfill` or
   an equivalent mock. A request delayed before Fastify runs proves a different
   ordering from a response held after server work; name the one being tested.
2. A specialized fault switch or lifecycle seam must be explicitly owned by the
   active slice, excluded from normal product builds, and absent from ordinary
   product routes unless the slice proves another stable boundary is required.
3. Do not monkeypatch Zustand, Dexie, editor runtime objects, or browser globals
   to force product state unless the active slice defines that exact test-only
   boundary and its cleanup semantics.
4. Start a trace before an adversarial timing sequence when action ordering is
   material. Record activation, release, restoration, and the unmodified real
   response or persistence result.
5. Restore the fault before continuing and rerun the smallest normal baseline
   that proves the runtime was not left degraded.

If the required deterministic seam does not exist, stop browser QA and return the
decision to the active slice. Do not invent architecture inside the runbook or
improvise a hidden production switch during acceptance.

## Evidence And Outcome Contract

Use the least invasive evidence that proves the selected product truth:

1. Start with product-visible controls, status, content, URL, focus, and semantic
   snapshots.
2. Inspect exact browser request counts, methods, status codes, and required
   headers through the Playwright CLI. Expected `404`, `409`, or unavailable
   responses must be named by the scenario; they are not blanket permission to
   ignore console or network failures.
3. Use read-only evaluation for facts that have no honest visible projection,
   such as device metrics, horizontal overflow, IndexedDB records, or a DOM
   instance count.
4. Use a mutation-capable internal harness only when the active slice explicitly
   owns that test boundary under the fault-injection contract above.
5. Compare disposable filesystem bytes and hashes before and after persistence
   scenarios. When acceptance claims no write occurred, also prove zero write
   requests or capture another exact write-operation signal; an unchanged hash
   alone cannot detect a same-byte rewrite.

Every planned scenario and matrix cell receives one result:

- `PASS`: all assertions passed with the required evidence;
- `FAIL`: product behavior or a preservation guarantee did not match;
- `BLOCKED`: setup or an unavailable deterministic seam prevented an honest run;
  or
- `NOT_SELECTED`: the pre-run coverage plan excluded the cell for a recorded
  reason.

Do not silently rerun a failure until it turns green. Record the first failure,
attempt number, any diagnostic reruns, and the reason a later result differs. A
slice may pass only when every selected cell is `PASS`, every unexpected finding
has a disposition, no unresolved finding belongs to the current user story or a
named guardrail, and final automated validation passes.

A pre-existing defect may remain outside the slice only after baseline evidence
proves that classification and the working agreement's scope re-selection rule
gives it an authoritative owner. `BLOCKED`, omitted, or inconclusive evidence
never counts as a pass.

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
5. The final UI status, any slice-required read-only state evidence, IndexedDB
   record, API result, and disk content tell the same story.
6. Desktop controls remain usable and the Pixel 6 page has no horizontal
   overflow; responsive behavior matches the active slice, and any claimed
   touch-specific behavior used an actual touch action.
7. Fastify remains on loopback and browser API traffic succeeds through the
   frontend proxy.

## Reusable Scenario Catalogue

Select additional scenarios from this catalogue according to the slice's
changed behavior and guardrails:

| Scenario                             | Truth to prove                                                                                                          | Default selection when unchanged                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Pristine open and mode round trip    | Editor readiness or projection does not invent dirty state, drafts, saves, or disk changes.                             | Built-preview desktop and Pixel 6.                                              |
| External-write conflict              | Disk truth is not overwritten; the latest browser draft remains recoverable and discard returns to disk truth.          | Built-preview desktop and Pixel 6.                                              |
| Edit during save                     | Save settlement advances only its owned baseline and cannot replace newer editor intent or destroy the live session.    | One deterministic desktop cell plus any device/runtime implicated by the slice. |
| Rapid selection or overlapping reads | Stale completion cannot replace the current note, URL, focus, editor session, or correlation identity.                  | One deterministic desktop cell plus any history cell named by the slice.        |
| Missing note and traversal-like URL  | Safe routing and API boundaries expose no save action or unsafe filesystem request.                                     | Built-preview desktop and Pixel 6.                                              |
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

When a reviewed slice implements one of these product capabilities, extend the
runbook and scenario catalogue with the corresponding evidence boundary. This is
an evolution trigger, not approval of unselected architecture:

| Implemented capability                         | Browser-acceptance extension to define                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| PWA service worker or offline behavior         | Installability, update, offline/reconnect, reload, and tab-discard behavior                  |
| Multi-tab or multi-client editing              | Isolated browser contexts, concurrent authority, conflict, and recovery                      |
| Cluster opening, switching, copying, or moving | Cluster-ID isolation, selected-cluster coherence, recovery, and safe filesystem ownership    |
| File watching, indexing, or search             | External-change propagation, rebuild/corruption recovery, corpus fixtures, and measured flow |
| Authentication or hardened Tailscale hosting   | Authentication, origin/CSRF, session cleanup, proxy behavior, and backend isolation          |
| A broader supported-browser decision           | Explicit browser/channel cells and cross-browser exclusions                                  |
| Accessibility-sensitive interaction            | Keyboard operation, focus order, semantics, zoom/reflow, and actual touch actions            |
| Performance or editor-loading work             | Repeatable cold-run measurement separate from headed exploratory QA                          |

## Shutdown And Evidence Record

1. Close and delete data only for the Playwright sessions recorded as owned by
   this `QA_RUN_ID`. Never use `close-all` or `kill-all` when another workflow may
   own a session.
2. Stop only the recorded Vite or preview and Fastify PIDs gracefully. Do not
   search by process name and terminate unrelated Azurite or Node processes.
3. Verify the owned PIDs exited and ports `3000`, `5173`, and `4173` are free.
   Because preflight required free ports, any remaining listener is a failed
   cleanup condition, not a process the run may kill automatically.
4. Delete only the disposable clusters, browser profiles, complete Chrome clone,
   and temporary artifacts listed in the run's cleanup allowlist after durable
   evidence has been recorded. Validate each path is inside the recorded
   `QA_ROOT` or `ARTIFACT_ROOT` before deletion.
5. Confirm no credential, cookie, token, DSN, authorization header, or real note
   content entered Git or the QA record.
6. Complete the coverage table, scenario results, findings, fixture manifest,
   console/request evidence, filesystem results, owned-resource cleanup ledger,
   and any Sentry proof in the `docs/qa/` record.
7. Run the slice's final automated validation and confirm the repository is
   clean, on `main`, and synchronized with `origin/main`.
