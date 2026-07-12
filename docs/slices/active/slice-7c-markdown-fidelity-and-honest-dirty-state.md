# Slice 7C: Markdown Fidelity And Honest Dirty State

## Status

Active as of 2026-07-12 after Slice 7B completed and moved to archive.

The promotion prerequisites are closed:

1. both 7B save-result ownership findings are repaired with exact-session race
   coverage;
2. the Back/sidebar divergence is proven pre-existing and ordered separately as
   Slice 7F, URL Selection And History Coherence;
3. the closing eight-cell desktop/Pixel 6, development/production,
   Sentry-enabled/disabled Playwright matrix passed;
4. authenticated Sentry Replay and Trace Explorer proof passed; and
5. this plan was refreshed without changing its Markdown-authority product
   decision or annexing the separate route capability.

The 2026-07-12 post-7B adversarial revision made editor publication
acknowledged and retryable, separated route targets from editor handoff,
introduced exact ordered draft-mutation ownership, separated recovery
disposition from content equality, and made browser-lifecycle guarantees
explicitly bounded. Daniel accepted the bounded WYSIWYG dirty-indicator latency
and completed-draft reload guarantee; literal pre-debounce status and unload
confirmation remain future hardening rather than 7C prerequisites.

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

Source-mode input is exact accepted content, publishes synchronously, and
becomes authoritative when the exact-session Zustand boundary acknowledges it.
A ready, active WYSIWYG document change that is not owned by an Azurite
synchronization operation makes Milkdown's current serialized Markdown the
authoritative edited value after the same acknowledgement. This observable
`accepted content change` contract does not claim to infer Daniel's
psychological intent from every ProseMirror transaction. Mounting, readiness,
controller-owned replacement, and mode display remain synchronization even when
Milkdown's internal document or serialization changes.

Successful source-input acknowledgement updates dirty state synchronously.
Ordinary WYSIWYG typing may publish through Milkdown's installed
200-millisecond listener debounce; every supported in-app action that could
supersede that document synchronously reads and publishes the live projection
before it continues. This slice deliberately does not add lower-level
transaction integration merely to make the passive dirty indicator update
before that bounded debounce.

Browser recovery becomes guaranteed when the exact current draft mutation has
completed successfully. `visibilitychange` and `pagehide` still attempt to
commit and flush newer work, but browser reload or termination while an
asynchronous IndexedDB mutation is unfinished remains best-effort. This slice
does not add intrusive unload confirmation UX. Verification that claims reload
recovery must first observe the exact draft as durable.

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

When Daniel actually edits in either mode, Azurite reports honest dirty state at
the accepted-change boundary, makes the exact edit recoverable through ordered
browser-draft persistence, saves through the existing content-hash conflict
contract, and preserves the intentional edit across reload after that draft or
save has completed successfully.

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
- Serialize draft writes, cleanups, explicit discards, and successful-save
  reconciliation per cluster/note key so an older mutation cannot supersede a
  newer durability decision.
- Keep editor-session handoff ownership separate from route-target ownership;
  Slice 7F remains the only owner of selected-intent versus rendered-projection
  coherence.
- Keep source editing usable while Crepe is creating or unavailable without
  calling editor APIs before readiness.
- Keep content-dirty equality on one shared comparison contract while treating
  unresolved recovered-draft disposition as a separate product fact.
- Preserve accepted source and WYSIWYG changes, including one followed
  immediately by a mode switch before Milkdown's debounced listener fires.
- Add fixture-driven regression proof for the real Markdown shapes that exposed
  the defect.
- Leave typed accepted-change, synchronization, commit, and durability results
  that Slice 7D diagnostics can observe without rediscovering which callbacks
  represent product truth.

## Non-Goals

- Token-preserving or minimal-diff source rewriting after an accepted WYSIWYG
  document edit.
- Adopting a repository-wide Markdown canonicalization policy or rewriting
  existing notes into Milkdown's preferred syntax.
- Treating semantically equivalent but textually different Markdown as clean
  after deliberate source input.
- Replacing Milkdown/Crepe, adding another editor framework, or changing the
  CommonMark-plus-GFM product dialect.
- Fixing the pre-existing Back/sidebar route-state divergence. Slice 7F owns
  that capability and its overlapping-history repair.
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
- Adding unload-warning UX or claiming guaranteed recovery while a browser-draft
  mutation is still pending.
- Reworking the completed Slice 7B save-result ownership repairs; 7C relies on
  their exact-session contract and preserves their regression coverage.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Read exact Markdown from disk or a valid recovery draft, project it into one session-owned Crepe instance, switch between WYSIWYG and source without inventing an edit, commit accepted content before transitions, avoid new projection-only drafts while preserving unresolved recovered records, and manually save through the existing conflict contract. |
| Predictable extensions | Autosave, external file watching, diff/conflict UI, source/WYSIWYG diagnostics, future editor loading, and multi-client editing all need to distinguish authoritative content from rendered or serialized projections and flush pending editor work before ownership changes.                                                                                 |
| Participating layers   | Milkdown/Crepe lifecycle and serialization, React editor and transition coordination, Zustand editor session, Save toolbar, Dexie draft scheduling/persistence and reconciliation, existing note API and content-hash save contract, Vitest, and real-browser QA.                                                                                             |
| Near-term seams        | A focused Markdown-authority controller; a React-owned editor-session handoff gate; an ordered per-note draft-mutation boundary; acknowledged typed accepted-change and synchronization results; one comparison helper; session/lifecycle ownership that rejects stale callbacks.                                                                             |
| Exclusions             | Token-level Markdown reconciliation, automatic legacy-draft classification, new persistence formats, editor replacement, route selection behavior, block-menu behavior, mobile newline repair, observability payloads, and bundle loading can wait because none is required to stop projection-only mutations.                                                |

