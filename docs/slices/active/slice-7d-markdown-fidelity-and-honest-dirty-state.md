# Slice 7D: Markdown Fidelity And Honest Dirty State

## Status

Active as of 2026-07-13 after Slice 7C implemented and verified its validated
action-aware history owner, typed target-free pre-transition gate, rendered
outgoing-session identity, route-or-reload load authorization, exact-current
revalidation, coherent no-op predicate, and typed terminal outcome. This slice
consumes that implemented seam without becoming a second route owner.

The 2026-07-13 adversarial review proved that the earlier plan secretly depended
on those route guarantees while calling route coherence a non-goal. In
particular, the pre-7C rendered-note-only skip could return after this slice had
closed the outgoing controller, leaving no replacement session. A note ID alone
also could not identify which of two same-target history intents might continue
or cancel. The scope was therefore re-selected to
`7B -> 7C -> 7D -> 7E -> 7F`.

This revision also makes five previously implicit failure boundaries explicit:

1. draft cleanup failure has a store-owned, user-actionable disposition even
   when content is clean;
2. publication acknowledgement includes immutable draft-snapshot admission and
   survives a subscriber throwing after Zustand mutation;
3. draft reads, scheduled work, writes, cleanup, Save reconciliation, and
   Discard share one ordered per-note boundary;
4. Discard is terminal for one draft-admission epoch, advances to a fresh epoch
   on deletion failure, and reloads only after successful deletion; and
5. Slice 7E's post-implementation diagnostics refresh is a hard promotion gate,
   not a wording pass.

The earlier accepted decisions remain intact: bounded WYSIWYG dirty-indicator
latency, completed-draft reload proof, exact text equality, and no unload-warning
UX. Literal pre-debounce status and unload confirmation remain future hardening
rather than Slice 7D prerequisites.

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

Acknowledgement is not merely a successful Zustand mutation. Before mutating
Zustand, the exact command synchronously prepares an inactive immutable
draft-mutation snapshot. It then applies the exact-session revision and commits
that prepared snapshot to scheduled persistence. If a subscriber throws after
the updater applied, the command's local `didApply` fact commits the already
prepared snapshot exactly once before acknowledging. Preparation failure occurs
before state mutation, and a rejected publication always has `stateEffect:
none`; readback repair is neither required nor sufficient.

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

Draft persistence is an ordered workflow, not write-only serialization. Reads,
debounced snapshots that have been scheduled but not yet queued, writes,
cleanups, successful-save reconciliation, and explicit Discard all cross one
per-cluster/note boundary. Content equality and browser-record disposition are
separate facts: a saved or otherwise clean session may still require explicit
cleanup retry after IndexedDB deletion fails.

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
- Order draft reads, scheduled snapshots, writes, cleanups, explicit Discard,
  and successful-save reconciliation per cluster/note key so an older mutation
  cannot supersede a newer durability decision or a read cannot overtake pending
  work.
- Make editor-session handoff a pre-transition gate consumed by Slice 7C's
  route-transition owner. Slice 7C alone retains intents, targets, history
  admission/restoration, selected-versus-rendered coherence, and terminal route
  outcomes.
- Keep source editing usable while Crepe is creating or unavailable without
  calling editor APIs before readiness.
- Keep content-dirty equality on one shared comparison contract while treating
  all browser-record disposition, including cleanup failure after Save, as a
  separate store-owned product fact.
- Make authority publication and draft-snapshot admission one acknowledged
  operation even when Zustand listeners throw after state mutation.
- Make Discard terminal for one exact-owner draft epoch: cancel scheduled work,
  delete after earlier admitted mutations, reload only on success, and allocate
  a fresh epoch before restoring the same editor after failure.
- Preserve accepted source and WYSIWYG changes, including one followed
  immediately by a mode switch before Milkdown's debounced listener fires.
- Add fixture-driven regression proof for the real Markdown shapes that exposed
  the defect.
- Leave typed accepted-change, synchronization, commit, and durability results
  that Slice 7E diagnostics can observe without rediscovering which callbacks
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
- Changing the implemented Slice 7C route owner, route identity, coherent no-op
  predicate, history-admission policy, load authorization, or terminal transition
  outcomes.
- Fixing Crepe's block `+` menu, the Android source-mode newline reversion, or
  the unexplained fresh-cluster recovered-draft observation.
- Changing backend-unavailable copy, adding retry UI, lazy-loading the editor,
  changing chunks, or suppressing Vite's size warning.
- Adding Slice 7E Sentry semantics, rich payload capture, or editor telemetry.
- Changing the existing content-hash API, atomic filesystem write behavior,
  draft schema, or recovery ownership.
- Automatically deleting or semantically classifying ambiguous drafts created
  before this authority contract existed.
- Adding a custom ProseMirror transaction plugin while Crepe's public lifecycle,
  `getMarkdown()`, listener, and action APIs can complete the user story.
- Adding unload-warning UX or claiming guaranteed recovery while a browser-draft
  mutation is still pending.
- Reworking the completed Slice 7B save-result ownership repairs; 7D relies on
  their exact-session contract and preserves their regression coverage.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Read exact Markdown from disk or a consistently ordered valid recovery draft, project it into one session-owned Crepe instance, switch modes without inventing an edit, commit and admit accepted content before transitions, preserve or explicitly dispose of every session-owned browser record, and manually save through the existing conflict contract. |
| Predictable extensions | Autosave, external file watching, diff/conflict UI, source/WYSIWYG diagnostics, future editor loading, and multi-client editing all need to distinguish authoritative content from rendered or serialized projections and flush pending editor work before ownership changes.                                                                                 |
| Participating layers   | Milkdown/Crepe lifecycle and serialization, React editor gate registration with Slice 7C, Zustand editor session and draft disposition, Save/Discard/retry controls, scheduled and Dexie persistence work, existing note API and content-hash save contract, Vitest, and real-browser QA.                                                                     |
| Near-term seams        | A focused Markdown-authority controller; a Slice 7C-compatible editor gate; an ordered read/mutation boundary with terminal barriers; acknowledged publication-and-admission results; one comparison helper; session/lifecycle ownership that rejects stale callbacks.                                                                                        |
| Exclusions             | Token-level Markdown reconciliation, automatic legacy-draft classification, new persistence formats, editor replacement, route selection behavior, block-menu behavior, mobile newline repair, observability payloads, and bundle loading can wait because none is required to stop projection-only mutations.                                                |

### Scope Re-selection Result

The asynchronous handoff freeze, ordered draft read/mutation boundary, terminal
Discard barrier, store-owned draft disposition, and snapshot-specific durability
result remain inside Slice 7D. They are required to make “commit before
replacement” and “browser record resolved” true. Omitting them permits a
debounced edit, stale read, older write, failed cleanup, or post-Discard timer to
outlive the exact session being handed off.

