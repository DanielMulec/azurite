# Post-StrictMode Sentry Fail-Open Carrier QA

## Outcome

Task 3E passed implementation and internal candidate verification on 2026-07-15.
Web and server now delegate runtime record, capture, and span delivery to one
stateless Sentry-free carrier in `packages/shared`. Both surfaces retain their
caller-facing function names, independent runtime installation state, and
surface-specific configuration, SDK initialization, integrations, enablement,
flush, and shutdown authorities.

The authoritative start is
`3d98cc9fca31a86c2c2b846e8cb346400e647ecf`. The final implementation commit
is `ad1943755c68031d64afe8b70fa0c1cfe37ce9cd`; the exact implementation range
is `3d98cc9fca31a86c2c2b846e8cb346400e647ecf..ad1943755c68031d64afe8b70fa0c1cfe37ce9cd`.
Task 3E remains a candidate awaiting separate independent conformance review.

## Delivered Boundary

- `packages/shared/src/fail-open-runtime-carrier.ts` owns the single record,
  capture, adapter-level span-selection, attribute-filtering, scope/tag/context,
  caught-error-normalization, and best-effort isolation decisions.
- Its input contains only `addBreadcrumb`, `captureException`, structured
  logger, `startSpan`, and `withScope` callbacks plus current environment and
  release strings. The package imports no Sentry SDK.
- `runFailOpenRuntimeCarrierSpan` delegates callback settlement to the existing
  singular `runFailOpenRuntimeSpan` executor. Callback identity, exact count,
  return value, synchronous throw, rejection, late invocation, and hostile
  carrier behavior therefore retain one implementation.
- `recordWebRuntimeEvent`, `captureWebRuntimeError`,
  `runWebRuntimeSpan`, `recordServerRuntimeEvent`,
  `captureServerRuntimeError`, and `runServerRuntimeSpan` remain thin local
  facades.
- Web and server retain exactly two independent active runtime states. Server
  enabled-state query, actual SDK flush delegation, and all shutdown budgets
  remain local.
- Web configuration, enabled-only React SDK import and initialization, Replay,
  browser tracing, console capture, and trace-propagation targets are unchanged.
- Server configuration, enabled-only Node SDK preload, Fastify integration, and
  lifecycle sequencing are unchanged.
- Semantic event names, messages, attributes, tags, contexts, span names,
  operations, request IDs, note-operation IDs, natural instrumentation, and
  uncensored debug behavior are unchanged. React and Node Sentry SDKs remain
  pinned at 10.64.0.

No dependency, framework, configuration owner, shared mutable state, service
container, storage boundary, product state, semantic instrumentation, QA hook,
build variant, or `packages/core` change was introduced. Slice 7E remains
unapproved, unrefreshed, unpromoted, and unimplemented.

## Structural Measurements

Physical production lines were measured with `wc -l`. The affected envelope
includes the pre-existing shared exact-once seam and every new or replacement
carrier file.

| Path                                                            | Before | After |
| --------------------------------------------------------------- | -----: | ----: |
| `packages/shared/src/runtime-observability.ts`                  |    287 |   287 |
| `packages/shared/src/fail-open-runtime-carrier.ts`              |      0 |   315 |
| `apps/web/src/observability/web-runtime-observability.ts`       |    299 |    59 |
| `apps/server/src/observability/server-runtime-observability.ts` |    314 |    79 |
| Total affected production envelope                              |    900 |   740 |

The envelope fell by 160 lines. Every production file remains at or below the
400-line limit. The raw adapter comparison changed from 277 ordered common
lines with 37 additions and 22 deletions to 42 ordered common lines with 37
additions and 17 deletions.

| Structural decision                | Before | After |
| ---------------------------------- | -----: | ----: |
| Record decision trees              |      2 |     1 |
| Capture decision trees             |      2 |     1 |
| Adapter-level span-selection trees |      2 |     1 |
| Exact-once span executors          |      1 |     1 |
| Legitimate product authorities     |      7 |     7 |
| Local runtime-state owners         |      2 |     2 |