### Scope Re-selection Result

The asynchronous handoff freeze, ordered draft-mutation boundary, and typed
snapshot-specific durability result remain inside 7C. They use the existing
React, Zustand, route, and Dexie boundaries and are required to make “commit
before replacement” true; omitting them permits a debounced edit or an older
draft mutation to outlive the exact session being handed off.

The handoff coordinator owns only editor-session safety. It does not retain,
coalesce, choose, or declare the latest route target, and a target matching the
temporarily rendered editor does not by itself make the route action a no-op.
Each route caller retains its own intent and existing Slice 7B evidence. The
narrow URL replacement after a failed durability gate executes only when that
exact failed URL intent is still current; it cannot overwrite a newer URL. This
cancels an unsafe transition without repairing the separately tracked general
Back/sidebar selection divergence.

No new persistent product state owner, persistence format, route capability, or
lower-level editor integration is annexed. The per-note mutation coordinator is
ephemeral ordering inside the existing draft-persistence workflow; it does not
change Dexie's ownership or schema. If implementation cannot satisfy the
handoff through these boundaries, the Scope Re-selection Triggers apply instead
of silently expanding 7C.

## Authoritative Markdown Contract

This section is the single authoritative home for the slice's state-transition
decision. Implementation comments and tests should reference or summarize it,
not create competing definitions.

### State Terms

| Term                            | Meaning                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor session                  | One store-owned editing lifetime identified by `sessionKey`. It owns at most one Crepe instance. Ordinary Markdown, mode, recovery, draft, and save-status rerenders remain inside that lifetime.                                                                                                                                                 |
| Saved baseline                  | Exact Markdown returned by the current disk read or successful save.                                                                                                                                                                                                                                                                              |
| Authoritative current Markdown  | Exact content Azurite currently attributes to disk, a recovered draft, acknowledged source input, or an acknowledged WYSIWYG document change. This is Zustand's `currentMarkdown`.                                                                                                                                                                |
| Content dirty                   | Whether authoritative current Markdown differs from the saved baseline after CRLF-to-LF normalization only. This fact does not decide whether a recovered browser record still needs explicit disposition.                                                                                                                                        |
| Recovery disposition            | Whether the session owns no recovered record, an unresolved ordinary recovered draft, or an unresolved conflict. An ordinary recovered record remains unresolved until explicit successful Save or Discard, even when its Markdown compares clean; the current conflict workflow remains blocked from Save and resolves through explicit Discard. |
| Synchronization checkpoint      | A controller-local pair: exact authoritative Markdown supplied at editor creation or source-to-WYSIWYG synchronization, and Milkdown's serialized projection of that same document. It allows Undo back to that document to restore the exact source bytes.                                                                                       |
| Acknowledged WYSIWYG projection | The most recent projection whose resulting authority publication succeeded. A separate in-progress publication guard suppresses re-entrant echoes; a failed publication remains retryable and never advances this acknowledged projection.                                                                                                        |
| Accepted content change         | Exact source textarea input, or a changed projection read from the ready, active WYSIWYG document while no Azurite-owned synchronization is in progress. Its typed result carries `sessionKey`, origin, publication trigger, and authority resolution. It is an observable ownership classification, not a claim about psychological intent.      |
| Synchronization                 | Editor construction, readiness, controller-owned source-to-WYSIWYG replacement, WYSIWYG-to-source display, or same-mode selection. Its typed result is observable by later diagnostics but never becomes dirty by itself.                                                                                                                         |
| Draft mutation snapshot         | An immutable cluster ID, note ID, `sessionKey`, editor revision, base hash, exact Markdown, editor mode, content-dirty fact, and recovery disposition captured before an ordered draft mutation starts.                                                                                                                                           |
| Draft ownership state           | Ephemeral knowledge of whether the session loaded a recovered record, has no session-owned record, or has a latest queued/completed mutation snapshot. It prevents pristine clean sessions from issuing speculative deletes while still ordering cleanup after a draft was actually written.                                                      |
| Draft mutation coordinator      | An ephemeral per-cluster/note queue that orders write, clean-session deletion, explicit discard, and successful-save reconciliation. It does not enter Zustand snapshots or Dexie records and does not replace Dexie as persistence owner.                                                                                                        |
| Handoff freeze                  | A React-owned temporary state entered after the outgoing editor's live Markdown is acknowledged and before a destructive transition waits for durability. The whole outgoing article is visibly busy and inert, including editor and toolbar controls, while the sidebar remains available for later route intents.                               |
| Durability result               | A typed result for one draft mutation snapshot: `clean` means the snapshot is content-clean, has no unresolved recovery, and no session-owned draft remains; `durable` means the exact snapshot already exists or was written successfully as a scoped recovered draft; `unavailable` means a required write or cleanup failed.                   |
| Legacy ambiguous draft          | A valid draft created before this contract whose record cannot prove whether serializer normalization or accepted editing produced it. Azurite treats every loaded valid record conservatively and preserves it until explicit Save or Discard because the unchanged schema cannot classify its origin safely.                                    |

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
   - Source input accepted during creation updates the visible local source value
     and publishes it to Zustand immediately without mutating the creating Crepe
     instance. It becomes acknowledged authority only when publication succeeds.
   - If WYSIWYG remains active and authority has not changed during creation,
     capture `crepe.getMarkdown()` and the exact initial authority as the first
     synchronization checkpoint, and initialize the acknowledged projection
     from it.
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
     WYSIWYG is the active mode and only when it differs from the acknowledged
     WYSIWYG projection or matches an unacknowledged retry.
   - Ignore delayed WYSIWYG listener work while source mode is active; newer
     exact source input owns authority until explicit source-to-WYSIWYG
     synchronization.
   - Use a controller-local in-progress publication guard to suppress re-entrant
     echoes. Do not advance acknowledged projection or authority before Zustand
     accepts the publication, and do not move the synchronization checkpoint on
     each rich edit.
   - When the new projection equals the checkpoint projection, restore and
     publish the checkpoint's exact authoritative Markdown. This makes Undo back
     to the synchronized document recover the original syntax and clean state.
   - Otherwise publish the new serialization once as a `wysiwyg_document`
     content change. Advance local authority and acknowledged projection only
     after publication succeeds.
   - If publication fails, retain a retryable unacknowledged change, expose the
     editor failure, and block destructive continuation. A later listener or
     explicit commit retries the same exact publication rather than treating it
     as an acknowledged no-op.
   - If the live WYSIWYG document changes again before acknowledgement, replace
     the retry candidate with the latest exact live projection while keeping the
     last acknowledged authority unchanged. Intermediate rejected publications
     do not become product revisions.
   - Expose a visible retry action for an unacknowledged publication so retaining
     the edit does not depend on another editor callback occurring by chance.
   - A projection equal to the acknowledged projection is a no-op only when no
     retryable publication exists, even if Milkdown reports a document
     transaction.