Slice 7C is the completed prerequisite for this active slice; it is not a
sibling exclusion. Its owner validates and admits each history intent,
passes this slice the exact rendered outgoing session, revalidates after the gate
settles, starts or skips the route transition, restores cancelled traversal when
required, and returns the terminal route outcome. This slice receives the current
outgoing session and gate cause only. It never receives or retains a target,
chooses among callers, blocks/restores history, or decides whether selected and
rendered notes are coherent.

The gate may share one in-flight commit/durability operation for the same editor
session, but each Slice 7C call owns a unique target-free lease and independently
consumes the result. `continue` does not promise replacement. Slice 7C settles
each allocated lease with only terminal status and surface effect; the gate's
refcount releases or destroys the matching session without seeing an intent or
leaving an active controller closed.

The store-owned draft disposition is not a new persistence format. It represents
whether the current session's existing Dexie record is absent, generated,
recovered, conflicted, or known to require cleanup. The per-note coordinator
orders the existing storage boundary and may deliberately specialize the
existing `KeyedTaskCoordinator`; it does not replace Dexie as persistence owner.
If implementation requires a schema migration, new route capability, or another
durable state owner, the Scope Re-selection Triggers apply instead of silently
expanding Slice 7D.

## Authoritative Markdown Contract

This section is the single authoritative home for the slice's state-transition
decision. Implementation comments and tests should reference or summarize it,
not create competing definitions.

### State Terms

| Term                            | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor session                  | One store-owned editing lifetime identified by `sessionKey`. It owns at most one Crepe instance. Ordinary Markdown, mode, draft-disposition, and save-status rerenders remain inside that lifetime.                                                                                                                                                                                                                                                                                                                         |
| Saved baseline                  | Exact Markdown returned by the current disk read or successful save.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Authoritative current Markdown  | Exact content Azurite currently attributes to disk, a recovered draft, acknowledged source input, or an acknowledged WYSIWYG document change. This is Zustand's `currentMarkdown`.                                                                                                                                                                                                                                                                                                                                          |
| Content dirty                   | Whether authoritative current Markdown differs from the saved baseline after CRLF-to-LF normalization only. This fact never proves that a browser record is resolved.                                                                                                                                                                                                                                                                                                                                                       |
| Draft disposition               | Store-owned exact-session state: `none` means no session-owned record is known; `generated_pending` means an accepted revision owns scheduled/queued/started work not yet proven durable; `generated_durable` means its exact record completed successfully; `recovered` means a loaded ordinary record awaits Save or Discard; `conflict` means an unresolved record is blocked from Save; `cleanup_required` means content may be saved/clean but a record may remain after required read/deletion/reconciliation failed. |
| Synchronization checkpoint      | A controller-local pair: exact authoritative Markdown supplied at editor creation or source-to-WYSIWYG synchronization, and Milkdown's serialized projection of that same document. It allows Undo back to that document to restore the exact source bytes.                                                                                                                                                                                                                                                                 |
| Acknowledged WYSIWYG projection | The most recent projection whose authority publication and prepared immutable snapshot both committed. Rejected publication has no store revision effect, remains retryable, and never advances this projection.                                                                                                                                                                                                                                                                                                            |
| Accepted content change         | Exact source textarea input, or a changed projection read from the ready, active WYSIWYG document while no Azurite-owned synchronization is in progress. It is an observable ownership classification, not a claim about psychological intent.                                                                                                                                                                                                                                                                              |
| Publication acknowledgement     | A typed exact-session result proving the accepted Markdown and mode own one store revision and its pre-admitted immutable snapshot was committed to scheduled persistence. `no_change` and `rejected` have `stateEffect: none`; state readback alone cannot acknowledge admission.                                                                                                                                                                                                                                          |
| Synchronization                 | Editor construction, readiness, controller-owned source-to-WYSIWYG replacement, WYSIWYG-to-source display, or same-mode selection. Its typed result is observable by later diagnostics but never becomes dirty by itself.                                                                                                                                                                                                                                                                                                   |
| Draft mutation snapshot         | Immutable cluster ID, note ID, `sessionKey`, editor revision, base hash, exact Markdown, editor mode, content-dirty fact, draft disposition, and cause captured when the accepted change or disposition transition is admitted, not when a later timer fires.                                                                                                                                                                                                                                                               |
| Scheduled snapshot              | The newest not-yet-started immutable snapshot owned by a per-note debounce/coalescing slot. It is already part of ordered persistence and cannot be bypassed by a read, Save cleanup, Discard, or handoff drain.                                                                                                                                                                                                                                                                                                            |
| Draft persistence coordinator   | An ephemeral per-cluster/note boundary that orders prepared/committed admission, consistent reads, writes, clean-session cleanup, explicit Discard, successful-save reconciliation, drains, and terminal epoch barriers. Different notes remain independent; task rejection releases the queue; idle keys are pruned.                                                                                                                                                                                                       |
| Handoff freeze                  | React-owned temporary state entered after the outgoing editor's live Markdown is acknowledged and before a destructive transition waits for durability. The article owns `aria-busy`; an inner interaction region is inert; visible/live status remains outside the inert subtree; the sidebar remains available for later Slice 7C intents.                                                                                                                                                                                |
| Durability result               | A typed result tied to one session/revision snapshot: `clean` means content is clean, disposition is `none`, and no admitted record remains; `durable` means the exact snapshot is durably stored; `unavailable` carries a precise admission, identity, read, write, cleanup, or queue reason.                                                                                                                                                                                                                              |
| Draft admission epoch           | A store/runtime generation inside one editor or missing-recovery owner. Every timer, listener, lifecycle callback, and snapshot carries it. Advancing the epoch permanently rejects stale callbacks without requiring Crepe reconstruction.                                                                                                                                                                                                                                                                                 |
| Terminal discard barrier        | An exact-owner/epoch coordinator operation that freezes input, closes that epoch, invalidates not-yet-started work, waits behind earlier started work, and deletes the record. Success reloads/dismisses. Failure allocates a fresh epoch before restoring the same controller/view, so new edits persist while every pre-confirmation callback remains rejected.                                                                                                                                                           |
| Legacy ambiguous draft          | A valid draft created before this contract whose record cannot prove whether serializer normalization or accepted editing produced it. Azurite treats it as `recovered` and preserves it until explicit Save or Discard because the unchanged schema cannot classify its origin safely.                                                                                                                                                                                                                                     |

### Typed Result Contract

These discriminated contracts are authoritative. Implementation may rename a
type only if every variant and field remains equivalent; changing membership,
failure meaning, or state effect requires a plan refresh before code changes.

