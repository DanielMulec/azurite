# `<Slice Or Workflow>` QA Evidence

## Status

- Completion decision: **Pending**.
- QA date and timezone: `<YYYY-MM-DD, timezone>`.
- Repository commit: `<full SHA>`.
- Scope: `<changed behavior and preserved guardrails>`.
- Active plan or authoritative contract: `<relative link>`.
- Sentry impact classification: `<classification from the Playwright runbook>`.

Use one final decision:

- `Passed`: every selected cell passed, findings are dispositioned, cleanup and
  automated validation passed.
- `Failed`: product behavior or a required preservation guarantee failed.
- `Blocked`: setup or a missing deterministic seam prevented honest completion.

`Blocked` and incomplete evidence never count as `Passed`.

## Environment And Run Ownership

Do not record credential values, authentication data, DSNs, authorization
headers, or real note content. Disposable fixture content and non-secret QA
identifiers may be recorded when they prove behavior.

| Item                         | Recorded value                                  |
| ---------------------------- | ----------------------------------------------- |
| Repository status before QA  | `<clean/dirty and preserved unrelated paths>`   |
| Commit                       | `<full SHA>`                                    |
| Operating system             | `<version>`                                     |
| Node                         | `<version>`                                     |
| pnpm                         | `<version>`                                     |
| Playwright CLI               | `<version>`                                     |
| Browser channel and version  | `<channel and actual version/user agent>`       |
| `QA_RUN_ID`                  | `<value>`                                       |
| `QA_ROOT`                    | `<owned path>`                                  |
| `ARTIFACT_ROOT`              | `<owned path>`                                  |
| Fastify PID and address      | `<PID, 127.0.0.1:3000>`                         |
| Frontend PID and origin      | `<PID and exact origin>`                        |
| Disposable cluster paths     | `<owned paths>`                                 |
| Disposable cluster IDs       | `<IDs>`                                         |
| Sentinel fixtures            | `<unique filenames>`                            |
| Playwright sessions          | `<owned session names>`                         |
| Sentry mode and release      | `<disabled or enabled non-secret labels>`       |
| Supplemental authorized data | `<none or complete Chrome-clone authorization>` |

Confirm before the first browser write:

- [ ] Ports `3000`, `5173`, and `4173` were free before startup.
- [ ] Every runtime PID and listening address belongs to this run.
- [ ] `/health`, `/api/notes`, and the selected frontend origin responded.
- [ ] `/api/notes` exposed the expected sentinel and no foreign fixtures.
- [ ] Fastify remained loopback-only.

## Fixture Manifest

Use one fresh disposable cluster or a verified restored manifest for each
stateful cell.

| Cell     | Fixture  | Purpose      | Initial bytes | Initial SHA-256 | Final bytes | Final SHA-256 | No-write or write evidence                                  |
| -------- | -------- | ------------ | ------------: | --------------- | ----------: | ------------- | ----------------------------------------------------------- |
| `<cell>` | `<file>` | `<scenario>` |     `<count>` | `<hash>`        |   `<count>` | `<hash>`      | `<zero PUTs, exact PUT count, stat, or operation evidence>` |

For a no-write claim, an unchanged final hash is necessary but insufficient on
its own. Record zero write requests or another exact signal that a same-byte
rewrite did not occur.

## Coverage Selection

Plan this table before opening the browser. Use `SELECTED` or `NOT_SELECTED` in
each cell and give every exclusion a concrete reason.

| Scenario     | Changed behavior or guardrail | Development desktop | Built-preview desktop | Development Pixel 6 | Built-preview Pixel 6 | Sentry dimension                    | Evidence method                     | Exclusion rationale |
| ------------ | ----------------------------- | ------------------- | --------------------- | ------------------- | --------------------- | ----------------------------------- | ----------------------------------- | ------------------- |
| `<scenario>` | `<contract>`                  | `<status>`          | `<status>`            | `<status>`          | `<status>`            | `<enabled/disabled/not applicable>` | `<UI/request/IndexedDB/disk/trace>` | `<reason>`          |

## Scenario Results

Use only `PASS`, `FAIL`, `BLOCKED`, or `NOT_SELECTED`. Record the first failed
attempt before diagnostic reruns; do not replace it with the eventual green run.

| Scenario     | Cell     | Attempt | Expected            | Actual              | Evidence                                             | Result     |
| ------------ | -------- | ------: | ------------------- | ------------------- | ---------------------------------------------------- | ---------- |
| `<scenario>` | `<cell>` |     `1` | `<exact assertion>` | `<observed result>` | `<artifact, request, state, or filesystem evidence>` | `<result>` |