Search and review found no renamed, relocated, wrapped, or newly duplicated
branch tree. Production record, capture, span, installation, enablement, and
flush entry points remain live. Runtime reset functions retain their existing
test-only callers.

## Automated Verification

The focused baseline was 18 files and 82 tests: shared 1/10, web 7/33, and
server 10/39. Common carrier behavior moved to one shared suite and
surface-specific tests became installation, enablement, and flush proof. The
completed focused suite is 19 files and 87 tests: shared 2/20, web 7/30, and
server 10/37.

Focused proof covers:

- direct disabled record and capture no-ops on web and server;
- exact once-only structured log, breadcrumb, exception, and span delivery;
- undefined record-attribute and null/undefined span-attribute filtering;
- non-`Error` normalization, string and number error codes, stack preservation,
  unsupported error-code omission, and absent-stack handling;
- scope failure before callback with exact fallback parity, and scope failure
  after callback without duplicate fallback delivery;
- synchronous value/throw, promise fulfillment/rejection, late carrier
  invocation, and hostile carrier settlement through the singular executor;
- usable delivery after web runtime installation and server preload;
- actual `flushServerSentry` delegation, disabled flush behavior, and retained
  configuration, correlation, initialization, and production-gate contracts.

| Verification                      | Result                     |
| --------------------------------- | -------------------------- |
| Exact focused suite               | PASS, 19 files / 87 tests  |
| `/opt/homebrew/bin/pnpm validate` | PASS, 78 files / 469 tests |
| `/opt/homebrew/bin/pnpm build`    | PASS                       |
| Formatting and governance         | PASS                       |
| ESLint and TypeScript             | PASS                       |
| Production 400-line limit         | PASS                       |
| `git diff --check`                | PASS                       |

The first full validation attempt stopped during setup because a protected,
pre-existing ignored `apps/web/dist` was temporarily visible to the repository
line scanner. It contained old generated bundles and was never modified. The
directory was parked byte-for-byte, validation then passed, and the original
197 files, 3 directories, and 7,199,238 logical bytes were restored after final
verification. Existing jsdom `scrollTo` warnings and the Vite large-chunk
warning remained informational.

## Eight-Cell Browser And Sentry Matrix

Each cell used a unique cluster, release/cell identity, Playwright session, and
cleanup ledger. Enabled and disabled preview cells were separately compiled
because Vite embeds Sentry configuration during compilation.

Every cell exercised direct note selection, sidebar selection, Back, Forward,
Markdown editing, one durable browser draft, reload recovery, exactly one
successful Save, clean reload, a second durable edit, external disk overwrite,
exactly one expected-conflict Save, retained browser intent, and confirmed
Discard back to the external disk value.

Every cell produced exactly 12 product requests and operations:

- 3 note-list GETs;
- 7 note-content GETs;
- 1 Save PUT returning `200`;
- 1 Save PUT returning the expected `409`.

After the first edit, IndexedDB contained exactly one draft. Reload recovered
that exact draft. Successful Save reduced the count to zero. The external-edit
conflict retained exactly one draft and visible browser intent. Confirmed
Discard restored the external bytes, cleared the draft count to zero, left the
route/sidebar/article coherent, and returned the clean Save state. The direct
note and sentinel remained byte-identical.