```ts
type EditorMode = "markdown" | "wysiwyg";
type ChangeOrigin = "source_input" | "wysiwyg_document";
type AuthorityResolution =
  "exact_input" | "serialized_projection" | "checkpoint_restore";
type PublicationTrigger =
  | "direct_input"
  | "listener"
  | "pre_mode_switch"
  | "pre_save"
  | "pre_route_transition"
  | "visibilitychange"
  | "pagehide"
  | "explicit_retry";
type DraftDisposition =
  | "none"
  | "generated_pending"
  | "generated_durable"
  | "recovered"
  | "conflict"
  | "cleanup_required";

type DraftMutationSnapshot = {
  snapshotKey: string;
  clusterId: string;
  noteId: string;
  sessionKey: string;
  draftEpoch: number;
  revision: number;
  baseContentHash: string;
  markdown: string;
  editorMode: EditorMode;
  contentDirty: boolean;
  disposition: DraftDisposition;
  cause:
    | "accepted_change"
    | "generated_clean"
    | "successful_save_cleanup"
    | "cleanup_retry"
    | "discard";
};

type SnapshotPreparationResult =
  | { status: "prepared"; snapshot: DraftMutationSnapshot }
  | {
      status: "rejected";
      sessionKey: string;
      noteId: string;
      draftEpoch: number;
      attemptedRevision: number;
      clusterId: string | undefined;
      reason:
        | "stale_session"
        | "cluster_identity_unavailable"
        | "snapshot_admission_failed";
    };

type PublicationResult =
  | {
      status: "acknowledged";
      stateEffect: "revision_applied";
      sessionKey: string;
      revision: number;
      origin: ChangeOrigin;
      trigger: PublicationTrigger;
      resolution: AuthorityResolution;
      markdown: string;
      editorMode: EditorMode;
      snapshotKey: string;
      disposition: DraftDisposition;
      completion: "normal" | "subscriber_threw_after_apply";
    }
  | {
      status: "no_change";
      stateEffect: "none";
      sessionKey: string;
      revision: number;
      origin: ChangeOrigin;
      trigger: PublicationTrigger;
      reason: "authority_unchanged";
      disposition: DraftDisposition;
    }
  | {
      status: "rejected";
      stateEffect: "none";
      sessionKey: string;
      attemptedRevision: number;
      origin: ChangeOrigin;
      trigger: PublicationTrigger;
      attemptedMarkdown: string;
      disposition: DraftDisposition;
      reason:
        | "stale_session"
        | "cluster_identity_unavailable"
        | "snapshot_admission_failed"
        | "state_update_failed";
    };

type SynchronizationResult =
  | {
      status: "synchronized";
      stateEffect: "none";
      sessionKey: string;
      cause: "creation" | "source_to_wysiwyg" | "checkpoint_restore";
      exactAuthority: string;
      projection: string;
    }
  | {
      status: "no_change";
      stateEffect: "none";
      sessionKey: string;
      cause: "already_current" | "same_mode";
    }
  | {
      status: "failed";
      stateEffect: "none";
      sessionKey: string;
      cause: "creation" | "source_to_wysiwyg" | "checkpoint_restore";
      reason:
        | "stale_session"
        | "editor_not_ready"
        | "projection_read_failed"
        | "document_replace_failed";
    };

type CommitCause =
  | "mode_switch"
  | "manual_save"
  | "route_transition"
  | "visibilitychange"
  | "pagehide";
type CommitResult =
  | {
      status: "acknowledged";
      sessionKey: string;
      cause: CommitCause;
      publication: Extract<PublicationResult, { status: "acknowledged" }>;
    }
  | {
      status: "no_change";
      sessionKey: string;
      revision: number;
      cause: CommitCause;
      reason: "projection_unchanged" | "source_authority_current";
    }
  | {
      status: "failed";
      sessionKey: string;
      cause: CommitCause;
      reason: "stale_session" | "editor_not_ready" | "projection_read_failed";
    }
  | {
      status: "failed";
      sessionKey: string;
      cause: CommitCause;
      reason: "publication_rejected";
      publication: Extract<PublicationResult, { status: "rejected" }>;
    };

type DurabilityFailureReason =
  | "cluster_identity_unavailable"
  | "snapshot_admission_failed"
  | "consistent_read_failed"
  | "draft_write_failed"
  | "draft_cleanup_failed"
  | "queue_task_failed"
  | "owner_lost";
type DurabilityCause =
  "route_transition" | "visibilitychange" | "pagehide" | "explicit_flush";
type DurabilityResult =
  | {
      status: "clean";
      cause: DurabilityCause;
      clusterId: string | undefined;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string | undefined;
      disposition: "none";
    }
  | {
      status: "durable";
      cause: DurabilityCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string;
      disposition: "generated_durable" | "recovered" | "conflict";
    }
  | {
      status: "unavailable";
      cause: DurabilityCause;
      clusterId: string | undefined;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string | undefined;
      disposition: DraftDisposition;
      reason: DurabilityFailureReason;
    };

type CleanupCause = "generated_clean" | "successful_save" | "cleanup_retry";
type CleanupResult =
  | {
      status: "completed";
      cause: CleanupCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string;
      disposition: "none";
    }
  | {
      status: "superseded";
      cause: CleanupCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string;
      reason: "newer_revision" | "owner_lost";
    }
  | {
      status: "failed";
      cause: CleanupCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string | undefined;
      reason: DurabilityFailureReason;
      disposition: "cleanup_required";
    };

type DiscardResult =
  | {
      status: "completed";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      closedEpoch: number;
      next: "reload_disk" | "missing_without_draft";
    }
  | {
      status: "superseded";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      closedEpoch: number;
      reason: "owner_lost";
    }
  | {
      status: "failed";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      closedEpoch: number;
      restoredEpoch: number;
      reason:
        | "cluster_identity_unavailable"
        | "draft_delete_failed"
        | "queue_task_failed";
      disposition: "recovered" | "conflict";
      surfaceEffect: "restored";
    };

type EditorGatePreparationResult =
  | {
      status: "continue";
      leaseKey: string;
      sessionKey: undefined;
      reason: "no_editor_session";
    }
  | {
      status: "continue";
      leaseKey: string;
      sessionKey: string;
      commit: Extract<CommitResult, { status: "acknowledged" | "no_change" }>;
      durability: Extract<DurabilityResult, { status: "clean" | "durable" }>;
    }
  | {
      status: "cancel";
      leaseKey: string;
      sessionKey: string;
      reason: "commit_failed";
      commit: Extract<CommitResult, { status: "failed" }>;
    }
  | {
      status: "cancel";
      leaseKey: string;
      sessionKey: string;
      reason: "durability_unavailable";
      commit: Extract<CommitResult, { status: "acknowledged" | "no_change" }>;
      durability: Extract<DurabilityResult, { status: "unavailable" }>;
    }
  | {
      status: "cancel";
      leaseKey: string;
      sessionKey: string;
      reason: "owner_lost";
    };
```

