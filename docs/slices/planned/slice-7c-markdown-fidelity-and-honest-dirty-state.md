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

Source-mode input is exact accepted content and becomes authoritative
immediately. A ready, active WYSIWYG document change that is not owned by an
Azurite synchronization operation makes Milkdown's current serialized Markdown
the authoritative edited value. This observable `accepted content change`
contract does not claim to infer Daniel's psychological intent from every
ProseMirror transaction. Mounting, readiness, controller-owned replacement, and
mode display remain synchronization even when Milkdown's internal document or
serialization changes.

After an accepted rich-editor change, Milkdown may normalize Markdown syntax as
part of serialization; this slice does not claim token-preserving localized
source patches after WYSIWYG editing. That larger capability would require a
separate source-mapping or Markdown reconciliation architecture.

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
- Preserve exact loaded or recovered Markdown until an accepted content change.
- Establish one explicit Markdown-authority boundary between the editor
  projection and Zustand editor session.
- Keep one Crepe instance for one editor session across ordinary React, Zustand,
  draft, mode, and save-status rerenders.
- Preserve a ready Crepe instance's latest document before an in-app transition
  can destroy it while Milkdown's listener is still debounced.
- Close the asynchronous gap between transition request and actual editor-session
  replacement so the outgoing surface cannot accept an unowned edit.
- Refuse a destructive in-app handoff when dirty Markdown could not be made
  durable, while keeping the same editor session available for retry or Save.
- Keep source editing usable while Crepe is creating or unavailable without
  calling editor APIs before readiness.
- Keep dirty-state, Save eligibility, and Dexie draft decisions on one shared
  comparison contract.
- Preserve accepted source and WYSIWYG changes, including one followed
  immediately by a mode switch before Milkdown's debounced listener fires.
- Add fixture-driven regression proof for the real Markdown shapes that exposed
  the defect.
- Leave a typed content-change origin seam that Slice 7D diagnostics can observe
  without rediscovering which callbacks represent accepted edits.

## Non-Goals

- Token-preserving or minimal-diff source rewriting after an accepted WYSIWYG
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
- Automatically deleting or semantically classifying ambiguous drafts created
  before this authority contract existed.
- Adding a custom ProseMirror transaction plugin while Crepe's public lifecycle,
  `getMarkdown()`, listener, and action APIs can complete the user story.
- Repairing the two Slice 7B save-result ownership findings inside this slice;
  they are prerequisites, not annexed 7C work.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Read exact Markdown from disk or a valid recovery draft, project it into one session-owned Crepe instance, switch between WYSIWYG and source without inventing an edit, commit accepted content before transitions, persist only real dirty drafts, and manually save through the existing conflict contract.  |
| Predictable extensions | Autosave, external file watching, diff/conflict UI, source/WYSIWYG diagnostics, future editor loading, and multi-client editing all need to distinguish authoritative content from rendered or serialized projections and flush pending editor work before ownership changes.                                  |
| Participating layers   | Milkdown/Crepe lifecycle and serialization, React editor and transition coordination, Zustand editor session, Save toolbar, Dexie draft scheduling/persistence and reconciliation, existing note API and content-hash save contract, Vitest, and real-browser QA.                                              |
| Near-term seams        | A focused Markdown-authority controller; a React-owned active-editor transition and durability gate; typed accepted-change origins (`source_input` and `wysiwyg_document`); one comparison helper; session/lifecycle ownership that rejects stale callbacks.                                                   |
| Exclusions             | Token-level Markdown reconciliation, automatic legacy-draft classification, new persistence formats, editor replacement, route selection behavior, block-menu behavior, mobile newline repair, observability payloads, and bundle loading can wait because none is required to stop projection-only mutations. |

### Scope Re-selection Result

The asynchronous handoff freeze and typed durability result remain inside 7C.
They use the existing React, Zustand, route, and Dexie boundaries and are
required to make “commit before replacement” true; omitting either permits a
debounced edit to disappear during the exact note/history workflow this slice
claims to preserve. The narrow URL replacement after a failed durability gate
only cancels that unsafe transition. It does not repair the separately tracked
general Back/sidebar selection divergence.

No new product state owner, persistence format, route capability, or editor
integration is annexed. If implementation cannot satisfy the handoff through
these existing boundaries, the Scope Re-selection Triggers apply instead of
silently expanding 7C.

## Authoritative Markdown Contract

This section is the single authoritative home for the slice's state-transition
decision. Implementation comments and tests should reference or summarize it,
not create competing definitions.

### State Terms