| Cell                                    | Result | Cluster ID                             |                                   Sentry envelopes | Trace headers |
| --------------------------------------- | ------ | -------------------------------------- | -------------------------------------------------: | ------------- |
| Vite dev, Desktop Chrome, disabled      | PASS   | `ee46f752-cc53-46c8-8c46-11fa213a16fd` |                                                  0 | absent        |
| Vite dev, Desktop Chrome, enabled       | PASS   | `14557351-1278-417a-af1f-041aca81a5f0` |                                 30 / 30 successful | present       |
| Vite dev, Pixel 6, disabled             | PASS   | `166d2686-2ff5-4f7e-bf6e-56cde47beaca` |                                                  0 | absent        |
| Vite dev, Pixel 6, enabled              | PASS   | `c569a9fd-fd04-47e9-bb86-fb08176be91a` | 33 successful, 1 Replay in flight at browser close | present       |
| Built preview, Desktop Chrome, disabled | PASS   | `7135a3cb-b562-4aa5-9a51-09a8b0b5f4f5` |                                                  0 | absent        |
| Built preview, Desktop Chrome, enabled  | PASS   | `e7be39de-b5c7-4e29-9373-6f6f69befc42` |                                 25 / 25 successful | present       |
| Built preview, Pixel 6, disabled        | PASS   | `3235d812-1f4d-4a0f-8675-34306b0788f5` |                                                  0 | absent        |
| Built preview, Pixel 6, enabled         | PASS   | `4edcb584-ecf0-4091-ae92-02558f0d4113` |                                 25 / 25 successful | present       |

### Run ownership and cleanup allowlist

The run used these exact owned roots and identifiers:

```text
QA_RUN_ID=task3e-20260715T071105Z-3d98cc9
QA_ROOT=/var/folders/z7/vnklz78n3954_0ljxwny2p0m0000gn/T//azurite-task3e-20260715T071105Z-3d98cc9.O7t4Yp
ARTIFACT_ROOT=/Users/danielmulec/Projekte/azurite/output/playwright/task3e-20260715T071105Z-3d98cc9
BROWSER_SESSION_PREFIX=task3e-20260715T071105Z-3d98cc9
RELEASE_PREFIX=azurite-task3e-20260715T071105Z-3d98cc9
API_ORIGIN=http://127.0.0.1:3000
DEV_ORIGIN=http://127.0.0.1:5173
PREVIEW_ORIGIN=http://127.0.0.1:4173
```

Every cell path below is rooted at the exact `QA_ROOT` and `ARTIFACT_ROOT`
above. The runtime entries include the listener PID followed by its owned
unified-exec PTY session ID. The first three listener pairs were retained
directly from `lsof`. The remaining five web PIDs were reconstructed from the
same adjacent paired-spawn sequence, independently retained Fastify PIDs, and
the exact PTY session identities. Final cleanup used the PTY sessions and
listener ports, then verified that every recorded PID had exited.