For an adversarial timing or failure scenario, add a focused subsection:

### `<Scenario Name>`

- Participating layer: `<browser/editor/store/IndexedDB/API/server/filesystem>`.
- Deterministic seam: `<reviewed test-only or external control>`.
- State before activation: `<evidence>`.
- Held or failed event: `<exact event and ordering>`.
- State while active: `<evidence>`.
- Release and settlement: `<evidence>`.
- Restoration: `<how the seam was removed>`.
- Post-restoration baseline: `<result>`.
- Real-layer proof: `<unmodified response, storage, and filesystem participation>`.
- Trace or artifact: `<ignored local artifact path or durable non-secret fact>`.

## Console And Request Evidence

| Cell and scenario | Console result | Request count and methods | Expected failure responses    | Unexpected behavior    |
| ----------------- | -------------- | ------------------------- | ----------------------------- | ---------------------- |
| `<cell/scenario>` | `<result>`     | `<exact counts>`          | `<none or exact status/code>` | `<none or finding ID>` |

Expected `404`, `409`, or unavailable responses must be tied to a selected
scenario. They do not authorize ignoring unrelated console errors, warnings,
failed requests, or unhandled rejections.

## Browser And Device Evidence

For each Pixel 6 cell, record:

- Android Chrome user agent and actual browser version;
- `412` by `839` CSS viewport and `412` by `915` CSS screen;
- device scale factor `2.625`;
- touch support, coarse pointer, and no hover;
- absence or measured presence of horizontal overflow; and
- which interactions used actual Playwright `tap()` rather than mouse-style
  `click`.

Record screenshots or traces only when they materially prove or explain a result.
The durable QA record must state the fact those disposable artifacts established.

## Findings And Scope Disposition

| ID     | Severity     | User-visible failure | Reproduction             | Pre-slice baseline                       | Disposition and authoritative owner                                |
| ------ | ------------ | -------------------- | ------------------------ | ---------------------------------------- | ------------------------------------------------------------------ |
| `<ID>` | `<severity>` | `<failure>`          | `<cell, fixture, steps>` | `<reproduced/not reproduced/not needed>` | `<current slice, separate ordered slice, or resolved setup issue>` |

Apply `docs/working-agreement.md` whenever a finding adds a capability, workflow,
state owner, storage boundary, architectural foundation, or independently useful
outcome. A pre-existing defect may remain outside the current slice only after
baseline evidence proves the classification and an authoritative owner is named.

## Automated Verification

Record exact commands and results. Replace or extend these commands only when the
active slice defines a different verification boundary.

```text
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

- Test totals or focused cases: `<results>`.
- Existing warnings: `<exact known warnings>`.
- New warnings or weakened validation: `<none, or finding>`.

## Cleanup Ledger

Delete or stop only resources recorded as owned by this run.

| Owned resource          | Identifier or path           | Cleanup action                                          | Result     |
| ----------------------- | ---------------------------- | ------------------------------------------------------- | ---------- |
| Playwright session      | `<name>`                     | `close and delete owned data`                           | `<result>` |
| Fastify process         | `<PID>`                      | `graceful stop`                                         | `<result>` |
| Frontend process        | `<PID>`                      | `graceful stop`                                         | `<result>` |
| Disposable cluster      | `<path under QA_ROOT>`       | `delete`                                                | `<result>` |
| Browser or Chrome clone | `<owned path>`               | `stop, detach, and delete`                              | `<result>` |
| Playwright artifacts    | `<path under ARTIFACT_ROOT>` | `<retain temporarily or delete after durable evidence>` | `<result>` |

Confirm:

- [ ] Every owned browser session is closed.
- [ ] Every owned runtime PID exited gracefully.
- [ ] Ports `3000`, `5173`, and `4173` are free.
- [ ] Every disposable cluster and sensitive browser clone is deleted.
- [ ] No unrelated process, session, profile, path, or artifact was changed.
- [ ] No credential or real note content entered Git or this record.

## Completion Gate

- [ ] Every selected matrix cell is `PASS`.
- [ ] Every changed behavior and preserved guardrail has required evidence.
- [ ] The declared Sentry impact classification is supported by the diff and
      every required enabled or disabled cell passed.
- [ ] Every finding has an explicit disposition and authoritative owner.
- [ ] No `BLOCKED`, omitted, or inconclusive result is counted as passing.
- [ ] Automated verification and build pass.
- [ ] Cleanup is complete.
- [ ] The repository is clean on `main` and synchronized with `origin/main` after
      successful writes.

Final decision: **`<Passed, Failed, Or Blocked>`**.