| Term                           | Meaning                                                                                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor session                 | One store-owned editing lifetime identified by `sessionKey`. It owns at most one Crepe instance. Ordinary Markdown, mode, recovery, draft, and save-status rerenders remain inside that lifetime.                                                                                   |
| Saved baseline                 | Exact Markdown returned by the current disk read or successful save.                                                                                                                                                                                                                |
| Authoritative current Markdown | Exact content Azurite currently attributes to disk, a recovered draft, source input, or an accepted WYSIWYG document change. This is Zustand's `currentMarkdown`.                                                                                                                   |
| Synchronization checkpoint     | A controller-local pair: exact authoritative Markdown supplied at editor creation or source-to-WYSIWYG synchronization, and Milkdown's serialized projection of that same document. It allows Undo back to that document to restore the exact source bytes.                         |
| Latest WYSIWYG projection      | The most recent projection accepted or synchronously read from the active Crepe instance. It suppresses duplicate listener and transition commits without replacing the synchronization checkpoint.                                                                                 |
| Accepted content change        | Exact source textarea input, or a changed projection read from the ready, active WYSIWYG document while no Azurite-owned synchronization is in progress. It is an observable ownership classification, not a claim about psychological intent.                                      |
| Synchronization                | Editor construction, readiness, controller-owned source-to-WYSIWYG replacement, WYSIWYG-to-source display, or same-mode selection. Synchronization never becomes dirty by itself.                                                                                                   |
| Handoff freeze                 | A React-owned, temporary non-interactive state entered after the outgoing editor's live Markdown is committed and before a destructive asynchronous note/route transition waits for durability. It prevents new input from appearing in a session that is already being handed off. |
| Durability gate                | The result required before an in-app note/route transition may supersede dirty authority: either the editor is clean or the exact current dirty Markdown was written successfully to its scoped draft. An unavailable dirty-draft write fails the gate.                             |
| Legacy ambiguous draft         | A valid draft created before this contract whose record cannot prove whether serializer normalization or accepted editing produced it. Azurite preserves it because automatic classification could delete real work.                                                                |

### Required Transitions

1. **Session creation**
   - Initialize authoritative current Markdown from the exact `initialMarkdown`.
   - Create Crepe with that exact value.
   - Bind the Crepe instance to the editor `sessionKey`, not to mutable Markdown,
     mode, recovery, draft, or save-status props.
   - A same-session React or Zustand rerender must retain the instance, current
     document, synchronization checkpoint, selection, and Undo history.
   - Do not call the parent content-change callback merely to echo the initial
     value.
   - Ignore listener callbacks that belong to an editor instance which is not
     ready, has been destroyed, or no longer owns the current session.

2. **Creation and readiness**
   - Do not call `getMarkdown()`, `editor.action(...)`, `replaceAll`, or another
     Crepe runtime operation before `crepe.create()` resolves for the active
     instance.
   - Source mode remains usable while Crepe is creating. WYSIWYG activation is
     disabled until the instance is ready and any required source synchronization
     succeeds.
   - Source input accepted during creation updates local authority and Zustand
     immediately without mutating the creating Crepe instance.
   - If WYSIWYG remains active and authority has not changed during creation,
     capture `crepe.getMarkdown()` and the exact initial authority as the first
     synchronization checkpoint, and initialize the latest projection from it.
   - If source mode became active or authority changed while Crepe was creating,
     mark the ready instance as requiring source synchronization. Do not install
     a stale initial checkpoint or publish the instance's initial projection.
   - If creation fails, activate source mode without creating a content change,
     keep exact source authority editable, keep WYSIWYG unavailable, and show
     that the rich editor could not be created.
   - Readiness and failure do not publish serialized content to Zustand.
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