4. **Pre-transition commit and asynchronous ownership handoff**
   - A React-owned editor-session handoff boundary retains only the current
     controller capability and session-scoped freeze state. It never owns or
     stores route targets. Crepe runtime objects and functions do not enter
     Zustand, Dexie, or serialized product state.
   - Before source-mode activation, note selection, URL-driven note replacement,
     Back/Forward synchronization, manual save, or another in-app action can
     destroy or supersede a ready WYSIWYG session, synchronously read
     `crepe.getMarkdown()` while the instance still owns the session.
   - If that projection differs from the acknowledged projection or a retryable
     publication exists, process it once through the same checkpoint-aware
     WYSIWYG transition.
   - If the synchronous projection read or acknowledged authority publication
     fails, keep the current surface and mode active, cancel the requested
     in-app action, and expose the editor failure. Never continue into
     destruction with an unknown or unacknowledged live projection.
   - WYSIWYG-to-source and manual Save are non-destructive same-session actions.
     Commit first, then continue without reconstructing Crepe. A successful Save
     updates the saved Markdown, content hash, note metadata, recovery, and save
     status in the existing `sessionKey`; it preserves mode, current document,
     selection, synchronization checkpoint, and Undo history.
   - For sidebar selection, URL-driven note replacement, and Back/Forward,
     acknowledge accepted authority, enter the handoff freeze, capture an exact
     draft mutation snapshot, and resolve its durability result before starting
     the store action that may eventually replace the session.
   - Make the entire outgoing article visibly busy and inert while the gate or
     note read is pending. Set `aria-busy`, expose concise `Opening note...`
     status text, and prevent its editor, Save, mode, and Discard controls from
     accepting pointer, keyboard, touch, or IME input. Keep the note list
     interactive so a newer route intent can still be expressed.
   - The handoff boundary may decide that the active editor session does not need
     replacement, but it must not declare the route action itself a same-note
     no-op. A temporarily rendered note and current route intent are distinct
     until Slice 7F establishes their shared owner.
   - While a handoff is pending for one `sessionKey`, additional destructive
     callers reuse its commit and durability promise. Each caller retains its own
     target and existing Slice 7B evidence; the coordinator does not choose or
     coalesce targets.
   - Continue a destructive transition only after a snapshot-specific `clean` or
     `durable` result and a fresh check that the same session still owns the
     controller. Close that controller before starting the asynchronous store
     transition so later editor/plugin work cannot create an unowned change.
   - If an ordered required write or clean-session cleanup is `unavailable`,
     cancel that destructive transition, leave the same Crepe
     instance/session/Undo history active, remove the handoff freeze, restore
     focus to the previously focused outgoing control when it still exists, and
     expose the existing degraded-recovery state. Sidebar selection must not push
     a new URL.
   - If Back/Forward already changed the URL, replace it with the still-active
     note only when the failed URL intent is still current. Never overwrite a
     newer URL. This narrow failure rollback does not repair or absorb the
     separate general route/sidebar selection finding.
   - If another session replaces the editor while durability is pending, the old
     result may finish its own scoped persistence but cannot close, unfreeze,
     roll back, or continue through the newer session.
   - A projection equal to acknowledged authority commits nothing. Do not create
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
   - Update the visible local source value and publish it immediately. Do not
     normalize line endings or Markdown syntax at this boundary. Advance
     acknowledged authority only after Zustand accepts the publication.
   - If publication fails, keep the exact local value visible, expose the editor
     failure, retain a retryable unacknowledged change, and block destructive
     actions until that same value is acknowledged. Expose the same explicit
     publication retry. Later source input replaces the retry candidate with the
     latest visible exact value while acknowledged authority remains unchanged;
     successful publication then supersedes the older authority once.
   - React rerenders and delayed callbacks from the hidden WYSIWYG surface must
     not replace newer source input.