| Cell label                 | Cluster path                                     | Browser session                                   | Artifact path                            | Web runtime                            | Fastify runtime                    |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------- | ---------------------------------------- | -------------------------------------- | ---------------------------------- |
| `dev-desktop-disabled`     | `QA_ROOT/cells/dev-desktop-disabled/cluster`     | `BROWSER_SESSION_PREFIX-dev-desktop-disabled`     | `ARTIFACT_ROOT/dev-desktop-disabled`     | PID 9319, PTY 58101, `DEV_ORIGIN`      | PID 9320, PTY 87676, `API_ORIGIN`  |
| `dev-desktop-enabled`      | `QA_ROOT/cells/dev-desktop-enabled/cluster`      | `BROWSER_SESSION_PREFIX-dev-desktop-enabled`      | `ARTIFACT_ROOT/dev-desktop-enabled`      | PID 21477, PTY 59869, `DEV_ORIGIN`     | PID 21478, PTY 13646, `API_ORIGIN` |
| `dev-pixel6-disabled`      | `QA_ROOT/cells/dev-pixel6-disabled/cluster`      | `BROWSER_SESSION_PREFIX-dev-pixel6-disabled`      | `ARTIFACT_ROOT/dev-pixel6-disabled`      | PID 26223, PTY 84427, `DEV_ORIGIN`     | PID 26224, PTY 92295, `API_ORIGIN` |
| `dev-pixel6-enabled`       | `QA_ROOT/cells/dev-pixel6-enabled/cluster`       | `BROWSER_SESSION_PREFIX-dev-pixel6-enabled`       | `ARTIFACT_ROOT/dev-pixel6-enabled`       | PID 33555, PTY 67370, `DEV_ORIGIN`     | PID 33556, PTY 61440, `API_ORIGIN` |
| `preview-desktop-disabled` | `QA_ROOT/cells/preview-desktop-disabled/cluster` | `BROWSER_SESSION_PREFIX-preview-desktop-disabled` | `ARTIFACT_ROOT/preview-desktop-disabled` | PID 39429, PTY 97317, `PREVIEW_ORIGIN` | PID 39430, PTY 1603, `API_ORIGIN`  |
| `preview-desktop-enabled`  | `QA_ROOT/cells/preview-desktop-enabled/cluster`  | `BROWSER_SESSION_PREFIX-preview-desktop-enabled`  | `ARTIFACT_ROOT/preview-desktop-enabled`  | PID 43308, PTY 39312, `PREVIEW_ORIGIN` | PID 43309, PTY 55567, `API_ORIGIN` |
| `preview-pixel6-disabled`  | `QA_ROOT/cells/preview-pixel6-disabled/cluster`  | `BROWSER_SESSION_PREFIX-preview-pixel6-disabled`  | `ARTIFACT_ROOT/preview-pixel6-disabled`  | PID 47109, PTY 66920, `PREVIEW_ORIGIN` | PID 47110, PTY 40445, `API_ORIGIN` |
| `preview-pixel6-enabled`   | `QA_ROOT/cells/preview-pixel6-enabled/cluster`   | `BROWSER_SESSION_PREFIX-preview-pixel6-enabled`   | `ARTIFACT_ROOT/preview-pixel6-enabled`   | PID 50670, PTY 34458, `PREVIEW_ORIGIN` | PID 50671, PTY 73134, `API_ORIGIN` |

Each cell's exact release identity is `RELEASE_PREFIX-<cell label>`. Its three
filesystem sentinels are `00-direct-<cell label>.md`,
`10-route-<cell label>.md`, and `99-sentinel-<cell label>.md` inside that
cell's cluster. Each cluster also owned its `.azurite/cluster-id` value shown in
the matrix table. These identities, the eight path rows, and the eight PID/PTY
pairs formed the complete product-cell cleanup allowlist.

Authenticated Sentry inspection additionally owned
`BROWSER_SESSION_PREFIX-sentry-inspection`, the complete
`QA_ROOT/chrome-profile-clone`, and cloned Chrome root PID 55817. The clone was
deleted only after Playwright detached and that PID exited. The source Chrome
profile, `.env.local`, the four pre-existing `.playwright-mcp` entries, and the
parked `QA_ROOT/preexisting-web-dist` directory were explicitly protected from
cleanup.

The in-flight development Pixel Replay request was followed by a unique,
release-filtered Replay in Sentry, so its delivery completed. All other listed
envelopes returned a successful 2xx response before browser shutdown.

Disabled cells had zero envelope traffic, no `sentry-trace`, no `baggage`, no
SDK-dependent startup or shutdown failure, and intact Azurite request and
note-operation correlation. Enabled cells propagated both headers through Vite
to Fastify on natural list, read, Save, and conflict requests. Development
enabled cells triggered the existing browser diagnostics once and the existing
server test route once. Built preview hid the diagnostics panel and returned
`404` from the gated test route in all four preview cells.

### Final filesystem proof

Each row records exact byte count and SHA-256 after conflict Discard and before
cluster cleanup.