4. **Pre-transition commit and asynchronous ownership handoff**
   - A React-owned active-editor transition boundary retains only the current
     controller capability. Crepe runtime objects and functions do not enter
     Zustand, Dexie, or serialized product state.
   - Before source-mode activation, note selection, URL-driven note replacement,
     Back/Forward synchronization, manual save, or another in-app action can
     destroy or supersede a ready WYSIWYG session, synchronously read
     `crepe.getMarkdown()` while the instance still owns the session.
   - If that projection differs from the latest projection, process it once
     through the same checkpoint-aware WYSIWYG transition.
   - If the synchronous projection read or authority publication fails, keep the
     current surface and mode active, cancel the requested in-app action, and
     expose the editor failure. Never continue into destruction with an unknown
     live projection.
   - WYSIWYG-to-source and manual Save are non-destructive same-session actions.
     Commit first, then continue without reconstructing Crepe. A successful Save
     updates the saved Markdown, content hash, note metadata, recovery, and save
     status in the existing `sessionKey`; it preserves mode, current document,
     selection, synchronization checkpoint, and Undo history.
   - For sidebar selection, URL-driven note replacement, and Back/Forward, commit
     accepted authority, enter the handoff freeze, and then resolve the durability
     gate before starting the store action that may eventually replace the
     session. The outgoing editor remains mounted but cannot accept pointer,
     keyboard, touch, or IME input while the gate or note read is pending.
   - Resolve same-note selection as a no-op before entering the handoff freeze.
     While one handoff is pending for a session, additional destructive requests
     reuse that gate and preserve the latest requested route target; they do not
     close, unfreeze, or recommit the outgoing controller independently.
   - Continue a destructive transition only when the outgoing content is clean or
     the exact dirty authority has been written successfully to its scoped draft.
     Once the gate succeeds, close the outgoing controller before starting the
     asynchronous store transition, so later editor/plugin work cannot create an
     unowned change while a note response is pending.
   - If a dirty-draft write is unavailable, cancel the destructive transition,
     leave the same Crepe instance/session/Undo history active, remove the handoff
     freeze, and expose the existing degraded-recovery state. Sidebar selection
     must not push a new URL. If Back/Forward already changed the URL, replace it
     with the still-active note without adding another history entry. This narrow
     failure rollback does not repair or absorb the separate general route/sidebar
     selection finding.
   - A projection equal to the latest projection commits nothing. Do not create
     a revision or draft solely because a transition requested a commit.
   - `visibilitychange` and `pagehide` synchronously commit a ready projection
     before invoking the existing draft-flush attempt. This is best-effort browser
     lifecycle protection; the slice does not claim recovery after a hard process
     kill, power loss, or browser termination that runs no lifecycle callback.
   - If the instance is still creating, source authority is already current and
     no Crepe runtime call is allowed. A destructive transition still freezes
     source input and passes the same durability gate before invalidating the
     creating instance; it never waits for Crepe to become authoritative.

5. **WYSIWYG to source**
   - Complete the pre-transition WYSIWYG commit before changing modes. This
     catches an accepted document edit that occurred less than Milkdown's
     200-millisecond listener debounce earlier.
   - Show the existing exact authoritative Markdown rather than replacing it
     with a normalized projection when the commit is a no-op.
   - The mode change itself may update stored editor mode but must not create
     dirty content or a recovery draft.

6. **Source input**
   - Every textarea input value is exact accepted `source_input` content.
   - Update local authoritative Markdown and publish it immediately. Do not
     normalize line endings or Markdown syntax at this boundary.
   - React rerenders and delayed callbacks from the hidden WYSIWYG surface must
     not replace newer source input.

7. **Source to WYSIWYG**
   - Do not activate or reveal WYSIWYG while Crepe is creating or failed.
   - Replace the Crepe document from the exact authoritative source value using
     the established `replaceAll(..., true)` integration only after readiness.
   - Treat the replacement and any resulting listener echo as synchronization.
   - Capture the exact source authority and resulting serialized projection as a
     new synchronization checkpoint, and reset the latest projection without
     publishing it as content.
   - Activate and reveal WYSIWYG only after synchronization and checkpoint
     capture succeed.
   - If synchronization fails, keep source mode active, keep the exact source
     authoritative, and expose the visible rich-editor failure path; do not
     silently claim WYSIWYG is current.

8. **Session destruction or replacement**
   - Complete any required pre-transition commit before invalidating a ready
     WYSIWYG session. React effect cleanup is not the first or only opportunity
     to retain a debounced edit.
   - Invalidate the instance before asynchronous destruction.
   - A create resolution, listener callback, mode action, or destroy completion
     from an old note/session cannot mutate the new editor.
   - A note/route request may replace only a controller that was already closed
     after a successful durability gate. The old rendered editor is never left
     interactive while an asynchronous response can supersede it.
   - Successful same-session Save settlement is not session replacement and must
     not change `sessionKey` or recreate Crepe, including when a WYSIWYG edit is
     still inside the listener debounce window.
   - The new session receives its own exact authority, synchronization
     checkpoint, and latest projection.

9. **Dirty, draft, and save decisions**
   - Dirty means authoritative current Markdown differs from the saved baseline
     after CRLF-to-LF normalization only.
   - Clean mode changes do not write a draft. A pending draft flush for a clean
     editor may defensively ensure no stale same-note draft exists.
   - Save remains disabled for clean content. A direct programmatic save call
     also returns without an API request.
   - Real dirty content continues through the existing draft and conflict
     contracts unchanged.
   - The draft flush boundary returns a typed durability result. Destructive
     note/route transitions may proceed after `clean` or `durable`, but not after
     `unavailable`. Save and mode switching retain the current session and do not
     depend on a successful draft write to avoid content loss.