`EditorGatePreparationResult` maps to Slice 7C's target-free gate result; Slice
7C retains the lease/intent join and later settles `{ leaseKey, terminalStatus,
surfaceEffect }`. Map `commit_failed` to `prerequisite_failed`,
`durability_unavailable` to `prerequisite_unavailable`, and `owner_lost` to
`outgoing_owner_lost`; `no_editor_session` maps to `continue` without creating a
freeze or persistence operation. Slice 7E observes these product results but
never decides them.

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
   - Compute the next exact-session revision and synchronously call
     `prepareSnapshot` before Zustand mutation. Preparation captures the command
     input and draft epoch in an inactive coordinator slot. If identity or
     preparation fails, return `rejected/stateEffect:none`; do not call `set`.
   - Apply the revision through one exact-session updater that records a local
     `didApply` fact before subscribers run. On stale ownership or a throw before
     the updater applies, cancel the prepared slot and return rejected with no
     state effect.
   - After a normal update, commit the prepared slot exactly once. If a
     subscriber throws after `didApply`, catch it and commit that same prepared
     slot before returning `acknowledged`. Coordinator commit is a synchronous,
     idempotent in-memory operation guaranteed by construction; it does not
     perform IndexedDB work and has no fallible post-mutation branch.
   - A nested subscriber may publish a newer revision. Each command commits its
     own prepared snapshot using its local `didApply` fact; neither command uses
     current Markdown readback to infer whether its revision occurred.
     Snapshot content is never reconstructed from mutable store state when a
     debounce later fires.
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
   - Register one React-owned editor gate with Slice 7C's route-transition owner.
     `prepare` receives Slice 7C's `leaseKey`, cause, and `outgoingOwnerKey`,
     never target, note intent, location, or evidence. It resolves the owner key
     to the current controller locally. Crepe runtime objects and functions do
     not enter Zustand, Dexie, or serialized product state.
   - When there is no outgoing editor session, return
     `continue/no_editor_session` for the lease without freezing or inventing a
     commit/durability result. Missing-note and empty/error surfaces therefore
     remain representable without inventing an editor session.
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
     updates the saved Markdown, content hash, note metadata, draft disposition,
     and save status in the existing `sessionKey`; it preserves mode, current
     document, selection, synchronization checkpoint, and Undo history.
   - For sidebar selection, URL-driven replacement, and Back/Forward, the Slice
     7C owner registers the route intent and calls this gate synchronously from
     its committed pre-navigation boundary. The gate
     acknowledges accepted authority, enters the exact-session handoff freeze,
     drains/adjudicates the immutable draft snapshot, and returns `continue` or
     `cancel` to that owner.
   - Put `aria-busy` on the outgoing article. Put editor, Save, mode, Discard,
     and cleanup-retry controls inside an inert interaction region, but keep the
     visible `Opening note...` text and `role="status"` live region outside the
     inert subtree. Keep the note list interactive so Slice 7C can register a
     newer intent.
   - Additional callers may reuse the same in-flight exact-session commit and
     durability promise, but every call owns a distinct Slice 7C lease. Maintain
     a per-session active-lease set/refcount; one superseded caller cannot
     release a freeze still owned by another current caller. They do not share
     route identity.
   - `continue` means only that replacement is safe; it does not assert that a
     replacement will happen. Keep the outgoing controller reversibly frozen,
     not irreversibly closed, while Slice 7C admits or loads the transition.
     Listener callbacks during the freeze cannot publish a new revision.
   - Invalidate the old controller only when a current note result is synchronously
     applying the replacement session. Exact-session store checks reject any
     callback in the state-update-to-React-cleanup interval.
   - Slice 7C settles only `{ leaseKey, terminalStatus, surfaceEffect }`. Remove
     that lease exactly once. For `retained` or `none`, unfreeze only when no
     other active lease remains and the same session still owns the surface;
     `none` means the stale intent does not claim a surface result, not that its
     lease may remain. For `replaced` or `replaced_by_error`, the old surface is
     gone and normal invalidation/destruction follows. A no-editor lease records
     settlement without controller work. A coherent no-op allocates no lease and
     never freezes.
   - If an ordered required write or clean-session cleanup is `unavailable`,
     return `cancel`, leave the same Crepe instance/session/Undo history active,
     and expose the exact draft disposition/failure action. Retain that lease's
     freeze until Slice 7C finishes/supersedes history cancellation/restoration
     and settles it as `retained`/`none`; then restore focus when possible. Slice
     7C alone decides whether the attempted history action commits or returns to
     its exact predecessor.
   - If another session replaces the editor while durability is pending, the old
     result may finish its own scoped persistence but cannot invalidate,
     unfreeze, or continue through the newer session.
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
     acknowledged authority only after the exact revision owns store state and
     its immutable draft snapshot is admitted to scheduled persistence.
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
   - A note/route result may replace only a controller whose exact session is
     still frozen by a successful gate. Invalidate it in the synchronous
     replacement application boundary; do not close it before Slice 7C knows
     whether replacement will occur. The old rendered editor is never left
     interactive while an asynchronous response can supersede it.
   - Successful same-session Save settlement is not session replacement and must
     not change `sessionKey` or recreate Crepe, including when a WYSIWYG edit is
     still inside the listener debounce window.
   - The new session receives its own exact authority, synchronization
     checkpoint, and acknowledged projection.

9. **Dirty, draft, and save decisions**
   - Content dirty means authoritative current Markdown differs from the saved
     baseline after CRLF-to-LF normalization only.
   - On acknowledged dirty publication, `none`, `generated_pending`,
     `generated_durable`, or `cleanup_required` becomes `generated_pending`;
     `recovered` and `conflict` remain unresolved under their existing kind.
     Durable write completion changes only the matching `generated_pending` to
     `generated_durable`.
   - Draft disposition remains independent. Returning a `recovered` draft to
     content equal to disk does not silently resolve or delete its browser
     record. A failed deletion becomes `cleanup_required`; it is not collapsed
     into `none` merely because content is clean.
   - Clean mode changes do not write a draft. When a `generated_pending` session
     returns clean, cancel/coalesce a not-yet-started dirty snapshot. If no write
     started and no record was previously durable, transition directly to
     `none` without speculative deletion. If a write started or a record is
     `generated_durable`, wait for it and perform an ordered consistent
     read/deletion before resolving the clean snapshot.
   - A clean reconciliation failure becomes `cleanup_required` only when a
     record exists or absence cannot be proven; it is not invented after a
     purely scheduled snapshot was successfully cancelled. A destructive
     handoff reports `clean` only in `none`.
   - A pristine `none` session may report `clean` without cluster identity when
     no record read, mutation, or cleanup is required. Once dirty content or a
     known/maybe-present record requires persistence work, unavailable cluster
     identity reports `unavailable`; it cannot be treated as clean or durable.
   - Save remains disabled for content-clean `none` sessions, and a direct
     programmatic Save makes no API request. A `recovered` session keeps Save
     available even when content compares clean so explicit Save can dispose of
     the record through the content-hash contract. `conflict` Save remains
     blocked.
   - A successful filesystem Save updates the exact-session saved baseline,
     content hash, and content-dirty fact even if subsequent browser-record
     cleanup fails. Cleanup failure then sets `cleanup_required`, preserves the
     known saved disk truth, shows degraded status, and exposes `Retry draft
cleanup`; it must not lie that Save failed or leave an impossible
     content-clean state with no available action.
   - `Retry draft cleanup` orders an exact-session conditional deletion without
     another filesystem write. It is visible only for `cleanup_required` and
     transitions to `none` only on success. A later accepted edit supersedes the
     clean retry snapshot and returns to `generated_pending` through normal
     admission.
   - Real dirty content continues through the existing draft and conflict
     contracts, but every persistence mutation uses an immutable snapshot and
     the per-cluster/note coordinator. Missing cluster identity or snapshot
     admission failure produces an explicit unavailable result and cannot be
     treated as durable.
   - The draft flush boundary returns a snapshot-specific durability result.
     Destructive note/route transitions may proceed after `clean` or `durable`
     for the exact still-active session, but not after `unavailable`. Save and
     mode switching retain the current session and do not depend on a successful
     draft write to avoid losing the only live copy.