7. **Source to WYSIWYG**
   - Do not activate or reveal WYSIWYG while Crepe is creating or failed.
   - Replace the Crepe document from the exact authoritative source value using
     the established `replaceAll(..., true)` integration only after readiness.
   - Treat the replacement and any resulting listener echo as synchronization.
   - Capture the exact source authority and resulting serialized projection as a
     new synchronization checkpoint, and reset the acknowledged projection
     without publishing it as content.
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
     checkpoint, and acknowledged projection.

9. **Dirty, draft, and save decisions**
   - Content dirty means authoritative current Markdown differs from the saved
     baseline after CRLF-to-LF normalization only.
   - Recovery disposition remains independent. Returning a recovered draft to
     content equal to disk does not silently resolve or delete its browser
     record.
   - Clean mode changes do not write a draft. A `recovery: none` session that
     previously wrote a draft and later returns clean removes only its own
     session-owned record through the ordered mutation boundary. That required
     cleanup must complete before a destructive handoff reports `clean`.
   - Save remains disabled for content-clean `recovery: none` sessions, and a
     direct programmatic save call returns without an API request. An ordinary
     unresolved `recovery: draft` session deliberately keeps Save available even
     when content compares clean so explicit Save can dispose of the recovered
     record through the content-hash contract. Conflict Save remains blocked.
   - Real dirty content continues through the existing draft and conflict
     contracts, but every persistence mutation uses an immutable snapshot and
     the per-cluster/note coordinator.
   - The draft flush boundary returns a snapshot-specific durability result.
     Destructive note/route transitions may proceed after `clean` or `durable`
     for the exact still-active session, but not after `unavailable`. Save and
     mode switching retain the current session and do not depend on a successful
     draft write to avoid losing the only live copy.

10. **Legacy ambiguous draft compatibility**
    - Do not automatically delete, canonicalize, or semantically classify a
      valid pre-7C draft whose origin cannot be proven by its existing schema.
    - Recover it through the existing draft/conflict UI and preserve its exact
      Markdown, base hash, note/cluster scope, and editor mode.
    - Ordinary recovered drafts keep Save and Discard available until one
      explicit disposition succeeds, including when the recovered Markdown
      compares clean or is edited back to the saved baseline. Explicit Save
      continues through the content-hash contract. Explicit Discard deletes that
      draft, reloads exact disk Markdown, and must remain clean through readiness
      and mode switching.
    - The existing discard action is exposed for both ordinary recovered drafts
      and conflicts, with recovery-appropriate confirmation copy. Pristine notes
      do not gain a discard action. After confirmation, discard intentionally
      bypasses transition capture because deleting all recovered/current draft
      work is the requested destructive outcome.
    - Completion evidence must distinguish prevention of new projection-only
      drafts from preservation of already stored ambiguous drafts.

11. **Ordered draft mutation ownership**
    - Initialize ephemeral draft ownership as `recovered` from a loaded valid
      record or `none` for a pristine session. Track the latest queued and
      completed snapshot after that; do not probe or delete IndexedDB merely to
      prove a pristine clean session has no record.
    - Capture the immutable draft mutation snapshot before calling persistence;
      do not re-read whichever editor happens to be current after an await.
    - Serialize `writeDraft`, clean-session `deleteDraft`, explicit Discard, and
      `deleteDraftIfSavedSnapshotMatches` per cluster/note key. Different notes
      remain independent.
    - An older mutation may finish and report its own result, but cannot apply
      degraded status, cleanup ownership, or a durability decision to a newer
      session without exact-session revalidation.
    - Successful-save cleanup remains conditional on the exact saved snapshot.
      A newer queued draft write must survive and use the new saved baseline.
    - The queue is ephemeral runtime infrastructure. Do not add mutation IDs,
      origins, or controller state to the version-one draft record.

## Installed Editor And Persistence API Evidence

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
- IndexedDB 3.0 schedules overlapping read/write transactions by creation order,
  but Azurite's injected `DraftPersistence` type does not currently express
  per-note ordering or exact-session result ownership.
- The existing memory persistence adapter settles mutations synchronously, so it
  cannot prove delayed ordering without the controllable adapter required by
  this slice.

Those facts support the explicit authority/projection state machine and the
public-API-first transition commit. Do not add arbitrary DOM-event guesses,
depend on undocumented callback ordering, or install lower-level transaction
integration speculatively. If real implementation evidence proves the public
boundary cannot retain accepted edits or distinguish controller synchronization,
pause and update this contract before choosing another mechanism.

The IndexedDB scheduling evidence supports production storage behavior, while
the Azurite-owned mutation coordinator makes ordering explicit above Dexie and
testable through the same injected boundary. See
`docs/research/platform-and-frontend.md` for the primary source and lifecycle
caveat.

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
- Represent accepted changes with one discriminated domain result carrying exact
  Markdown, `sessionKey`, origin (`source_input` or `wysiwyg_document`),
  publication trigger (`direct_input`, `listener`, or the specific pre-action
  commit reason), and authority resolution (`exact_input`,
  `serialized_projection`, or `checkpoint_restore`). This is a telemetry-free
  seam for Slice 7D.