10. **Legacy ambiguous draft compatibility**
    - Do not automatically delete, canonicalize, or semantically classify a
      valid pre-7C draft whose origin cannot be proven by its existing schema.
    - Recover it through the existing draft/conflict UI and preserve its exact
      Markdown, base hash, note/cluster scope, and editor mode.
    - Explicit save continues through the content-hash contract. Explicit
      discard deletes that draft, reloads exact disk Markdown, and must remain
      clean through readiness and mode switching.
    - The existing discard action is exposed for both ordinary recovered drafts
      and conflicts, with recovery-appropriate confirmation copy. Pristine notes
      do not gain a discard action. After confirmation, discard intentionally
      bypasses transition capture because deleting all recovered/current draft
      work is the requested destructive outcome.
    - Completion evidence must distinguish prevention of new projection-only
      drafts from preservation of already stored ambiguous drafts.

## Installed Editor API Evidence

The implementation must be based on the installed Milkdown 7.21.2 behavior,
not an assumed generic editor callback:

- Crepe's documented lifecycle constructs an editor with `defaultValue`, awaits
  `create()`, uses public listener, `getMarkdown()`, and `editor.action(...)`
  APIs after readiness, and calls `destroy()` when that editor is finished.
- The installed React integration and official React Crepe example keep a
  stable editor factory across ordinary rerenders; mutable content is not a
  reason to reconstruct the editor.
- `@milkdown/plugin-listener` emits `markdownUpdated` with current and previous
  Markdown after a debounced document change, but does not expose the
  originating ProseMirror transaction to that callback.
- Its current implementation initializes a previous document/serialization,
  waits 200 milliseconds after eligible transactions, and ignores transactions
  with `addToHistory === false`. Destroying the listener view cancels a pending
  debounced callback.
- Crepe's public `getMarkdown()` serializes the current live editor state and is
  the first boundary for retaining a document change before an in-app
  transition destroys the instance.
- `replaceAll(markdown, true)` parses the Markdown, creates a fresh editor
  state, and calls `view.updateState`; it is synchronization, not accepted
  content.

Those facts support the explicit authority/projection state machine and the
public-API-first transition commit. Do not add arbitrary DOM-event guesses,
depend on undocumented callback ordering, or install lower-level transaction
integration speculatively. If real implementation evidence proves the public
boundary cannot retain accepted edits or distinguish controller synchronization,
pause and update this contract before choosing another mechanism.

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
- Represent lifecycle explicitly (`creating`, `ready`, `failed`, `destroyed`)
  and bind it to one editor-session/instance generation.
- Accept `sessionKey` as the Crepe lifetime identity. Do not include mutable
  Markdown, editor mode, recovery, draft, or save-status values in the creation
  effect's reconstruction boundary.
- Represent accepted changes with a discriminated type carrying exact Markdown
  and origin: `source_input` or `wysiwyg_document`.
- Expose a narrow controller capability that can synchronously commit the
  current ready WYSIWYG projection before a React-owned transition continues.
- Make synchronous commit return an explicit success/failure result. A failed
  public `getMarkdown()` or publication cannot be mistaken for a clean no-op.
- Implement the authoritative transitions above as named, independently
  testable operations. Do not scatter boolean suppression flags across React
  callbacks without a single state owner.
- Keep controller-local projection state out of Zustand and Dexie. It is an
  implementation projection, not product state or recovery data.
- Use Crepe's public lifecycle, listener, `getMarkdown()`, and action APIs. Do
  not add a custom transaction plugin unless a scope re-selection trigger is
  proven.
- Add no new runtime dependency.

### 3. Integrate Crepe Without Initial Or Synchronization Echoes

Implementation requirements:

- Remove the current unconditional `onMarkdownChange(initialMarkdown)` call
  from editor creation.
- Keep the source textarea available while Crepe creates. Disable WYSIWYG
  activation until the active create promise resolves and any required source
  synchronization succeeds.
- Never invoke a Crepe runtime operation before readiness.
- Capture the initial synchronization checkpoint after readiness only when
  authority remained on the initial WYSIWYG document. Otherwise require an
  explicit source-to-WYSIWYG synchronization before activation.
- Route `markdownUpdated` through the authority controller rather than directly
  to the parent callback.
- Make WYSIWYG-to-source read and reconcile the live projection before the mode
  switch, so a rapid edit is not lost to listener debounce.
- Make source-to-WYSIWYG replace the document after readiness, reset the
  synchronization checkpoint and latest projection without publishing
  serializer normalization, and reveal WYSIWYG only after success.