10. **Legacy ambiguous draft compatibility**
    - Do not automatically delete, canonicalize, or semantically classify a
      valid pre-7D draft whose origin cannot be proven by its existing schema.
    - Recover it through the existing draft/conflict UI and preserve its exact
      Markdown, base hash, note/cluster scope, and editor mode.
    - Ordinary `recovered` drafts keep Save and Discard available until one
      explicit disposition succeeds, including when the recovered Markdown
      compares clean or is edited back to the saved baseline. Explicit Save
      continues through the content-hash contract. Explicit Discard deletes that
      draft, reloads exact disk Markdown, and must remain clean through readiness
      and mode switching.
    - Discard is exposed for `recovered`, `conflict`, and missing-note recovery,
      with recovery-appropriate confirmation. Pristine notes do not gain it.
      After confirmation, freeze the exact owner and close its current draft
      admission epoch; intentionally do not publish or persist discarded live
      editor content.
    - The barrier invalidates/cancels its epoch's not-yet-started snapshots,
      waits after earlier started mutations, deletes the record, and rejects
      every late listener/debounce/lifecycle callback carrying the closed epoch.
      Reload disk or complete missing-note dismissal only after deletion
      succeeds.
    - If deletion fails, do not reload and do not destroy the editor. Restore the
      same controller, source/WYSIWYG document, selection, Undo history, focus
      when possible, and unresolved disposition with a visible retryable error.
      Before unfreezing, allocate `restoredEpoch = closedEpoch + 1`; every new
      edit uses it and remains draft-durable, while work from the closed epoch
      can never run. Missing-note recovery uses the same owner/epoch rule without
      inventing an editor session.
    - Completion evidence must distinguish prevention of new projection-only
      drafts from preservation of already stored ambiguous drafts.

11. **Ordered draft persistence ownership**
    - `prepareSnapshot` is synchronous: it validates cluster/session/epoch,
      stores one inactive immutable slot, and either returns `prepared` or has no
      side effect. `commitPrepared` and `cancelPrepared` are synchronous,
      idempotent, non-persistence operations. A prepared slot is not executable
      until committed, but consistent reads/drains recognize and wait for the
      publication command to commit/cancel it.
    - Every draft lookup uses a consistent-read operation for the cluster/note
      key. It first admits or drains any scheduled snapshot and waits behind
      earlier mutations, so same-note reopen cannot observe absence before a
      queued write or observe a record before a queued cleanup.
    - Capture each immutable snapshot when the accepted change/disposition is
      admitted. A debounce may coalesce not-yet-started snapshots to the newest
      revision, but it cannot defer snapshot capture or sit outside queue
      ownership.
    - Every scheduled callback carries `ownerKey` and `draftEpoch`. A closed
      epoch is terminal. Discard failure opens exactly the next epoch; it never
      reopens or reuses the closed one.
    - Order `readDraft`, `writeDraft`, generated-clean deletion, cleanup retry,
      explicit Discard, durability drain, and
      `deleteDraftIfSavedSnapshotMatches` per cluster/note key. Different notes
      remain independent.
    - Use or deliberately specialize the existing core `KeyedTaskCoordinator`.
      Document why specialization is necessary for scheduled slots, consistent
      reads, cancellation, or terminal barriers instead of creating a parallel
      generic keyed queue.
    - Convert every task rejection into the caller's typed failure result while
      releasing the tail in `finally`. One failed task cannot poison later work,
      and the key plus scheduled slot are pruned when no work or session owner
      remains.
    - An older mutation may finish and report its own result, but exact-session
      revalidation prevents it from applying disposition, degraded status, or a
      durability decision to a newer session.
    - Successful-save cleanup remains conditional on the exact saved snapshot.
      A newer admitted draft survives and uses the new saved baseline. A failed
      exact cleanup applies `cleanup_required` only if that saved session/revision
      still owns the note.
    - The coordinator is ephemeral runtime infrastructure. Do not add queue IDs,
      controller capabilities, or scheduling internals to the version-one draft
      record.

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
  scheduled-before-transaction work, consistent reads, terminal cancellation, or
  exact-session result ownership.
- `packages/core/src/keyed-task-coordinator.ts` already supplies per-key tail
  serialization, rejection-safe release, and idle-key pruning. Extend or wrap it
  for scheduled snapshots and terminal barriers rather than duplicating its
  generic guarantees.
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
- Treat post-7C line counts as an implementation constraint across the workflow,
  not only in Milkdown: `note-browser-store.ts` is 396 lines,
  `note-browser-read-actions.ts` 384, `MilkdownEditor.tsx` 382,
  `route-transition-owner.ts` 355, `route-intent-execution.ts` 334,
  `note-browser-editor-actions.ts` 316, `note-browser-action-utils.ts` 315,
  `note-browser-route-actions.ts` and `route-intent-admission.ts` 281 each,
  `route-history-admission.ts` 276, and the acceptance-only
  `route-transition-controller.ts` 266. Split `note-browser-store.ts` before
  adding any Slice 7D behavior. Allocate authority, disposition, coordinator,
  and accessible freeze modules by responsibility before editing any pressured
  file; do not finish at 400 by compressing unrelated concerns.
- Keep rendering and accessible controls in the component file. Move lifecycle,
  instance ownership, authority/projection transitions, and Crepe integration
  into focused modules with beginner-readable exported API documentation.
- Represent lifecycle explicitly (`creating`, `ready`, `failed`, `destroyed`)
  and bind it to one editor-session/instance generation.
- Accept `sessionKey` as the Crepe lifetime identity. Do not include mutable
  Markdown, editor mode, recovery, draft, or save-status values in the creation
  effect's reconstruction boundary.
- Represent accepted changes with one discriminated domain result carrying exact
  Markdown and the exact `PublicationResult`, `PublicationTrigger`, origin, and
  authority-resolution memberships above. This is a telemetry-free seam for
  Slice 7E; do not add an untyped “specific reason” string.
