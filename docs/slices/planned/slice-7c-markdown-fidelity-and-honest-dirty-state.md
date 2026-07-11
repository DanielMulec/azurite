# Slice 7C: Markdown Fidelity And Honest Dirty State

## Status

Planned. Promote this document to `docs/slices/active/` only after Slice 7B is
cleanly completed and archived.

The required sequence before promotion is:

1. repair the two open Slice 7B adversarial-review save-integrity findings;
2. classify the Back/sidebar selection divergence against the pre-7B baseline
   and either repair a 7B regression or record a separate route-state slice;
3. complete and record the deferred Slice 7B physical Pixel 6 acceptance gate;
4. archive Slice 7B and refresh this plan against that implemented baseline;
5. promote this file to `docs/slices/active/` without changing its product
   decision unless new evidence requires scope re-selection.

The production evidence that created this slice is authoritative in
`docs/qa/production-desktop-2026-07-11.md`.

## Product Decision

Azurite distinguishes exact authoritative Markdown from Milkdown's serialized
projection.

The exact Markdown loaded from disk or recovered from a deliberate browser
draft remains authoritative until Daniel performs a content edit. Mounting
Crepe, waiting for editor readiness, serializer normalization, and switching
editor modes are synchronization events, not user edits. They must not replace
the authoritative Markdown, mark the note dirty, write a recovery draft, enable
Save, or rewrite the file.

Source-mode input is exact user intent and becomes authoritative immediately.
A genuine WYSIWYG document change makes Milkdown's current serialized Markdown
the authoritative edited value. After that real rich-editor change, Milkdown
may normalize Markdown syntax as part of serialization; this slice does not
claim token-preserving localized source patches after a genuine WYSIWYG edit.
That larger capability would require a separate source-mapping or Markdown
reconciliation architecture.

Dirty state remains an exact comparison of the authoritative current Markdown
and the saved disk baseline, with only the existing CRLF-to-LF equivalence. Do
not introduce semantic-AST equality, whitespace folding, list-marker
canonicalization, or another comparison that could hide an intentional source
edit.

## User Story

When Daniel opens an existing Markdown note and only reads it or switches
between WYSIWYG and Markdown source, Azurite continues to show `Saved`, keeps
Save disabled, creates no recovery draft, and leaves the file byte-for-byte
unchanged.

When Daniel actually edits in either mode, Azurite immediately shows honest
dirty state, keeps the edit recoverable, saves through the existing content-hash
conflict contract, and preserves the intentional edit across reload.

## Goals

- Make pristine open, editor readiness, and mode-only switching non-mutating.
- Preserve exact loaded or recovered Markdown until a real content edit.
- Establish one explicit Markdown-authority boundary between the editor
  projection and Zustand editor session.
- Keep dirty-state, Save eligibility, and Dexie draft decisions on one shared
  comparison contract.
- Preserve real source and WYSIWYG edits, including an edit followed immediately
  by a mode switch before Milkdown's debounced listener fires.
- Add fixture-driven regression proof for the real Markdown shapes that exposed
  the defect.
- Leave a typed content-change origin seam that Slice 7D diagnostics can observe
  without rediscovering which callbacks represent accepted edits.

## Non-Goals

- Token-preserving or minimal-diff source rewriting after a genuine WYSIWYG
  document edit.
- Adopting a repository-wide Markdown canonicalization policy or rewriting
  existing notes into Milkdown's preferred syntax.
- Treating semantically equivalent but textually different Markdown as clean
  after deliberate source input.
- Replacing Milkdown/Crepe, adding another editor framework, or changing the
  CommonMark-plus-GFM product dialect.
- Fixing the Back/sidebar route-state divergence. It must first be classified
  against Slice 7B as described in Status.
- Fixing Crepe's block `+` menu, the Android source-mode newline reversion, or
  the unexplained fresh-cluster recovered-draft observation.
- Changing backend-unavailable copy, adding retry UI, lazy-loading the editor,
  changing chunks, or suppressing Vite's size warning.
- Adding Slice 7D Sentry semantics, rich payload capture, or editor telemetry.
- Changing the existing content-hash API, atomic filesystem write behavior,
  draft schema, or recovery ownership.
- Repairing the two Slice 7B save-result ownership findings inside this slice;
  they are prerequisites, not annexed 7C work.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Read exact Markdown from disk or a valid recovery draft, project it into Crepe, switch between WYSIWYG and source without inventing an edit, accept real content edits, persist only real dirty drafts, and manually save through the existing conflict contract. |