- Treat repeated clicks on the already active mode as no-ops.
- If create or source synchronization fails, activate or retain source mode,
  preserve exact source editing, and expose WYSIWYG as unavailable instead of
  degrading the whole editing surface.
- Preserve current loading/error UI and cleanup. Rejected create/destroy work
  remains contained and stale instances cannot publish.
- Preserve the block controls and all current Crepe features; this slice must
  not opportunistically change feature configuration.

### 4. Commit Active WYSIWYG Before Transitions

Implementation requirements:

- Add a React-owned active-editor transition coordinator that holds only the
  current controller capability. Do not put Crepe instances, callbacks, refs,
  or other runtime objects in Zustand, Dexie, or serializable snapshots.
- Route note selection, URL-driven note replacement, Back/Forward
  synchronization, manual Save, and WYSIWYG-to-source activation through the
  coordinator before their existing store actions continue.
- For a ready WYSIWYG session, synchronously read and reconcile
  `crepe.getMarkdown()`. Cancel the requested in-app action and retain the
  current editor if the commit fails.
- Model destructive note/route handoff explicitly: commit, freeze the outgoing
  editor surface, resolve the typed dirty-draft durability result, close the
  controller, and only then start the existing asynchronous store transition.
  Prevent pointer, keyboard, touch, and IME editing while frozen.
- Keep one handoff operation per `sessionKey`. Same-note selection returns before
  freezing, while overlapping note/history requests reuse the active gate and
  hand the latest route target to the existing stale-request ownership logic.
- Change the pending-draft flush boundary to return whether current authority is
  `clean`, `durable`, or `unavailable`. A dirty `unavailable` result cancels
  selection/history synchronization and unfreezes the same editor session.
- Keep URL ownership coherent on a canceled transition: sidebar selection does
  not push, and URL-driven Back/Forward failure replaces the route with the
  still-active note without adding history. Do not change the general route and
  selected-item behavior owned by the separately classified finding.
- Refactor successful same-session save reconciliation so it updates the saved
  baseline, hash, note metadata, recovery, and status in place. It must retain
  `sessionKey`, editor mode, current Markdown, revision ownership, Crepe,
  checkpoint, selection, and Undo history rather than calling a fresh-session
  constructor.
- Make transition ownership exact: an old controller cannot delay, cancel, or
  publish into a newer session, and repeated commit requests for an unchanged
  projection are idempotent.
- Commit before invalidation; do not attempt to recover the latest projection
  for the first time from React cleanup after Crepe destruction begins.
- Integrate `visibilitychange` and `pagehide` with synchronous projection commit
  followed by the existing best-effort draft flush. Do not claim recovery from
  lifecycle callbacks the browser never executes.
- Keep the transition boundary on Crepe's public APIs. If it cannot preserve the
  immediate-edit scenarios, invoke scope re-selection before adding lower-level
  editor integration.

### 5. Establish One Dirty-State Contract

Implementation requirements:

- Move Markdown line-ending normalization and equality/dirty comparison into one
  focused web-domain module used by store actions, `SaveableNoteEditor`, Dexie
  saved-draft reconciliation, and the memory persistence test implementation.
- Remove the duplicate private comparison from `SaveableNoteEditor.tsx`.
- Remove production and test-local comparison copies from draft reconciliation.
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
- Preserve every valid legacy ambiguous draft. Do not infer that a draft is safe
  to delete merely because it equals Milkdown's projection of disk content.
- Expose the existing confirmed discard-and-reload action for ordinary
  `recovery === "draft"` sessions as well as conflicts. Use recovery-appropriate
  text and keep the action absent for pristine sessions.

### 6. Add Layered Regression Coverage

Implementation requirements:

- Add pure authority-controller tests for every required transition, including:
  - normalized setup projection does not publish;
  - listener callbacks before readiness or after destruction are ignored;
  - source input during creation becomes authoritative without calling Crepe;
  - readiness after pre-ready source input cannot install a stale checkpoint;
  - WYSIWYG activation stays unavailable until readiness and synchronization;
  - create or synchronization failure preserves exact editable source;
  - pristine mode switching retains exact source;
  - source input publishes exact content once;
  - a delayed hidden-WYSIWYG callback cannot replace newer source input;
  - source synchronization does not echo;
  - WYSIWYG edits publish once;
  - WYSIWYG Undo back to the synchronization checkpoint restores the checkpoint's
    exact source syntax and clean state;
  - a WYSIWYG edit followed immediately by source mode is captured before the
    debounced listener;
  - transition commit is idempotent and captures a projection before listener
    debounce;
  - a thrown public projection read reports commit failure and cannot continue a
    destructive transition;
  - delayed old-session work cannot replace a new session.