- Change the parent publication boundary to return a typed acknowledgement with
  the exact `sessionKey`, resulting revision, Markdown accepted by Zustand, and
  committed immutable snapshot identity, or an exact rejection. Implement the
  synchronous prepare -> exact updater/`didApply` -> commit/cancel protocol.
  Preparation failure cannot mutate state; a subscriber throw after application
  commits the already prepared slot once; exact store readback is not the
  decision boundary.
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

- Add a React-owned editor-session gate that holds only the current controller
  capability, exact-session freeze state, and shared commit/durability promise.
  Register it with the implemented Slice 7C transition owner. Do not put Crepe
  instances, callbacks, refs, route targets, or other runtime objects in
  Zustand, Dexie, or serializable snapshots.
- Route note selection, URL-driven replacement, and Back/Forward through Slice
  7C's exact target-free `prepare`/`settle` lease contract. Route manual Save and
  WYSIWYG-to-source through the same controller commit operation without
  pretending they are route intents.
- For a ready WYSIWYG session, synchronously read and reconcile
  `crepe.getMarkdown()`. Cancel the requested in-app action and retain the
  current editor if the commit fails.
- Model destructive handoff explicitly: acknowledge the live commit plus
  snapshot admission, freeze the outgoing session, drain the exact snapshot,
  and return `continue` or `cancel`. Slice 7C revalidates its intent and owns the
  store transition. Keep the controller reversibly frozen until Slice 7C reports
  a terminal outcome; invalidate it only while a current result synchronously
  installs the replacement session.
- Put `aria-busy` on the article and place all outgoing controls in an inert
  interaction region. Render concise visible status and `role="status"` outside
  that inert subtree so assistive technology can announce it. Preserve the
  previously focused outgoing element for failure restoration while leaving the
  note list interactive. Successful replacement does not steal focus from the
  activated navigation control.
- Keep one handoff commit/durability operation per `sessionKey`. Overlapping
  callers may reuse it while retaining distinct Slice 7C lease keys. Maintain an
  active-lease set and consume only Slice 7C's target-free settlement. A
  superseded lease cannot unfreeze another; a coherent no-op creates no lease;
  `retained`, `none`, `replaced`, and `replaced_by_error` have the exact effects
  in Required Transition 4.
- Change the pending-draft flush boundary to accept an immutable snapshot and
  return snapshot-specific `clean`, `durable`, or `unavailable`. An unavailable
  required write or clean-session cleanup cancels selection/history
  synchronization and unfreezes the same editor session.
- Return only `continue` or `cancel` plus exact-session failure information to
  Slice 7C. Do not push, replace, compare, retain, block, or restore history in
  this slice.
- Refactor successful same-session save reconciliation so it updates the saved
  baseline, hash, note metadata, draft disposition, and status in place. It must retain
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

### 5. Establish Dirty Equality, Draft Disposition, And Ordered Persistence

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
- Replace the ambiguous recovered-record boolean/union usage with the exact
  `Draft disposition` variants from the authoritative contract. Keep it separate
  from equality and preserve `recovered`, `conflict`, and `cleanup_required`
  records even when content compares clean.
- Ensure editor-mode-only updates do not imply dirty content and do not create a
  draft record for a `none` pristine note.
- Keep `canSaveEditor` as the defensive API boundary: content-clean `none` and
  `cleanup_required` sessions never call the filesystem Save API, even if UI
  invokes it directly. A `recovered` record remains explicitly saveable;
  `conflict` remains blocked; `cleanup_required` exposes its separate retry.
- Extend or intentionally specialize `KeyedTaskCoordinator` into a focused
  per-cluster/note draft-persistence coordinator. Route consistent reads,
  scheduled snapshot admission, writes, clean-session deletion, cleanup retry,
  explicit Discard, durability drain, and successful-save exact-snapshot cleanup
  through it while different notes remain independent.
- Prepare the immutable snapshot in an inactive coordinator slot before the
  exact Zustand updater, then commit/cancel it from the updater's local
  `didApply` result. A later debounce callback may start/coalesce committed work
  but cannot capture mutable editor state or represent admission.
- Track store-owned per-session draft disposition from consistent load,
  admission, and completed mutations. Distinguish `generated_pending` from
  `generated_durable`. A pristine or cancelled-before-start clean session with
  no owned record returns `clean` without speculative deletion; started/durable
  work must be drained and its record absence proven before returning `clean`.
- Capture mutation input before the first await and revalidate `sessionKey` plus
  revision before applying session-visible results. Do not let a late mutation
  degrade, clean, close, or unblock a newer session.
- Convert queue/task rejection to typed unavailability, release the tail, and
  prune idle key/scheduled state. Add no permanently rejected promise that can
  poison later work.
- On successful Save plus failed conditional cleanup, keep the saved baseline
  and content hash, set `cleanup_required`, and expose `Retry draft cleanup`.
  Prove retry success removes the record without another API `PUT` and a newer
  edit supersedes the stale retry.
- Preserve the existing Slice 7B single-flight, edit-during-save,
  session-ownership, conflict, failed-save, and exact-draft-cleanup behavior
  after its prerequisite repairs.
- Preserve every valid legacy ambiguous draft. Do not infer that a draft is safe
  to delete merely because it equals Milkdown's projection of disk content.
- Refactor confirmed Discard for ordinary recovered, conflict, and missing-note
  owners as the terminal admission-epoch barrier. Close the current epoch,
  cancel scheduled work before ordered deletion, block all old-epoch callbacks,
  and reload only after success. On failure allocate the next epoch before
  restoring the untouched same editor/view so later edits remain durable. Keep
  actions absent for pristine sessions and expose cleanup retry separately.

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
  - snapshot preparation failure leaves Zustand revision/Markdown/disposition
    unchanged, returns `rejected/stateEffect:none`, and remains retryable;
  - a publication whose exact updater applied before a subscriber throws commits
    its pre-admitted snapshot exactly once and is neither revised nor scheduled
    twice;
  - a nested subscriber publication gives each applied revision its own prepared
    snapshot without using current Markdown readback to infer the older result;
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
- Add React editor-gate tests for WYSIWYG edit followed immediately
  by source mode, note selection, route replacement, Back/Forward, Save,
  visibility change, and page hide. Assert projection commit occurs before store
  flush/transition and before destruction.
- Add a deferred-note-read case that holds the replacement response, proves the
  outgoing article is visibly busy and inert after its commit, resolves inside
  the listener debounce window, and confirms the exact committed edit is
  durable. Assert article `aria-busy`, an inert inner interaction region, visible
  and live status outside that region, disabled pointer/keyboard/touch/IME input,
  interactive note-list navigation, and no automatic focus theft after success.
- Run the implemented Slice 7C `A -> B -> A` and repeated-same-target cases with
  the editor gate registered. Prove overlapping intents may reuse one session
  operation but own distinct leases; B's `superseded/none` settlement cannot
  unfreeze while A's current lease remains. Slice 7C still starts/skips the
  correct action and reports distinct outcomes.