- Change the parent publication boundary to return a typed acknowledgement with
  the exact `sessionKey`, resulting revision, and Markdown accepted by Zustand,
  or an exact rejection. If a Zustand update throws after partial application,
  determine acknowledgement from exact store readback rather than blindly
  retrying and incrementing the revision twice.
- Represent synchronization and commit success/failure as typed results rather
  than inferring them from callback counts or thrown side effects.
- Expose a narrow controller capability that can synchronously commit the
  current ready WYSIWYG projection before a React-owned transition continues.
- Make synchronous commit return an explicit acknowledged/no-op/failure result.
  A failed public `getMarkdown()` or authority publication cannot be mistaken
  for a clean no-op.
- Keep acknowledged projection separate from in-progress or failed publication.
  A controller-local publication guard may suppress re-entrant echoes, but a
  failed publication remains retryable and blocks destructive continuation.
- Expose a narrow explicit retry capability and visible editor failure action for
  the current unacknowledged publication. Do not require another Milkdown
  callback or unrelated user edit to retain it.
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
- Advance local acknowledged authority and projection only after the store
  accepts the typed change. Preserve and visibly report retryable source or
  WYSIWYG publication failure.
- Make WYSIWYG-to-source read and reconcile the live projection before the mode
  switch, so a rapid edit is not lost to listener debounce.
- Make source-to-WYSIWYG replace the document after readiness, reset the
  synchronization checkpoint and acknowledged projection without publishing
  serializer normalization, and reveal WYSIWYG only after success.
- Treat repeated clicks on the already active mode as no-ops.
- If create or source synchronization fails, activate or retain source mode,
  preserve exact source editing, and expose WYSIWYG as unavailable instead of
  degrading the whole editing surface.
- Preserve current loading/error UI and cleanup. Rejected create/destroy work
  remains contained and stale instances cannot publish.
- Preserve the block controls and all current Crepe features; this slice must
  not opportunistically change feature configuration.

### 4. Commit And Freeze The Active Editor Session Before Transitions

Implementation requirements:

- Add a React-owned editor-session handoff coordinator that holds only the
  current controller capability and freeze state. Do not put Crepe instances,
  callbacks, refs, route targets, or other runtime objects in Zustand, Dexie, or
  serializable snapshots.
- Route note selection, URL-driven note replacement, Back/Forward
  synchronization, manual Save, and WYSIWYG-to-source activation through the
  coordinator before their existing store actions continue.
- For a ready WYSIWYG session, synchronously read and reconcile
  `crepe.getMarkdown()`. Cancel the requested in-app action and retain the
  current editor if the commit fails.
- Model destructive note/route handoff explicitly: acknowledge the live commit,
  freeze the outgoing article, capture an immutable draft mutation snapshot,
  resolve its typed durability result, revalidate exact-session ownership,
  close the controller, and only then start the existing asynchronous store
  transition.
- Render the frozen article with `aria-busy`, concise visible status, and inert
  editor/toolbar controls. Preserve the previously focused outgoing element for
  failure restoration while leaving the note list interactive. Successful
  replacement does not steal focus from the activated navigation control.
- Keep one handoff commit/durability operation per `sessionKey`. Overlapping
  callers reuse that operation but retain their own route targets and Slice 7B
  evidence. Do not suppress a route action merely because its target matches the
  temporarily rendered editor.
- Change the pending-draft flush boundary to accept an immutable snapshot and
  return snapshot-specific `clean`, `durable`, or `unavailable`. An unavailable
  required write or clean-session cleanup cancels selection/history
  synchronization and unfreezes the same editor session.
- Keep URL ownership bounded on a canceled transition: sidebar selection does
  not push, and URL-driven Back/Forward failure replaces the route with the
  still-active note only if that failed URL is still current. A stale failure
  cannot overwrite a newer route. Do not change the general route and
  selected-item behavior owned by Slice 7F.
- Refactor successful same-session save reconciliation so it updates the saved
  baseline, hash, note metadata, recovery, and status in place. It must retain
  `sessionKey`, editor mode, current Markdown, revision ownership, Crepe,
  checkpoint, selection, and Undo history rather than calling a fresh-session
  constructor.
- Make transition ownership exact: an old controller cannot delay, cancel, or
  publish into a newer session, and repeated commit requests for an unchanged
  projection are idempotent.
- Commit before invalidation; do not attempt to recover the live projection
  for the first time from React cleanup after Crepe destruction begins.
- Integrate `visibilitychange` and `pagehide` with synchronous projection commit
  followed by the existing best-effort draft flush. Do not claim recovery from
  lifecycle callbacks the browser never executes or from an IndexedDB mutation
  that did not finish.
- Keep the transition boundary on Crepe's public APIs. If it cannot preserve the
  immediate-edit scenarios, invoke scope re-selection before adding lower-level
  editor integration.

### 5. Establish Dirty Equality, Recovery Disposition, And Ordered Draft Mutations

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
- Keep recovery disposition separate from the equality helper. Preserve an
  unresolved `recovery: draft` record even when content compares clean or is
  edited back to the saved baseline.
- Ensure editor-mode-only updates do not imply dirty content and do not create a
  draft record for a `recovery: none` pristine note.
- Keep `canSaveEditor` as the defensive API boundary: content-clean
  `recovery: none` sessions never call `saveNote`, even if UI code invokes the
  action directly. An unresolved ordinary recovered draft remains explicitly
  saveable; conflicts remain blocked.