- Extend `MilkdownEditor` component tests with a controllable Crepe mock whose
  create promise and `markdownUpdated` callback can be resolved independently.
- Prove same-session rerenders after Markdown, mode, draft, recovery, and
  save-status changes retain one Crepe instance and preserve its checkpoint and
  Undo history; a new `sessionKey` creates exactly one replacement instance.
- Prove successful same-session Save settlement retains `sessionKey`, source or
  WYSIWYG mode, the same Crepe instance, selection, checkpoint, and Undo history.
- Add a deferred-save integration case: begin Save, make a WYSIWYG edit while
  the request is pending, resolve the response before `markdownUpdated`, and
  prove the same live instance later publishes a dirty, recoverable edit instead
  of being reconstructed.
- Add React transition-coordinator tests for WYSIWYG edit followed immediately
  by source mode, note selection, route replacement, Back/Forward, Save,
  visibility change, and page hide. Assert projection commit occurs before store
  flush/transition and before destruction.
- Add a deferred-note-read case that holds the replacement response, proves the
  outgoing editor is non-interactive after its commit, resolves inside the
  listener debounce window, and confirms the exact committed edit is durable.
- Prove same-note selection never freezes or closes the active controller, and
  overlapping frozen note/history requests reuse one gate and finish on the
  latest route target without reactivating the outgoing editor.
- Simulate unavailable dirty-draft persistence for sidebar selection and
  Back/Forward. Prove the store transition does not start, the URL remains or is
  restored to the active note, the same editor and Undo history are unfrozen,
  and manual Save remains available.
- Extend `SaveableNoteEditor` tests to consume the shared dirty helper and prove
  exact syntax changes remain dirty while CRLF/LF-only differences remain clean.
- Drive one shared parameter table through the comparison helper, Save/UI
  eligibility, store draft decisions, production Dexie saved-snapshot
  reconciliation, and the memory persistence adapter. Every consumer must treat
  CRLF/LF-only differences as equal and intentional syntax/whitespace changes as
  different.
- Extend note-browser store tests to prove:
  - pristine load plus editor readiness creates no draft;
  - mode-only changes leave no draft after flush;
  - clean programmatic save makes zero API calls;
  - a real source or WYSIWYG accepted change schedules one recoverable draft;
  - reload does not report recovery from projection-only normalization;
  - an existing deliberate recovered draft retains its exact Markdown and
    recovery state without being replaced by the editor projection;
  - a seeded valid pre-7C projection-only draft is preserved as ambiguous until
    explicit save or discard, and discard returns to exact clean disk authority;
  - ordinary recovered drafts expose confirmed discard while pristine sessions
    do not;
  - conflict discard reloads exact disk Markdown and stays clean;
  - save, edit-during-save, failure, conflict, navigation, and same-note reopen
    ownership remain correct.
- Exercise the installed Crepe configuration in a real browser beyond the
  component mock: wait through readiness and delayed plugin activity, record
  whether configured features change the document, and prove those changes do
  not become accepted content without the authoritative contract.
- Add a test-only browser lifecycle harness at the Crepe-factory boundary for
  deterministic pending-create and rejected-create cases. It must mount the
  production editor component, remain outside the Azurite product router, be
  excluded from normal application builds, add no runtime dependency or
  product-visible fault switch, and run through both a Vite development server
  and an optimized test-harness build.
- Use fake timers only to drive the known debounce/draft scheduling in tests;
  production logic must not use timing guesses for authority.

### 7. Update Durable Architecture And QA Evidence

Implementation requirements:

- Update `docs/technical-architecture.md` so the Markdown rendering section
  names exact Markdown authority, WYSIWYG projection, and the real-edit
  serialization boundary.
- Update this slice with concise completion evidence rather than duplicating
  full browser logs.
- Add a focused QA record under `docs/qa/` containing fixture names, before/after
  hashes, browser results, IndexedDB proof, and any observed WYSIWYG
  normalization after an accepted edit.
- Record prevention of new projection-only drafts separately from preservation
  and explicit disposition of seeded legacy ambiguous drafts.
- Update the production QA record's P1 disposition only after all acceptance
  criteria pass.
- Keep the Back/sidebar, block-menu, backend-copy, mobile-newline, and bundle
  findings open in their own authoritative homes.

## Scope Re-selection Triggers

Pause and revise the slice rather than silently expanding it if implementation
or QA proves any of these:

- Milkdown changes the document after readiness outside an accepted edit or
  controller-owned synchronization in a way the checkpoint contract cannot
  distinguish deterministically.
- An accepted WYSIWYG document change cannot be retained across immediate mode,
  Save, note, route, history, or supported browser-lifecycle transitions through
  Crepe's public `getMarkdown()` and lifecycle APIs.