| Predictable extensions | Autosave, external file watching, diff/conflict UI, source/WYSIWYG diagnostics, future editor loading, and multi-client editing all need to distinguish authoritative content from rendered or serialized projections.                                            |
| Participating layers   | Milkdown/Crepe lifecycle and serialization, React editor controller, Zustand editor session, Save toolbar, Dexie draft scheduling/persistence, existing note API and content-hash save contract, Vitest, and real-browser QA.                                     |
| Near-term seams        | A focused Markdown-authority controller; typed accepted-change origins (`source_input` and `wysiwyg_document`); one dirty-comparison helper; session/lifecycle ownership that rejects stale editor callbacks.                                                     |
| Exclusions             | Token-level Markdown reconciliation, new persistence formats, editor replacement, route selection, block-menu behavior, mobile newline repair, observability payloads, and bundle loading can wait because none is required to stop projection-only mutations.    |

## Authoritative Markdown Contract

This section is the single authoritative home for the slice's state-transition
decision. Implementation comments and tests should reference or summarize it,
not create competing definitions.

### State Terms

| Term                           | Meaning                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved baseline                 | Exact Markdown returned by the current disk read or successful save.                                                                                                                                                                                            |
| Authoritative current Markdown | Exact content Azurite currently attributes to disk, a recovered draft, source input, or an accepted WYSIWYG edit. This is Zustand's `currentMarkdown`.                                                                                                          |
| Synchronization checkpoint     | A controller-local pair: the exact authoritative Markdown supplied at editor creation or source-to-WYSIWYG synchronization, and Milkdown's serialized projection of that same document. It allows Undo back to that document to restore the exact source bytes. |
| Latest WYSIWYG projection      | The most recent projection observed from the active Crepe instance. It suppresses duplicate listener/mode-switch echoes without replacing the synchronization checkpoint.                                                                                       |
| Accepted content change        | Source textarea input or a WYSIWYG projection that changed relative to the latest WYSIWYG projection after the editor is ready.                                                                                                                                 |
| Synchronization                | Editor creation, readiness, source-to-WYSIWYG replacement, WYSIWYG-to-source display, or same-mode selection. Synchronization never becomes dirty by itself.                                                                                                    |

### Required Transitions

1. **Session creation**
   - Initialize authoritative current Markdown from the exact `initialMarkdown`.
   - Create Crepe with that exact value.
   - Do not call the parent content-change callback merely to echo the initial
     value.
   - Ignore listener callbacks that belong to an editor instance which is not
     ready, has been destroyed, or no longer owns the current session.

2. **Crepe readiness**
   - After `crepe.create()` resolves for the active instance, capture
     `crepe.getMarkdown()` and the exact initial authority as the synchronization
     checkpoint, and initialize the latest projection from it.
   - Do not publish that serialized value to Zustand.
   - Do not use a timeout, callback count, or “ignore the first update” heuristic
     as the lifecycle boundary.

3. **WYSIWYG document update**
   - Accept a ready, active instance's `markdownUpdated` value only while
     WYSIWYG is the active mode and only when it differs from the latest WYSIWYG
     projection.
   - Ignore delayed WYSIWYG listener work while source mode is active; newer
     exact source input owns authority until explicit source-to-WYSIWYG
     synchronization.
   - Update the latest projection before publishing so an echo cannot publish
     twice. Do not move the synchronization checkpoint on each rich edit.
   - When the new projection equals the checkpoint projection, restore and
     publish the checkpoint's exact authoritative Markdown. This makes Undo back
     to the synchronized document recover the original syntax and clean state.
   - Otherwise publish the new serialization once as a `wysiwyg_document`
     content change and update the local authoritative value.
   - A projection equal to the latest projection is a no-op even if Milkdown
     reports a document transaction.

4. **WYSIWYG to source**
   - Read the current projection synchronously before changing modes. This
     catches a genuine document edit that occurred less than Milkdown's
     200-millisecond listener debounce earlier.
   - If that projection differs from the latest projection, process it once
     through the same checkpoint-aware WYSIWYG transition.
   - If it equals the latest projection, show the existing exact authoritative
     Markdown rather than replacing it with the normalized projection.
   - The mode change itself may update stored editor mode but must not create
     dirty content or a recovery draft.

5. **Source input**
   - Every textarea input value is exact `source_input` intent.
   - Update local authoritative Markdown and publish it immediately. Do not
     normalize line endings or Markdown syntax at this boundary.
   - React rerenders and delayed callbacks from the hidden WYSIWYG surface must
     not replace newer source input.