- Add a focused ephemeral per-cluster/note draft-mutation coordinator. Route
  draft writes, clean-session deletion, explicit Discard, and successful-save
  exact-snapshot cleanup through it while different notes remain independent.
- Track per-session draft ownership from load and completed mutations. A
  pristine clean session with no owned record returns `clean` without issuing a
  speculative delete; a session that actually wrote a draft must complete its
  ordered cleanup before returning `clean`.
- Capture mutation input before the first await and revalidate `sessionKey` plus
  revision before applying session-visible results. Do not let a late mutation
  degrade, clean, close, or unblock a newer session.
- Preserve the existing Slice 7B single-flight, edit-during-save,
  session-ownership, conflict, failed-save, and exact-draft-cleanup behavior
  after its prerequisite repairs.
- Preserve every valid legacy ambiguous draft. Do not infer that a draft is safe
  to delete merely because it equals Milkdown's projection of disk content.
- Expose the existing confirmed discard-and-reload action for ordinary
  `recovery === "draft"` sessions as well as conflicts. Keep Save and Discard
  available for an unresolved ordinary recovered draft even when its content
  compares clean. Use recovery-appropriate text and keep both recovery actions
  absent for pristine sessions.

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
  - a thrown source or WYSIWYG publication retains exact visible content as an
    unacknowledged retry, blocks destruction, and publishes successfully once
    through the visible retry action without duplicating the revision;
  - a publication whose Zustand mutation applied before a subscriber throws is
    recognized by exact store readback and is not published or revised twice;
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
- Add React handoff-coordinator tests for WYSIWYG edit followed immediately
  by source mode, note selection, route replacement, Back/Forward, Save,
  visibility change, and page hide. Assert projection commit occurs before store
  flush/transition and before destruction.
- Add a deferred-note-read case that holds the replacement response, proves the
  outgoing article is visibly busy and inert after its commit, resolves inside
  the listener debounce window, and confirms the exact committed edit is
  durable. Assert `aria-busy`, status text, disabled editor/toolbar interaction,
  interactive note-list navigation, and no automatic focus theft after success.
- Prove a route target matching the temporarily rendered note does not let the
  handoff coordinator suppress the caller's route action. Overlapping
  note/history callers reuse one session gate while retaining independent route
  targets and Slice 7B operation evidence.
- Simulate unavailable required draft persistence for sidebar selection and
  Back/Forward. Prove the store transition does not start, the URL remains or is
  restored only when that failed intent is still current, a newer URL is never
  overwritten, the same editor and Undo history are unfrozen, prior focus is
  restored when possible, and manual Save remains available.
- Settle a pre-existing note read while the durability result is pending and
  prove the old result can finish its scoped persistence but cannot close,
  unfreeze, roll back, or continue through the replacement session.
- Extend `SaveableNoteEditor` tests to consume the shared dirty helper and prove
  exact syntax changes remain dirty while CRLF/LF-only differences remain clean.
- Drive one shared parameter table through the comparison helper, Save/UI
  eligibility, store draft decisions, production Dexie saved-snapshot
  reconciliation, and the memory persistence adapter. Every consumer must treat
  CRLF/LF-only differences as equal and intentional syntax/whitespace changes as
  different.
- Add deferred draft-mutation tests that prove per-key creation order and exact
  snapshot ownership for older-write/newer-write, dirty-write/clean-delete,
  clean-delete/newer-write, successful-save cleanup/newer-draft, explicit
  Discard/pending-write, and different-note independence. The memory adapter
  must be delayable rather than resolving every mutation synchronously.
- Prove a pristine clean session performs no speculative draft deletion, while a
  session that durably wrote and then reverted completes its ordered deletion
  before destructive handoff reports `clean`.
- Extend note-browser store tests to prove:
  - pristine load plus editor readiness creates no draft;
  - mode-only changes leave no draft after flush;
  - a content-clean `recovery: none` programmatic save makes zero API calls;
  - a real source or WYSIWYG accepted change schedules one recoverable draft;
  - reload does not report recovery from projection-only normalization;
  - an existing deliberate recovered draft retains its exact Markdown and
    recovery state without being replaced by the editor projection;
  - a seeded valid pre-7C projection-only draft is preserved as ambiguous until
    explicit save or discard, and discard returns to exact clean disk authority;
  - an ordinary recovered draft that compares clean or is edited back to the
    saved baseline retains its record plus explicit Save and Discard until one
    disposition succeeds, while pristine sessions expose neither action;
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
  names exact Markdown authority, acknowledged WYSIWYG projection, ordered
  browser-draft mutation ownership, recovery disposition, and the real-edit
  serialization boundary.
- Update this slice with concise completion evidence rather than duplicating
  full browser logs.
- Add a focused QA record under `docs/qa/` containing fixture names, before/after
  hashes, browser results, IndexedDB proof, and any observed WYSIWYG
  normalization after an accepted edit.
- Record prevention of new projection-only drafts separately from preservation
  and explicit disposition of seeded legacy ambiguous drafts.
- Record the implemented typed accepted-change, synchronization, commit, and
  durability result shapes as the input for Slice 7D's required promotion
  refresh. Slice 7D must distinguish raw projection observation from accepted
  authority change and must not require an editor session ID before draft read
  and editor-session creation complete.
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
  Save, note, route, or history transitions through Crepe's public
  `getMarkdown()` and lifecycle APIs. Browser lifecycle callbacks remain
  best-effort until their asynchronous draft mutation completes.