- Correct transition ownership requires storing Crepe runtime state in Zustand
  or Dexie instead of a React-owned ephemeral boundary.
- Preventing edits during asynchronous note replacement cannot be implemented
  as a React-owned handoff freeze without replacing the established note-loading
  or route architecture.
- A failed dirty-draft durability gate cannot retain the active session and
  restore URL coherence without introducing another state owner, durable store,
  or general route-selection capability. Do not silently build those broader
  foundations inside 7C.
- Pre-ready source input cannot remain authoritative without mutating Crepe
  before `create()` resolves.
- Deterministic accepted-change ownership requires transaction-origin
  integration below Crepe's public listener API.
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
  followed immediately by a mode switch, Save, note navigation, route/history
  navigation, or a supported browser lifecycle callback.
- A note/route transition must not leave the outgoing editor interactive after
  its final commit while an asynchronous replacement can still supersede it.
- A failed dirty-draft write must not destroy or supersede the only live copy;
  the same session, Crepe instance, and Undo history remain available.
- A same-session rerender must not reconstruct Crepe, reset Undo history, move a
  synchronization checkpoint, or duplicate an editor DOM tree.
- Successful Save settlement must not end a same-note editor session or cancel a
  WYSIWYG edit still waiting for Milkdown's debounced listener.
- Source edits accepted while Crepe creates must not call the unready editor,
  disappear at readiness, or reveal stale WYSIWYG content.
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
- Valid legacy ambiguous drafts must not be deleted or rewritten by projection
  inference; only explicit save/discard and the existing exact successful-save
  contract may dispose of them.
- Ordinary recovered legacy drafts must not become practically undiscardable
  merely because their base hash still matches disk.
- Crepe instances and controller capabilities must remain ephemeral React-owned
  runtime state, not a second product-state owner in Zustand or Dexie.
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
   contains the fixture's exact logical text, status remains clean, and no draft
   appears. For the CRLF fixture, treat the textarea's browser-normalized LF
   presentation separately from authority: prove the untouched store/disk bytes
   and hash remain exact rather than requiring a DOM textarea to retain CRLF.
5. Reload and confirm no recovered-draft state.
6. Invoke the store save action defensively and confirm no `PUT` request occurs.
7. Confirm every disk byte length and SHA-256 hash is unchanged.
8. Under a throttled cold start, switch to source while the visible preparing
   state is still present when that window is observable, make one source edit,
   attempt WYSIWYG activation before readiness, and confirm the edit becomes
   dirty and recoverable while source remains visible and stale WYSIWYG content
   cannot appear. After readiness, enter WYSIWYG and confirm it shows the latest
   source rather than the stale construction value.
9. In the test-only browser lifecycle harness, hold the real component's create
   promise pending and repeat the pre-ready activation attempt deterministically;
   then reject creation and confirm exact source remains editable, WYSIWYG stays
   unavailable, failure is visible, and no content callback/draft is invented.
   Run this harness through Vite development and its optimized harness build.
10. Make one deliberate WYSIWYG edit and switch immediately to Markdown; confirm
    the edit is present, dirty, recoverable, saveable, and durable. Record any
    broader Milkdown syntax normalization honestly as the accepted real-edit
    boundary.
11. Repeat an immediate WYSIWYG edit before Save, sidebar selection, Back,
    Forward, reload, `visibilitychange`, and `pagehide`; confirm the public
    pre-transition commit runs before the old session is destroyed and the edit
    is retained wherever the browser executed the supported lifecycle callback.
12. Hold a Save request pending, edit in WYSIWYG, settle Save before the
    200-millisecond listener, and confirm the same Crepe DOM, mode, selection,
    checkpoint, and Undo history remain. After the listener settles, confirm the
    newer edit is dirty and recoverable against the updated saved baseline.
13. Hold a replacement note read pending after sidebar and Back/Forward
    navigation. Confirm the outgoing surface becomes non-interactive after its
    committed edit, then settle the read inside the listener debounce window and
    prove the committed edit recovers exactly on reopen.
14. Force the dirty-draft write used by sidebar and Back/Forward handoff to fail.
    Confirm no note load starts, sidebar navigation does not push, a changed URL
    is replaced with the active note, the same editor and Undo history become
    interactive again, degraded recovery is visible, and manual Save remains
    available.
15. Trigger same-session parent rerenders through mode, draft, recovery, and
    save-status changes; confirm one Crepe DOM tree remains, Undo still reaches
    the checkpoint, and no duplicate listener publishes. Component tests own the
    exact instance-count assertion.
16. Create an external-write conflict, discard the recovered draft, and confirm
    exact disk Markdown stays clean after editor readiness and mode switching.