6. **Source to WYSIWYG**
   - Replace the Crepe document from the exact authoritative source value using
     the established `replaceAll(..., true)` integration.
   - Treat the replacement and any resulting listener echo as synchronization.
   - Capture the exact source authority and resulting serialized projection as a
     new synchronization checkpoint, and reset the latest projection without
     publishing it as content.
   - If synchronization fails, keep the exact source authoritative and expose
     the existing visible editor failure path; do not silently claim WYSIWYG is
     current.

7. **Session destruction or replacement**
   - Invalidate the instance before asynchronous destruction.
   - A create resolution, listener callback, mode action, or destroy completion
     from an old note/session cannot mutate the new editor.
   - The new session receives its own exact authority, synchronization
     checkpoint, and latest projection.

8. **Dirty, draft, and save decisions**
   - Dirty means authoritative current Markdown differs from the saved baseline
     after CRLF-to-LF normalization only.
   - Clean mode changes do not write a draft. A pending draft flush for a clean
     editor may defensively ensure no stale same-note draft exists.
   - Save remains disabled for clean content. A direct programmatic save call
     also returns without an API request.
   - Real dirty content continues through the existing draft and conflict
     contracts unchanged.

## Installed Editor API Evidence

The implementation must be based on the installed Milkdown 7.21.2 behavior,
not an assumed generic editor callback:

- `@milkdown/plugin-listener` emits `markdownUpdated` with current and previous
  Markdown after a debounced document change, but does not expose the
  originating ProseMirror transaction to that callback.
- Its current implementation initializes a previous document/serialization,
  waits 200 milliseconds after eligible transactions, and ignores transactions
  with `addToHistory === false`.
- `replaceAll(markdown, true)` parses the Markdown, creates a fresh editor
  state, and calls `view.updateState`; it is synchronization, not proof of user
  intent.

Those facts support the explicit authority/projection state machine. Do not add
arbitrary DOM-event guesses or depend on undocumented callback ordering. If
implementation evidence contradicts these installed APIs, pause and update this
contract before choosing another mechanism.

## Implementation Plan

### 1. Preserve The Reproduction As Test Data

Implementation requirements:

- Add sanitized, disposable Markdown fidelity fixtures under
  `apps/web/test/fixtures/markdown-fidelity/`.
- Include at least:
  - hyphen unordered lists whose Milkdown projection uses another marker;
  - tight and loose lists;
  - headings, emphasis, links, fenced code, blockquotes, and GFM tables;
  - deliberate blank-line and trailing-newline choices;
  - a long mixed-format note representative of the 7,933-character QA case;
  - a programmatically constructed CRLF case so Git line-ending handling does
    not erase the test input.
- Before changing behavior, add a focused regression test that demonstrates a
  normalized Crepe projection differs from exact source while the desired
  authoritative content remains the exact source.
- Keep fixtures free of Daniel's private note content and credentials.

### 2. Extract A Focused Markdown-Authority Controller

Implementation requirements:

- Split `apps/web/src/components/MilkdownEditor.tsx` before adding behavior; it
  is already 382 lines and cannot cross the 400-line hard limit.
- Keep rendering and accessible controls in the component file. Move lifecycle,
  instance ownership, authority/projection transitions, and Crepe integration
  into focused modules with beginner-readable exported API documentation.
- Represent lifecycle explicitly (`creating`, `ready`, `destroyed`) and bind it
  to one editor-session/instance generation.
- Represent accepted changes with a discriminated type carrying exact Markdown
  and origin: `source_input` or `wysiwyg_document`.
- Implement the authoritative transitions above as named, independently
  testable operations. Do not scatter boolean suppression flags across React
  callbacks without a single state owner.
- Keep controller-local projection state out of Zustand and Dexie. It is an
  implementation projection, not product state or recovery data.
- Add no new runtime dependency.

### 3. Integrate Crepe Without Initial Or Synchronization Echoes

Implementation requirements:

- Remove the current unconditional `onMarkdownChange(initialMarkdown)` call
  from editor creation.
- Capture the initial synchronization checkpoint only after the active Crepe
  create promise resolves.
- Route `markdownUpdated` through the authority controller rather than directly
  to the parent callback.
- Make WYSIWYG-to-source read and reconcile the live projection before the mode
  switch, so a rapid edit is not lost to listener debounce.
- Make source-to-WYSIWYG replace the document and reset the synchronization
  checkpoint and latest projection without publishing serializer normalization.
- Treat repeated clicks on the already active mode as no-ops.
- Preserve current loading/error UI and cleanup. Rejected create/destroy work
  remains contained and stale instances cannot publish.
- Preserve the block controls and all current Crepe features; this slice must
  not opportunistically change feature configuration.