- Correct transition ownership requires storing Crepe runtime state in Zustand
  or Dexie instead of a React-owned ephemeral boundary.
- Preventing edits during asynchronous note replacement cannot be implemented
  as a React-owned session handoff freeze without making that coordinator own
  route targets or replacing the established note-loading architecture.
- A failed snapshot-specific durability result cannot retain the active session
  and cancel only its still-current URL intent without introducing another state
  owner, durable store, or general route-selection capability. Do not silently
  build those broader foundations inside 7C.
- Pre-ready source input cannot remain authoritative without mutating Crepe
  before `create()` resolves.
- Deterministic accepted-change ownership for supported in-app transitions
  requires transaction-origin integration below Crepe's public listener API.
  The deliberately accepted passive dirty-indicator debounce alone is not a
  trigger.
- The only correct solution requires token-level source reconciliation or a
  canonicalization migration for existing notes.
- Fixing false dirty or ordering exact draft mutations requires changing the
  draft schema, content-hash API, or filesystem write contract.
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
- A handoff freeze must be visible and accessible, disable the complete outgoing
  article rather than only the editor body, leave later note-list intent
  possible, and restore prior focus after failure when possible.
- A failed required draft mutation must not destroy or supersede the only live
  copy; the same session, Crepe instance, and Undo history remain available.
- An older draft mutation must not overwrite newer recovery truth, delete a
  newer draft, degrade a newer session, or authorize destruction of a different
  snapshot.
- A same-session rerender must not reconstruct Crepe, reset Undo history, move a
  synchronization checkpoint, or duplicate an editor DOM tree.
- Successful Save settlement must not end a same-note editor session or cancel a
  WYSIWYG edit still waiting for Milkdown's debounced listener.
- Source edits accepted while Crepe creates must not call the unready editor,
  disappear at readiness, or reveal stale WYSIWYG content.
- A stale Crepe instance must not overwrite newer source input or a newly opened
  editor session.
- Failed source or WYSIWYG publication must not advance acknowledged authority,
  become an unretryable no-op, or permit a destructive transition.
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
- A recovered draft that compares clean or is edited back to disk content must
  remain unresolved and explicitly disposable; content equality alone cannot
  delete it.
- Ordinary recovered legacy drafts must not become practically undiscardable
  merely because their base hash still matches disk.
- Crepe instances and controller capabilities must remain ephemeral React-owned
  runtime state, not a second product-state owner in Zustand or Dexie.
- The editor-session handoff coordinator must not become a second route-target
  owner or suppress existing Slice 7B operation evidence.
- Discarding a conflict must restore exact disk Markdown and remain clean until
  the next real edit.
- Existing safe URL, filesystem boundary, Sentry-disabled, request-correlation,
  and content-hash guarantees must remain unchanged.
- Browser lifecycle flush evidence must distinguish a completed durable draft
  from a best-effort mutation that was only started.
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
Follow `docs/runbooks/playwright-acceptance.md` for the shared runtime, device,
state-owner, evidence, and cleanup procedure.
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
   dirty while source remains visible and stale WYSIWYG content cannot appear.
   Observe the exact draft mutation complete before claiming recoverability.
   After readiness, enter WYSIWYG and confirm it shows the latest source rather
   than the stale construction value.
9. In the test-only browser lifecycle harness, hold the real component's create
   promise pending and repeat the pre-ready activation attempt deterministically;
   then reject creation and confirm exact source remains editable, WYSIWYG stays
   unavailable, failure is visible, and no content callback/draft is invented.
   Run this harness through Vite development and its optimized harness build.
10. Make one deliberate WYSIWYG edit and switch immediately to Markdown; confirm
    the edit is present, dirty, and saveable, then observe the exact ordered
    draft mutation complete before claiming it is recoverable and durable.
    Record any broader Milkdown syntax normalization honestly as the accepted
    real-edit boundary.
11. Repeat an immediate WYSIWYG edit before Save, sidebar selection, Back, and
    Forward; confirm the public pre-transition commit and acknowledged
    publication complete before the action continues. Separately, make an edit,
    observe its exact draft as durable, reload, and confirm recovery. For
    `visibilitychange` and `pagehide`, confirm synchronous commit precedes the
    best-effort flush attempt and claim recovery only when IndexedDB completion
    is observed.
12. Hold a Save request pending, edit in WYSIWYG, settle Save before the
    200-millisecond listener, and confirm the same Crepe DOM, mode, selection,
    checkpoint, and Undo history remain. After the listener settles, confirm the
    newer edit is dirty and recoverable against the updated saved baseline.
13. Hold a replacement note read pending after sidebar and Back/Forward
    navigation. Confirm the outgoing article becomes visibly busy, `aria-busy`,
    inert to editor and toolbar input, and still allows a newer note-list intent.
    Settle the read inside the listener debounce window and prove the committed
    edit recovers exactly on reopen without automatic focus theft.
14. Force both a dirty-draft write and a required clean-session draft deletion
    used by sidebar and Back/Forward handoff to fail. Confirm no note load starts,
    sidebar navigation does not push, only the still-current failed URL is
    replaced with the active note, a newer URL is preserved, the same editor and
    Undo history become interactive again, prior focus is restored when
    possible, degraded recovery is visible, and manual Save remains available.
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
19. Seed an ordinary recovered draft that compares clean, edit another recovered
    draft back to its saved baseline, and confirm each record plus Save and
    Discard remain until explicit disposition.