17. Recover one deliberate dirty draft whose syntax normalizes in Milkdown and
    confirm the exact draft remains authoritative and dirty until save or
    discard.
18. Seed a valid pre-7C projection-only draft with the current base hash, confirm
    Azurite preserves it as ambiguous and exposes Save and Discard, discard it
    explicitly, and confirm exact disk Markdown remains clean after readiness and
    mode switching.
19. Navigate rapidly between notes during editor creation and confirm stale
    callbacks never alter the current note.
20. Wait through readiness and delayed configured-plugin activity without input;
    confirm no post-ready non-authoritative document change becomes accepted
    content.
21. Confirm the normal production console has no new errors or warnings.

### Synthetic Mobile QA

Use the Codex Playwright skill's bundled browser with a Pixel 6-class mobile
Chrome profile. Exercise both development and the optimized production preview
with mobile viewport, device scale, touch input, mobile user agent, and a
CPU-throttled cold start:

- repeat pristine open, readiness, mode-only switching, reload, draft absence,
  and file-hash proof;
- attempt source editing during the visible preparing state, then activate
  WYSIWYG before readiness and confirm activation is refused, then activate it
  after readiness and confirm the latest source is shown;
- run the pending-create and rejected-create browser harness with mobile viewport,
  user agent, touch, and CPU throttling, confirming source remains editable;
- prove same-session rerenders retain one editor DOM tree and preserve Undo;
- hold note replacement pending and confirm touch/keyboard input cannot enter the
  outgoing surface after its handoff commit;
- make a WYSIWYG edit and immediately switch mode, select another note, use
  Back/Forward, and reload; confirm supported transitions retain the edit; and
- inspect touch interaction, console output, network requests, and IndexedDB.

Synthetic mobile evidence covers viewport, touch, throttled lifecycle, and
mobile-browser emulation. It does not replace physical Android keyboard/IME,
device performance, Tailscale, or hardware-specific Chrome evidence.

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
- Source remains editable while Crepe creates or fails, no runtime API is called
  before readiness, and later WYSIWYG activation synchronizes the latest exact
  authority before revealing the rich editor.
- Attempted WYSIWYG activation before readiness is refused, and deterministic
  browser-level create failure leaves exact source editable with a visible rich-
  editor failure in development and an optimized harness build.
- One editor session retains one Crepe instance, document, checkpoint, and Undo
  history across ordinary same-session React and Zustand rerenders.
- Successful same-session Save settlement retains `sessionKey`, mode, Crepe,
  selection, checkpoint, and Undo history. A WYSIWYG edit made while Save is
  pending survives response settlement inside the listener debounce window and
  becomes dirty against the updated saved baseline.
- WYSIWYG/Markdown mode-only round trips preserve the exact authoritative
  Markdown and create no recovery draft.
- Save is disabled for pristine content, a direct clean save makes no API call,
  and fixture file bytes/hashes remain unchanged.
- Reload and conflict discard do not create false dirty or recovered-draft
  state.
- A deliberate recovered draft keeps its exact Markdown and remains honestly
  dirty even when Milkdown's projection differs.
- Accepted source input remains exact, becomes dirty, persists a draft, saves,
  and survives reload.
- An accepted WYSIWYG document change becomes dirty, is synchronously retained
  through immediate mode, Save, note, route/history, and supported lifecycle
  transitions, persists a draft, saves, and survives reload.
- Destructive note/route handoff freezes the outgoing surface after its final
  commit, makes exact dirty authority durable, and closes controller ownership
  before asynchronous replacement begins; no edit can appear in the gap.
- An unavailable dirty-draft write cancels destructive selection/history
  handoff, preserves and unfreezes the same editor session and Undo history,
  keeps or restores the active-note URL, and leaves manual Save available.
- Old editor instances and synchronization echoes cannot replace newer session
  or source intent.
- Valid legacy ambiguous drafts are preserved without inference; explicit
  Save and Discard are available for ordinary recovered drafts, and explicit
  discard reloads exact disk Markdown and remains clean.
- One shared Markdown comparison owns UI, store dirty/draft/save decisions,
  Dexie saved-draft reconciliation, and matching test persistence with CRLF/LF
  equivalence only, proven by one shared parameter table across every consumer.
- Crepe runtime objects and active controller capabilities remain out of Zustand,
  Dexie, and serializable snapshots.
- The architecture documentation records the exact-authority versus projection
  boundary and the honest limitation after real WYSIWYG edits.
- The desktop QA matrix passes in both dev and production preview, synthetic
  Pixel 6 QA passes in both runtimes, and the physical-phone non-input smoke
  passes without claiming the Android input bug.
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