### 4. Establish One Dirty-State Contract

Implementation requirements:

- Move Markdown line-ending normalization and dirty comparison into one focused
  web-domain module used by both store actions and `SaveableNoteEditor`.
- Remove the duplicate private comparison from `SaveableNoteEditor.tsx`.
- Preserve only CRLF/LF equivalence. Do not trim, parse, serialize, or compare
  Markdown ASTs when deciding dirty state.
- Keep `currentMarkdown` and `savedMarkdown` exact. Do not store a canonicalized
  alternative in `EditorSession`.
- Ensure editor-mode-only updates do not imply dirty content and do not leave a
  draft record for a pristine note.
- Keep `canSaveEditor` as the defensive API boundary: clean content must never
  call `saveNote`, even if UI code invokes the action directly.
- Preserve the existing Slice 7B single-flight, edit-during-save,
  session-ownership, conflict, failed-save, and exact-draft-cleanup behavior
  after its prerequisite repairs.

### 5. Add Layered Regression Coverage

Implementation requirements:

- Add pure authority-controller tests for every required transition, including:
  - normalized setup projection does not publish;
  - listener callbacks before readiness or after destruction are ignored;
  - pristine mode switching retains exact source;
  - source input publishes exact content once;
  - a delayed hidden-WYSIWYG callback cannot replace newer source input;
  - source synchronization does not echo;
  - WYSIWYG edits publish once;
  - WYSIWYG Undo back to the synchronization checkpoint restores the checkpoint's
    exact source syntax and clean state;
  - a WYSIWYG edit followed immediately by source mode is captured before the
    debounced listener;
  - delayed old-session work cannot replace a new session.
- Extend `MilkdownEditor` component tests with a controllable Crepe mock whose
  create promise and `markdownUpdated` callback can be resolved independently.
- Extend `SaveableNoteEditor` tests to consume the shared dirty helper and prove
  exact syntax changes remain dirty while CRLF/LF-only differences remain clean.
- Extend note-browser store tests to prove:
  - pristine load plus editor readiness creates no draft;
  - mode-only changes leave no draft after flush;
  - clean programmatic save makes zero API calls;
  - a real source or WYSIWYG accepted change schedules one recoverable draft;
  - reload does not report recovery from projection-only normalization;
  - an existing deliberate recovered draft retains its exact Markdown and
    recovery state without being replaced by the editor projection;
  - conflict discard reloads exact disk Markdown and stays clean;
  - save, edit-during-save, failure, conflict, navigation, and same-note reopen
    ownership remain correct.
- Use fake timers only to drive the known debounce/draft scheduling in tests;
  production logic must not use timing guesses for authority.

### 6. Update Durable Architecture And QA Evidence

Implementation requirements:

- Update `docs/technical-architecture.md` so the Markdown rendering section
  names exact Markdown authority, WYSIWYG projection, and the real-edit
  serialization boundary.
- Update this slice with concise completion evidence rather than duplicating
  full browser logs.
- Add a focused QA record under `docs/qa/` containing fixture names, before/after
  hashes, browser results, IndexedDB proof, and any observed WYSIWYG
  normalization after a genuine edit.
- Update the production QA record's P1 disposition only after all acceptance
  criteria pass.
- Keep the Back/sidebar, block-menu, backend-copy, mobile-newline, and bundle
  findings open in their own authoritative homes.

## Scope Re-selection Triggers

Pause and revise the slice rather than silently expanding it if implementation
or QA proves any of these:

- Milkdown changes the document after readiness without a user edit in a way
  the synchronization-checkpoint contract cannot distinguish deterministically.
- A real WYSIWYG edit cannot be retained across an immediate mode switch without
  adding transaction-origin integration below Crepe's public listener API.
- The only correct solution requires token-level source reconciliation or a
  canonicalization migration for existing notes.
- Fixing false dirty requires changing the draft schema, content-hash API, or
  filesystem write contract.
- The mobile newline failure has the same root cause and cannot be honestly
  separated. If so, revise the sequence and acceptance matrix before annexing
  physical-keyboard behavior.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

- Projection suppression must not discard a real WYSIWYG edit, including one
  followed immediately by a mode switch or note navigation.
- A stale Crepe instance must not overwrite newer source input or a newly opened
  editor session.
- Exact source input must not be hidden as clean by semantic normalization.
- A pristine editor must not create a recovery draft, false recovery banner,
  save request, content-hash conflict, or filesystem write.
- Source-to-WYSIWYG synchronization must not publish a second edit or increment
  the editor revision solely because Milkdown serialized the same document
  differently.
