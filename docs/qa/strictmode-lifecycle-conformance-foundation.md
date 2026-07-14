# StrictMode Lifecycle Conformance Foundation QA

## Status

Active implementation evidence. The approved scope is
`docs/slices/active/strictmode-lifecycle-conformance-foundation.md`.

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

### Seam 1 Characterization

The red lifecycle contracts are executable expected-failure tests rather than
skipped tests. They keep `main` green while requiring the expectation to be
removed as each repair makes the contract pass.

| Area                             | Current evidence                                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Router render purity             | One expected failure proves a render-only pass creates one `beforeunload` and two `popstate` listeners and leaves native history wrapped.                                                                                                                        |
| Router replay and unmount        | One expected failure proves StrictMode settles with two live `beforeunload` and three live `popstate` listeners, and final unmount does not reduce them.                                                                                                         |
| Route-owner internals            | Three passing tests prove one blocker plus three subscriptions are disposed exactly once, disposal is terminal, the discarded owner issues no product action, and the retained owner applies the initial route exactly once.                                     |
| Editor generations               | Seven expected failures cover retained readiness, isolated hosts, teardown ordering, stale success/failure/callback rejection, synchronous factory/create throws, asynchronous create rejection, teardown rejection, source fallback, and final unmount/remount. |
| Current editor resources         | One passing characterization confirms replay currently creates two runtimes, destroys one, leaves one live, and destroys the last on final unmount; the ready contract still fails separately.                                                                   |
| Registrations and page lifecycle | Passing StrictMode evidence proves two setup registrations, one replay cleanup, exact one-action delivery for `visibilitychange` and `pagehide`, and balanced final unmount for gate, executor, page listeners, and gate subscribers.                            |
| Draft obligations                | Passing evidence proves terminal discard leaves zero timers/pending/active work without a write, and concurrent lifecycle flush callers share one receipt and perform one write before reaching zero.                                                            |

Targeted seam results before the dependency decision:

- router parsing/owner/resource suites: 24 passing tests and 2 executable
  expected failures;
- editor ordinary/StrictMode suites: 7 passing tests and 7 executable expected
  failures;
- registration and persistence suites: 20 passing tests;
- installed Milkdown lifecycle contract: 1 passing test.

Checkpoint verification after recording the scope gate:

- `/opt/homebrew/bin/pnpm validate` passed with 441 total tests: 432 ordinary
  passes and 9 executable expected failures;
- `/opt/homebrew/bin/pnpm build` passed with the established production chunk-
  size warning;
- formatting, governance, the 400-line code limit, lint, script and workspace
  typechecks, and `git diff --check` passed.

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

To be completed with the existing product and QA roots in development and
optimized-production builds on desktop and Pixel 6 through the Codex Playwright
skill.

## Final Measurements

To be completed after the final diff: physical lines, authority owners,
lifecycle-resource ledger, duplicate product actions, and result vocabulary.