- Simulate unavailable required draft persistence for sidebar selection and
  Back/Forward, including missing cluster identity. Prove the gate returns
  `cancel`; the Slice 7C owner performs exact-current history handling; the same
  editor and Undo history are unfrozen; prior focus is restored when possible;
  dirty content retains Save; and clean `cleanup_required` content exposes Retry
  cleanup instead of an unusable Save action.
- Feed every settlement surface effect (`retained`, `none`, `replaced`, and
  `replaced_by_error`) back with its lease and prove only that lease/session is
  released or destroyed. Prove `coherent_noop` allocates no lease and never
  freezes.
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
- Add deferred draft-persistence tests that prove per-key admission/creation
  order and exact snapshot ownership for scheduled-write/consistent-read,
  older-write/newer-write, dirty-write/clean-delete,
  scheduled-dirty/clean-before-start (cancel with no delete),
  clean-delete/newer-write, queued-cleanup/consistent-read,
  failed-mutation/consistent-read, successful-save cleanup/newer-draft,
  same-note reopen while old save reconciliation is queued, cleanup
  retry/newer-edit, explicit Discard/scheduled-write, explicit
  Discard/already-started-write, same-note reopen, and different-note
  independence. The memory adapter must be delayable rather than resolving every
  mutation synchronously.
- Reject read, write, cleanup, and Discard tasks in turn. Prove each caller gets
  the exact typed failure, later same-key work still runs, scheduled slots cannot
  resurrect stale work, and idle coordinator entries return to zero.
- Prove a pristine clean session performs no speculative draft deletion, while a
  session that durably wrote and then reverted completes its ordered deletion
  before destructive handoff reports `clean`.
- Extend note-browser store tests to prove:
  - pristine load plus editor readiness creates no draft;
  - mode-only changes leave no draft after flush;
  - a content-clean `none` programmatic Save makes zero API calls;
  - a real source or WYSIWYG accepted change schedules one recoverable draft;
  - reload does not report recovery from projection-only normalization;
  - an existing deliberate recovered draft retains its exact Markdown and
    disposition without being replaced by the editor projection;
  - a seeded valid pre-7D projection-only draft is preserved as ambiguous until
    explicit save or discard, and discard returns to exact clean disk authority;
  - an ordinary recovered draft that compares clean or is edited back to the
    saved baseline retains its record plus explicit Save and Discard until one
    disposition succeeds, while pristine sessions expose neither action;
  - successful Save plus failed draft cleanup retains saved disk truth, enters
    `cleanup_required`, and successful retry deletes without another `PUT`;
  - ordinary/conflict/missing-note Discard cancels scheduled work, deletes before
    reload, and cannot be resurrected by a late callback;
  - failed Discard deletion performs no reload and restores the same exact
    editor, content, selection, Undo history, disposition, fresh draft epoch,
    and retry action; a subsequent edit becomes durable while every closed-epoch
    callback remains rejected;
  - retry after failed Discard closes the fresh epoch and succeeds without
    resurrecting old work; failed missing-note Discard keeps the missing-draft
    view and advances its owner epoch without reloading;
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
  browser-draft read/mutation ownership, draft disposition, terminal Discard,
  cleanup retry, and the real-edit serialization boundary.
- Update this slice with concise completion evidence rather than duplicating
  full browser logs.
- Add a focused QA record under `docs/qa/` containing fixture names, before/after
  hashes, browser results, IndexedDB proof, and any observed WYSIWYG
  normalization after an accepted edit.
- Record prevention of new projection-only drafts separately from preservation
  and explicit disposition of seeded legacy ambiguous drafts.
- Record the implemented typed accepted-change, synchronization, commit, and
  publication/admission, durability, cleanup, Discard, and route-gate result
  shapes as the input for Slice 7E's required promotion refresh. Slice 7E must
  distinguish raw projection observation from accepted authority change and
  must not require an editor session ID before draft read and editor-session
  creation complete.
- Update the production QA record's P1 disposition only after all acceptance
  criteria pass.
- Preserve the completed Slice 7C route contract/evidence and keep block-menu,
  backend-copy, mobile-newline, and bundle findings in their own authoritative
  homes.

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
  as a React-owned session freeze through Slice 7C's implemented gate/outcome
  seam without making the editor gate own route targets. Reopen Slice 7C's
  boundary explicitly rather than adding a second latest-intent owner here.
- A failed snapshot-specific durability result cannot retain the active session
  and return a typed cancellation for Slice 7C without introducing another route
  owner or durable store. Do not silently build those broader foundations inside
  Slice 7D.
- Consistent draft reads, terminal Discard, or cleanup retry requires a draft
  schema migration or persistent mutation log rather than ephemeral ordering
  around the current schema.
- Snapshot preparation/commit cannot remain synchronous and infallible after
  preparation without introducing a persistent journal or allowing rejected
  publication to mutate authority.
- A confirmed Discard cannot stop scheduled or late closed-epoch work without
  destroying/restoring the editor through a new product workflow not represented
  by the current terminal barrier contract.
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
  interaction region rather than only the editor body, keep live status outside
  the inert subtree, leave later note-list intent possible, and restore prior
  focus after failure when possible.
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
- A subscriber failure after Zustand mutation must not acknowledge publication
  without exact snapshot admission or schedule the same revision twice.
- Exact source input must not be hidden as clean by semantic normalization.
- A pristine editor must not create a recovery draft, false recovery banner,
  save request, content-hash conflict, or filesystem write.
- Source-to-WYSIWYG synchronization must not publish a second edit or increment
  the editor revision solely because Milkdown serialized the same document
  differently.
- Real dirty drafts must retain current cluster/note scoping, base hash, editor
  mode, recovery behavior, and successful-save cleanup.
- A same-note draft read must not overtake scheduled or queued mutations, and a
  rejected task must not poison later work or leak an idle coordinator key.
- Successful disk Save followed by failed browser cleanup must not be reported as
  failed disk Save, clean `none`, or an actionless clean recovery state.
- Valid legacy ambiguous drafts must not be deleted or rewritten by projection
  inference; only explicit save/discard and the existing exact successful-save
  contract may dispose of them.
- A recovered draft that compares clean or is edited back to disk content must
  remain unresolved and explicitly disposable; content equality alone cannot
  delete it.
- Ordinary recovered legacy drafts must not become practically undiscardable
  merely because their base hash still matches disk.
- Discard must not reload after deletion failure, and a scheduled or late
  callback must not recreate a successfully discarded ordinary, conflict, or
  missing-note draft.
- Crepe instances and controller capabilities must remain ephemeral React-owned
  runtime state, not a second product-state owner in Zustand or Dexie.
- The editor gate must not become a second route-target owner, mutate URLs,
  repair history, suppress Slice 7C intents, or erase existing Slice 7B evidence.
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
state-owner, evidence, and cleanup procedure. Run the full desktop/Pixel 6,
development/optimized-production, Sentry-disabled/Sentry-enabled eight-cell
matrix. Sentry does not own the product result; both configurations must produce
the same authority, persistence, routing, and disk truth:

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
    inert to editor and toolbar input, exposes its live status outside the inert
    subtree, and still allows a newer note-list intent. Settle the read inside the
    listener debounce window and prove the committed edit recovers exactly on
    reopen without automatic focus theft.