20. Navigate rapidly between notes during editor creation and confirm stale
    callbacks never alter the current note.
21. Delay and reorder draft persistence around edits, cleanup, Save, Discard,
    and navigation; confirm the final IndexedDB record matches the newest ordered
    snapshot and different notes remain independent.
22. Wait through readiness and delayed configured-plugin activity without input;
    confirm no post-ready non-authoritative document change becomes accepted
    content.
23. Confirm the normal production console has no new errors or warnings.

### Synthetic Mobile QA

Use the Codex Playwright skill's bundled browser with a Pixel 6-class mobile
Chrome profile and follow `docs/runbooks/playwright-acceptance.md`. Exercise both
development and the optimized production preview with mobile viewport, device
scale, touch input, mobile user agent, and a CPU-throttled cold start:

- repeat pristine open, readiness, mode-only switching, reload, draft absence,
  and file-hash proof;
- attempt source editing during the visible preparing state, then activate
  WYSIWYG before readiness and confirm activation is refused, then activate it
  after readiness and confirm the latest source is shown;
- run the pending-create and rejected-create browser harness with mobile viewport,
  user agent, touch, and CPU throttling, confirming source remains editable;
- prove same-session rerenders retain one editor DOM tree and preserve Undo;
- hold note replacement pending and confirm the visible busy/inert state prevents
  touch, keyboard, and toolbar input after its handoff commit while later
  note-list intent remains possible;
- make a WYSIWYG edit and immediately switch mode, select another note, use
  Back/Forward, and confirm supported in-app transitions retain the edit;
- observe an exact draft as durable before reload and confirm it recovers; and
- inspect touch interaction, console output, network requests, and IndexedDB.

Synthetic mobile evidence is the required phone-acceptance path. It covers
viewport, touch, throttled lifecycle, and mobile-browser emulation. It does not
claim to model a physical Android IME, device performance, Tailscale, or
hardware-specific Chrome behavior; Daniel may request those as supplemental
evidence, but they are not completion gates.

### Optional Physical-Phone Smoke QA

If Daniel requests supplemental physical evidence, repeat the non-input
fidelity smoke on the Pixel 6 through the established Tailscale runbook:

- open a disposable real-format note in WYSIWYG;
- wait for readiness and confirm `Saved` with Save disabled;
- switch to Markdown and back without typing;
- reload and confirm there is no false recovered draft; and
- confirm the file hash remains unchanged.

This smoke does not claim to fix or accept the separate Android Enter newline
finding. That remains the mandatory correctness work after Slice 7D.

## Acceptance Criteria

- Fidelity fixtures and pristine mode-only workflows satisfy Required
  Transitions 1–3 and 5–7 without changing authority, dirty state, drafts, Save
  eligibility, or disk bytes in development and optimized production.
- Source remains exact and usable through pending or failed Crepe creation, and
  ordinary WYSIWYG updates use the accepted bounded listener debounce while
  every supported in-app action retains a newer live projection synchronously.
- Accepted publication is acknowledged exactly once; failed publication remains
  visible and retryable and cannot authorize destruction or mutate another
  session.
- Required Transitions 4 and 8 preserve one Crepe instance, selection,
  checkpoint, and Undo history through same-session rerenders and successful
  Save while making destructive handoff visibly busy, inert, exact-session, and
  durable before replacement.
- The handoff coordinator owns no route targets or final route coherence. A
  failed gate cancels only its still-current intent, cannot overwrite a newer
  URL, restores the outgoing session, and leaves manual Save available.
- Required Transitions 9–11 use one CRLF/LF-only content comparison plus separate
  recovery disposition and ordered per-note draft mutation ownership. Deferred
  mutation tests prove that older writes, cleanup, Save, and Discard cannot
  supersede newer recovery truth.
- Content-clean `recovery: none` sessions cannot save programmatically. Every
  valid ordinary recovered draft remains explicitly saveable and discardable
  until disposition, including after comparison to or editing back to disk;
  conflicts retain their existing blocked-Save behavior.
- Exact source and WYSIWYG edits become durable, save through the content-hash
  contract, and recover after reload once the matching draft or save completes.
  Browser lifecycle flush attempts are not reported as durable without observed
  IndexedDB completion.
- Typed accepted-change, synchronization, commit, and durability results expose
  session and cause truth for Slice 7D without adding Sentry behavior or making
  diagnostics a state owner.
- Architecture and QA evidence record exact authority, acknowledged projection,
  ordered draft ownership, legacy disposition, same-session Save, and the honest
  post-WYSIWYG serialization limitation. Unrelated findings remain separately
  tracked.
- Desktop and synthetic Pixel 6 QA pass in development and optimized production
  without claiming the Android input bug or requiring physical-phone evidence.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`,
  `git diff --check`, clean `main`, and synchronization with `origin/main` pass.

## Open Questions

None for planning. The product decision, source-of-truth boundary, bounded
WYSIWYG dirty-state latency, completed-draft reload guarantee, real-edit
limitation, implementation sequence, scope exclusions, and completion proof are
explicit. Literal pre-debounce dirty indication and unload-warning UX remain
evidence-gated future hardening rather than unresolved 7C decisions. New
contradictory runtime evidence must use the scope re-selection triggers above.