| Cell                     | Direct note                                                            | Final external route note                                              | Sentinel                                                               |
| ------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Dev desktop disabled     | 82, `325f2f269ef1b117006919eef3b963640bdeb76613c01e368cf43c0e148259c6` | 83, `820c49f2ca47735e72030994b52d20bb32cb699a96dcc5bdf99a0f6e75a1b095` | 78, `8e5761a20e14cdd17a756992d047cd6f670beedd29d0f87809a14c0ecb2aeab4` |
| Dev desktop enabled      | 80, `8ecaa1c8043826059869d358db1455c064f4f2a71e63d3f455b7b3e31d5c909c` | 81, `caf9b35ebb58d511b2cf64a90a8b5cc3799a7eef13fffe1d50f33c3297f29b1e` | 76, `3eb4cb0593317c860a061a00a54310352c57dbc3f903f1bc5283e09b054272a2` |
| Dev Pixel disabled       | 80, `bbc63606a0e2e80475f3ba2335d950ddc00ec560f79bdde1c3fd0fee7a54d5c9` | 81, `3c511580530f926cacca12f3e3d7434e9a818c1d14b9f9e128d4ba0286eec76b` | 76, `6e98f3ae47acc449cfcc8fa0b2b9948d891fa11d76697162687f721cf8bfd1b4` |
| Dev Pixel enabled        | 78, `87363a10b455050c833b53b45611421b9732516402b359a3d8abde783bf3af92` | 79, `3791e4c2479f60037954c431cad06d738aab6421602a6faa5a1ec9d3b605d109` | 84, `5b564396cae916aad1adcf7479a7560e46b5421b80fa187572ed8b5a14986410` |
| Preview desktop disabled | 90, `c36d88d2ece9c04715cb283d86ed8029375793d52cabce67b301b5552326bb18` | 91, `5ecd9f35111272f5d7a7cd884256be3e5ae20ee362786ed3e5cb380640fadffc` | 96, `30d3dfeab62d187527b3ca0e2abd37905bb1a6e3367d5cd1b5c87a1c6a2c50d2` |
| Preview desktop enabled  | 88, `f5103d8c105101dfcf5359654a01b82f72e695eb5c0f08f3164ec0d72628a813` | 89, `64d3ec63513ebdb6225e485b3589d463a6710fbaf02b1332adae0a5b668b7663` | 94, `be3e3d027efc7a967f5c5c0b4ac2d5961a7fe0d14412aafd7308917d40dd3791` |
| Preview Pixel disabled   | 88, `27b96df3edcb52953c6d702a4410d74ee02587200b260dbeb11e400013e64ab0` | 89, `2c5b43809326e1649fc6507819c5e94a748f588129a8f8eeb5f8de8ee51507b3` | 94, `42b80c2b9cecb65e0331edec67d083f18588ce1d2741af13c91a5c365eaf2726` |
| Preview Pixel enabled    | 86, `f504e659d0f49d8ccd89e1e5d7b351e5e67571b43448717c1adf541131545e88` | 87, `31bd8871bcd4b67b35f93b09980f137d87393e7b327d8a1a54e52a4006c4e8d3` | 92, `db6c7e19aa9f03e7387918c557e8ef063e36c1d78cc26948680f1691059923f6` |

### Browser and device metadata

Desktop cells used Chrome 150.0.7871.116 at 1200 by 800 CSS pixels with zero
touch points, no coarse pointer, hover support, and no horizontal overflow.

Pixel 6 cells used Chrome 150.0.7871.116 with this exact emulated user agent:

```text
Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.10 Mobile Safari/537.36
```

The viewport was 412 by 839 CSS pixels, screen 412 by 915, device-pixel ratio
2.625, `maxTouchPoints` one, coarse pointer true, hover none true, and document
width exactly 412. Sidebar selection, mode, editor, Save, Discard, and
diagnostics interactions used Playwright `tap()` where available. No cell had
horizontal overflow.

Browser consoles contained only the development React hint, an existing Vue
warning, deliberate development diagnostics output, the expected `409`
resource line, and deliberate production-gate `404` probes. No unexpected
product error occurred.

## Authenticated Sentry Evidence