14. Force both a dirty-draft write and a required clean-session draft deletion
    used by sidebar and Back/Forward handoff to fail. Confirm no note load starts,
    the Slice 7C owner handles only the exact current intent, the same editor and
    Undo history become interactive again, prior focus is restored when
    possible, and the exact dirty-Save or clean-cleanup-retry action is visible.
15. Run the Slice 7C repeated-same-target race through the gate and force each
    terminal outcome. Confirm no coherent no-op, stale intent, cancellation, or
    failed load strands the temporarily rendered controller frozen or closed.
16. Trigger same-session parent rerenders through mode, draft disposition, and
    save-status changes; confirm one Crepe DOM tree remains, Undo still reaches
    the checkpoint, and no duplicate listener publishes. Component tests own the
    exact instance-count assertion.
17. Create an external-write conflict, discard the recovered draft, and confirm
    exact disk Markdown stays clean after editor readiness and mode switching.
    Repeat with deletion forced to fail: confirm no reload occurs and the exact
    editor, selection, Undo history, disposition, and retry path return.
18. Confirm Discard of ordinary and missing-note recovery cancels a pending
    scheduled write and cannot be resurrected by its debounce or lifecycle
    callback after deletion.
19. Recover one deliberate dirty draft whose syntax normalizes in Milkdown and
    confirm the exact draft remains authoritative and dirty until save or
    discard.
20. Seed a valid pre-7D projection-only draft with the current base hash, confirm
    Azurite preserves it as ambiguous and exposes Save and Discard, discard it
    explicitly, and confirm exact disk Markdown remains clean after readiness and
    mode switching.
21. Seed an ordinary recovered draft that compares clean, edit another recovered
    draft back to its saved baseline, and confirm each record plus Save and
    Discard remain until explicit disposition.
22. Save a dirty or recovered note while forcing exact browser cleanup to fail.
    Confirm disk bytes/hash and saved baseline advance, disposition becomes
    `cleanup_required`, Retry cleanup makes no second `PUT`, and successful retry
    removes the record. Repeat with a newer edit before retry and prove the newer
    draft survives.
23. Navigate rapidly between notes during editor creation and confirm stale
    callbacks never alter the current note.
24. Delay and reorder scheduled snapshots, same-note reopen/read, cleanup, Save,
    Discard, and navigation. Confirm the read observes the ordered result, the
    final IndexedDB record matches the newest snapshot, rejected work does not
    poison the key, and different notes remain independent.
25. Wait through readiness and delayed configured-plugin activity without input;
    confirm no post-ready non-authoritative document change becomes accepted
    content.
26. Confirm the normal console has no new errors or warnings in every matrix
    cell. With Sentry enabled, inspect authenticated telemetry only to prove the
    product exercise introduced no uncaught fault; with Sentry disabled, prove
    there is no Sentry transport and behavior remains identical.

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
  touch, keyboard, and toolbar input after its handoff commit, the live status
  remains exposed outside the inert subtree, and later note-list intent remains
  possible;
- make a WYSIWYG edit and immediately switch mode, select another note, use
  Back/Forward, and confirm supported in-app transitions retain the edit;
- observe an exact draft as durable before reload and confirm it recovers;
- repeat failed cleanup retry and failed Discard restoration with touch controls;
  and
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
finding. Required Slice 7F owns that mandatory correctness work after Slice 7E.

## Acceptance Criteria

- Fidelity fixtures and pristine mode-only workflows satisfy Required
  Transitions 1–3 and 5–7 without changing authority, dirty state, drafts, Save
  eligibility, or disk bytes in development and optimized production.
- Source remains exact and usable through pending or failed Crepe creation, and
  ordinary WYSIWYG updates use the accepted bounded listener debounce while
  every supported in-app action retains a newer live projection synchronously.
- Accepted publication is acknowledged exactly once; failed publication remains
  visible and retryable and cannot authorize destruction or mutate another
  session. Acknowledgement proves both exact store revision and immutable
  snapshot admission, including after a subscriber throws.
- Required Transitions 4 and 8 preserve one Crepe instance, selection,
  checkpoint, and Undo history through same-session rerenders and successful
  Save while making destructive handoff visibly busy, inert, exact-session, and
  durable before replacement.
- The editor gate owns no route targets, intent identity, or history handling. It
  consumes Slice 7C's gate/outcome seam, restores the exact outgoing session for
  every non-applied outcome, and never strands a controller closed or frozen.
- Required Transitions 9–11 use one CRLF/LF-only content comparison plus separate
  draft disposition and ordered per-note read/mutation ownership. Deferred tests
  prove that scheduled work, reads, writes, cleanup, Save, and Discard cannot
  supersede newer recovery truth and failed tasks do not poison or leak a key.
- Content-clean `none` and `cleanup_required` sessions cannot call filesystem
  Save programmatically. `cleanup_required` has an exact retry action; successful
  disk Save remains truthful if cleanup fails. Every
  valid ordinary recovered draft remains explicitly saveable and discardable
  until disposition, including after comparison to or editing back to disk;
  conflicts retain their existing blocked-Save behavior.
- Confirmed Discard is terminal for one owner epoch. It reloads or dismisses
  missing-note recovery only after deletion succeeds, cannot be resurrected by
  closed-epoch work, and restores the same editor with a fresh persistence epoch
  after failure.
- Exact source and WYSIWYG edits become durable, save through the content-hash
  contract, and recover after reload once the matching draft or save completes.
  Browser lifecycle flush attempts are not reported as durable without observed
  IndexedDB completion.
- Typed accepted-change, publication/admission, synchronization, commit,
  durability, cleanup, Discard, and editor-gate results expose session and cause
  truth for Slice 7E without adding Sentry behavior or making diagnostics a
  state owner.
- Architecture and QA evidence record exact authority, acknowledged projection,
  ordered draft ownership, legacy disposition, same-session Save, and the honest
  post-WYSIWYG serialization limitation. Unrelated findings remain separately
  tracked.
- The desktop/Pixel 6, development/optimized-production,
  Sentry-disabled/Sentry-enabled matrix passes without claiming the Android
  input bug or requiring physical-phone evidence.
- `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`,
  `git diff --check`, clean `main`, and synchronization with `origin/main` pass.

## Open Questions

None for planning. The product decision, source-of-truth boundary, bounded
WYSIWYG dirty-state latency, completed-draft reload guarantee, real-edit
limitation, implementation sequence, scope exclusions, and completion proof are
explicit. Literal pre-debounce dirty indication and unload-warning UX remain
evidence-gated future hardening rather than unresolved 7D decisions. New
contradictory runtime evidence must use the scope re-selection triggers above.