- Real dirty drafts must retain current cluster/note scoping, base hash, editor
  mode, recovery behavior, and successful-save cleanup.
- Discarding a conflict must restore exact disk Markdown and remain clean until
  the next real edit.
- Existing safe URL, filesystem boundary, Sentry-disabled, request-correlation,
  and content-hash guarantees must remain unchanged.
- Every code file must remain at or below 400 lines.

## Verification Plan

### Automated Verification

Run focused tests while implementing, then the full repository validation and
production build:

```sh
/opt/homebrew/bin/pnpm --filter @azurite/web test
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
git diff --check
```

The final test evidence must name the new fixture/controller/component/store
cases and confirm the Slice 7B save-integrity regression tests still pass.

### Real-Browser Desktop QA

Use a disposable cluster and the available Codex Playwright skill or browser
plugin; do not add Playwright as a repository dependency merely for this QA.
Run the matrix once through Vite development and once through the optimized
production preview:

1. Record every fixture file's byte length, SHA-256 hash, and exact content.
2. Open each note in WYSIWYG and wait beyond editor readiness and the listener's
   200-millisecond debounce.
3. Confirm status remains `Saved`, Save is disabled, and IndexedDB contains no
   draft for that note.
4. Switch WYSIWYG to Markdown to WYSIWYG and confirm the source textarea still
   contains the exact fixture bytes, status remains clean, and no draft appears.
5. Reload and confirm no recovered-draft state.
6. Invoke the store save action defensively and confirm no `PUT` request occurs.
7. Confirm every disk byte length and SHA-256 hash is unchanged.
8. Make one deliberate source edit; confirm dirty state, draft persistence,
   save, reload, and exact source value.
9. Make one deliberate WYSIWYG edit and switch immediately to Markdown; confirm
   the edit is present, dirty, recoverable, saveable, and durable. Record any
   broader Milkdown syntax normalization honestly as the accepted real-edit
   boundary.
10. Create an external-write conflict, discard the recovered draft, and confirm
    exact disk Markdown stays clean after editor readiness and mode switching.
11. Recover one deliberate dirty draft whose syntax normalizes in Milkdown and
    confirm the exact draft remains authoritative and dirty until save or
    discard.
12. Navigate rapidly between notes during editor creation and confirm stale
    callbacks never alter the current note.
13. Confirm the normal production console has no new errors or warnings.

### Physical-Phone Smoke QA

Because this boundary participates in the real Crepe/browser lifecycle, repeat
the non-input fidelity smoke on the physical Pixel 6 through the established
Tailscale runbook:

- open a disposable real-format note in WYSIWYG;
- wait for readiness and confirm `Saved` with Save disabled;
- switch to Markdown and back without typing;
- reload and confirm there is no false recovered draft; and
- confirm the file hash remains unchanged.

This smoke does not claim to fix or accept the separate Android Enter newline
finding. That remains the mandatory correctness work after Slice 7D.

## Acceptance Criteria

- Every fidelity fixture opens clean in development and the optimized
  production preview.
- Waiting for Crepe readiness and listener debounce publishes no content change.
- WYSIWYG/Markdown mode-only round trips preserve the exact authoritative
  Markdown and create no recovery draft.
- Save is disabled for pristine content, a direct clean save makes no API call,
  and fixture file bytes/hashes remain unchanged.
- Reload and conflict discard do not create false dirty or recovered-draft
  state.
- A deliberate recovered draft keeps its exact Markdown and remains honestly
  dirty even when Milkdown's projection differs.
- Genuine source input remains exact, becomes dirty, persists a draft, saves,
  and survives reload.
- Genuine WYSIWYG input becomes dirty, is not lost during an immediate mode
  switch, persists a draft, saves, and survives reload.
- Old editor instances and synchronization echoes cannot replace newer session
  or source intent.
- One shared dirty comparison owns UI, draft, and save decisions with CRLF/LF
  equivalence only.
- The architecture documentation records the exact-authority versus projection
  boundary and the honest limitation after real WYSIWYG edits.
- The desktop QA matrix passes in both dev and production preview, and the
  physical-phone non-input smoke passes without claiming the Android input bug.
- The unrelated production findings remain separately tracked rather than
  silently absorbed.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, and
  `git diff --check` pass.
- The completed repository is clean, remains on `main`, and is synchronized
  with `origin/main`.

## Open Questions

None for planning. The product decision, source-of-truth boundary, accepted
real-edit limitation, implementation sequence, scope exclusions, and completion
proof are explicit. New contradictory runtime evidence must use the scope
re-selection triggers above.