The source Chrome profile was cloned with metadata-preserving `ditto`. Source
and clone both contained 33,451 files and 2,917 directories. The source Chrome
was live and changed during the copy, leaving a demonstrated 1,178-byte
post-copy logical-size drift after reconciliation. Only clone singleton files
were removed. Credentials, DSNs, cookies, tokens, authorization headers, and
clone contents were never printed or retained. `.env.local` remained untouched.

Authenticated inspection proved the real SDK metadata:

- web events: `sentry.javascript.react` 10.64.0;
- server events: `sentry.javascript.node` 10.64.0.

Release-filtered Sentry Logs and Trace Explorer showed natural
`notes.list`, `note.load`, `note.read`, route navigation, `note.save`,
`api.request`, `telemetry.runtime.trace_headers.seen`, and Fastify route
evidence. The representative request and note-operation pairs below came from
the cell's captured response headers. The trace is the release-filtered joined
trace inspected in Sentry. Counts include the natural workflow plus bounded
startup and shutdown evidence:

| Enabled release identity                                          | Logs | Trace-header logs | Representative request ID              | Representative note-operation ID       | Joined trace                       | Replay                             |
| ----------------------------------------------------------------- | ---: | ----------------: | -------------------------------------- | -------------------------------------- | ---------------------------------- | ---------------------------------- |
| `azurite-task3e-20260715T071105Z-3d98cc9-dev-desktop-enabled`     |  105 |                13 | `2c6d2b5e-a7cf-42a1-9673-d53ec43fdc61` | `cffd5a07-410d-4629-ba4d-2038b59ebdf1` | `2f47390d59994706b8564fde16ca0532` | `fc8d32cc101447af95a07a7d06bb3449` |
| `azurite-task3e-20260715T071105Z-3d98cc9-dev-pixel6-enabled`      |  102 |                12 | `6e6ee88c-b76b-47dd-b50f-799b6955d681` | `8494db70-4dcf-42fc-88a0-4a3bc31f5074` | `5f7a665b83a9464a923a0bdef5e4da52` | `ed9902fb3844461388231299a5f979fc` |
| `azurite-task3e-20260715T071105Z-3d98cc9-preview-desktop-enabled` |   96 |                13 | `a9599c97-30b0-4330-8ea5-8282c677a58e` | `e3d1f0bd-8476-4b87-a41f-488eecf909f1` | `7349930885bd4a6b967b07bdd870ff9f` | `2ba342c5fdbb4112a9552b013ef07dc3` |
| `azurite-task3e-20260715T071105Z-3d98cc9-preview-pixel6-enabled`  |   96 |                13 | `25f9e35b-e1ab-46d7-909a-33fed2c549c3` | `e7da1abd-2cdd-4b94-a06d-aab4c8759e1b` | `8ad61efd56c84c16a368cc7bf3bcfbc1` | `9914e29da7ae415fabe7fbf054768db0` |

Each trace visibly joined browser work, `api.request`, proxied HTTP, Fastify
request handling, and server `note.read` or `note.save` semantic spans. The
release-specific Replay list returned exactly one Replay per enabled cell.
Development Replay summaries named their unique disposable direct and route
notes and the deliberate browser/server diagnostics. Preview Replays were
uniquely tied to their release filters and contained no diagnostics issue.

Each development diagnostics invocation produced one info record and one error
capture for the web event, one info record and one error capture for the server
event, and one captured console record. Each development release had exactly
one deliberate web issue event and one deliberate server issue event. Both
preview releases returned zero web issues and zero server issues. The expected
`409` therefore created no unexpected issue in any enabled cell.

| Enabled release identity                                          | Deliberate web issues | Deliberate server issues | Unexpected `409` issues | Shutdown delivery and process result                                       |
| ----------------------------------------------------------------- | --------------------: | -----------------------: | ----------------------: | -------------------------------------------------------------------------- |
| `azurite-task3e-20260715T071105Z-3d98cc9-dev-desktop-enabled`     |                     1 |                        1 |                       0 | started 08:18:47.064Z, flushed 08:18:47.192Z, exit 0                       |
| `azurite-task3e-20260715T071105Z-3d98cc9-dev-pixel6-enabled`      |                     1 |                        1 |                       0 | started 08:18:48.781Z, flushed 08:18:48.896Z, exit 0                       |
| `azurite-task3e-20260715T071105Z-3d98cc9-preview-desktop-enabled` |                     0 |                        0 |                       0 | started 08:18:50.523Z, flushed 08:18:50.637Z, exit 0                       |
| `azurite-task3e-20260715T071105Z-3d98cc9-preview-pixel6-enabled`  |                     0 |                        0 |                       0 | started 08:16:46.965Z, flushed 08:16:47.080Z, exit 0, 227 ms total process |

The original package-manager PTY signal ended its wrapper before shutdown
records were observable. A bounded, non-product direct-listener probe then sent
`SIGTERM` to each enabled release. All four listeners exited with code zero and
delivered exactly one `telemetry.runtime.shutdown.started` and one
`telemetry.runtime.shutdown.flushed` log. The latest preview Pixel probe exited
cleanly in 227 ms; the other three probes also completed within their approved
budgets. This is a QA harness disposition. Server sequencing and budgets did
not change.

## Findings And Dispositions

| Finding                                                                                             | Disposition                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protected ignored `apps/web/dist` caused the first validation setup to scan old generated bundles.  | Parked byte-for-byte, reran the complete validation successfully, then restored the exact original directory. No repository or policy change.           |
| One initial disabled desktop Playwright listener attempt failed before writes.                      | Restarted with a unique owned listener. No product request or filesystem mutation occurred.                                                             |
| One development desktop enabled strict locator was ambiguous after sidebar selection.               | Continued from the observed coherent state. No duplicate interaction or request occurred.                                                               |
| Package-manager PTY shutdown did not expose Sentry shutdown records.                                | Reproduced graceful shutdown directly for all four enabled releases. Each exited zero and delivered one started/flushed pair. No code repair required.  |
| Development Pixel observed one Replay envelope in flight at browser close.                          | Authenticated Sentry showed exactly one release-filtered Replay with the unique cell workflow. Delivery confirmed.                                      |
| Internal conformance review found the run ownership and release-correlation evidence too aggregate. | Added the exact roots, cell paths, sessions, runtime identities, sentinels, releases, request/operation pairs, issue counts, and shutdown dispositions. |

No implementation finding required Scope Re-selection. No semantic, SDK,
configuration, correlation, Replay, shutdown, storage, or product-workflow
behavior changed.

## Cleanup Ledger

- All eight browser sessions, eight frontend/backend listener pairs, and four
  direct shutdown probes were stopped by exact owned session or PID identity.
- All eight disposable clusters and their `.azurite` identities were removed
  after the byte/hash ledger above was recorded.
- The Playwright inspection session detached before the cloned Chrome process
  stopped. The complete clone was deleted without touching source Chrome.
- Separate enabled and disabled generated preview builds were deleted. The
  protected pre-existing ignored `apps/web/dist` was restored exactly.
- The owned QA temporary root and
  `output/playwright/task3e-20260715T071105Z-3d98cc9` were deleted.
- `.env.local` and the four pre-existing `.playwright-mcp` entries were
  preserved.
- Final process, listener, port, browser-session, worktree, branch, and Git
  checks found no owned residue.

## Candidate Decision

Task 3E is candidate complete. The structural reduction is real, the shared
carrier remains stateless and Sentry-free, all approved product and
observability contracts remain live, automated proof is green, all eight
browser cells passed, authenticated Sentry evidence passed, and cleanup is
complete. This internal result does not constitute Task 3E acceptance. The
candidate awaits a separate independent conformance review.
