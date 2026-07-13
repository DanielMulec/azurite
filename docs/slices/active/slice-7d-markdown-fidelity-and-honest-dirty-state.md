# Slice 7D: Markdown Fidelity And Honest Dirty State

## Status

Active as of 2026-07-13 after Slice 7C completed its narrow
pending-predecessor cancellation correction. The post-7C adversarial review has
refreshed this plan against the implemented route, editor, Save, cluster-identity,
and Dexie contracts. Slice 7D consumes the validated action-aware history owner,
typed target-free pre-transition gate, rendered outgoing-session identity,
route-or-reload load authorization, exact-current revalidation, coherent no-op
predicate, and typed terminal outcome without becoming a second route owner.

The post-7C adversarial review assigned two additional findings to this slice
because they are inseparable from architecture already selected here:

1. successful manual Save currently creates a new editor session without
   refreshing the committed route-view owner, so the next click on the already
   selected note is not a `coherent_noop` and performs an unnecessary GET and
   editor replacement; and
2. a failed baseline draft write clears its retry obligation, so no retry occurs
   without another edit.

Slice 7D's existing same-session Save and ordered persistence boundaries own the
durable correction. The implementation and acceptance proof below now require
post-Save route coherence and an exact retryable failed-write snapshot without
adding temporary parallel fixes to Slice 7C.

The refreshed contract also preserves three current product truths that the
pre-7C draft did not represent completely:

1. accepted edits and manual Save remain available when cluster identity or
   browser recovery is degraded; unavailable durability blocks destructive
   handoff, not live authority or filesystem Save;
2. an unread recovery record and an unknown future-version record are preserved
   states, not absence or cleanup, and current-version writes or deletes cannot
   overwrite them; and
3. the existing Slice 7C QA fault gate decorates the real composed editor gate
   rather than replacing and bypassing it.

The 2026-07-13 adversarial review proved that the earlier plan secretly depended
on those route guarantees while calling route coherence a non-goal. In
particular, the pre-7C rendered-note-only skip could return after this slice had
closed the outgoing controller, leaving no replacement session. A note ID alone
also could not identify which of two same-target history intents might continue
or cancel. The scope was therefore re-selected to
`7B -> 7C -> 7D -> 7E -> 7F`.

This revision also makes seven previously implicit failure boundaries explicit:

1. draft cleanup failure has a store-owned, user-actionable disposition even
   when content is clean;
2. recovery-read failure and preserved unknown schema have distinct,
   non-destructive dispositions and exact adapter results;
3. publication acknowledgement includes an immutable in-memory recovery
   obligation and survives a subscriber throwing after Zustand mutation even
   when that obligation is not yet cluster-addressable;
4. draft reads, scheduled work, writes, cleanup, Save reconciliation, and
   Discard share one ordered per-note boundary;
5. persistence issues retain exact operation, owner, revision, retry action, and
   underlying cluster/Dexie reason instead of collapsing into a global boolean;
6. Discard is terminal for one draft-admission epoch, advances to a fresh epoch
   on deletion failure, and reloads only after successful deletion; and
7. Slice 7E's post-implementation diagnostics refresh is a hard promotion gate,
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
draft-mutation snapshot and admits it to an in-memory recovery obligation. The
snapshot may initially have no cluster ID when durable cluster identity is
unavailable; that is a typed persistence issue, not a publication rejection. The
command then applies the exact-session revision and commits the prepared snapshot
to scheduled or identity-blocked persistence. If a subscriber throws after the
updater applied, the command's local `didApply` fact commits the already prepared
snapshot exactly once before acknowledging. Only stale ownership, closed epoch,
in-memory admission failure, or a state update that never applied rejects
publication with `stateEffect: none`; readback repair is neither required nor
sufficient.

Unavailable cluster identity, an unread recovery record, a preserved unknown
future-version record, or a failed IndexedDB mutation cannot prevent the exact
visible edit from becoming Zustand authority. They prevent Azurite from claiming
browser durability. The live session keeps a typed persistence issue, manual
Save and mode switching remain usable, and destructive handoff is blocked while
dirty live content lacks a matching durable record. A successful filesystem Save
may make the live content safe without deleting, overwriting, or falsely
resolving an unread or future-version browser record.

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

A failed draft write never consumes its retry obligation. The exact immutable
snapshot retains its applicable disposition, its exact typed issue remains
visible, and an explicit `Retry draft persistence` action re-admits that snapshot
through the same coordinator without requiring another content edit. A generated
ordinary record remains `generated_pending`; recovered/conflict record truth is
not erased by a failed update. A newer accepted revision or mode snapshot
supersedes the failed snapshot. This slice does not create an unbounded
background retry loop.

Draft persistence is an ordered workflow, not write-only serialization. Reads,
debounced snapshots that have been scheduled but not yet queued, writes,
cleanups, successful-save reconciliation, and explicit Discard all cross one
per-cluster/note boundary. A snapshot admitted while cluster identity is
unavailable remains session-scoped and cannot enter that keyed queue until the
same session obtains a ready cluster ID; binding the target never recaptures
mutable content. Content equality and browser-record disposition are separate
facts: a saved or otherwise clean session may still require explicit cleanup
retry after IndexedDB deletion fails, preserve an unread record, or preserve an
unknown future-version record.

A failed recovery read never becomes cleanup. Azurite preserves the record,
shows `Retry browser recovery` while the live content is clean, and resolves the
record only after an exact ordered retry reports absent, a valid current record,
or a preserved unknown version. If Daniel edits before recovery can be retried,
the edit remains live and manually saveable, current-version draft mutation stays
blocked, and recovery retry waits until no unsaved live authority can be
replaced. A clean session may leave an unread or unknown record untouched during
handoff; that result means preserved, not absent or cleaned.

An unknown future-version record is never returned as ordinary absence. The
older build neither rewrites nor deletes it, including through draft writing,
successful-save cleanup, or Discard. Azurite exposes a visible incompatible
recovery state, retains manual Save for current live content, blocks destructive
handoff only while that live content is dirty and non-durable, and instructs
Daniel to use a compatible newer build to inspect or dispose of the record.

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

When browser recovery cannot be read, targeted, or safely mutated, Azurite keeps
the exact edit authoritative and manually saveable, names the precise recovery
problem, and blocks only destructive handoff that would lose dirty live content.
It never calls an unread record cleanup, treats a future-version record as
absence, or overwrites protected recovery data from an older build.

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
- Keep accepted editing and manual Save available when cluster identity, recovery
  read, current-version draft mutation, or a future-version record prevents
  browser durability; never make that degradation look like rejected authority.
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
- Make authority publication and immutable in-memory draft-snapshot admission
  one acknowledged operation even when cluster targeting is unavailable or
  Zustand listeners throw after state mutation.
- Distinguish absent, valid current, unread, and preserved unknown browser records
  through exact transactional adapter outcomes, and keep retryable persistence
  issues separate from record disposition.
- Preserve editor-mode recovery for existing records without creating a record
  for a pristine `none` session.
- Make Discard terminal for one exact-owner draft epoch: cancel scheduled work,
  delete after earlier admitted mutations, reload only on success, and allocate
  a fresh epoch before restoring the same editor after failure.
- Preserve accepted source and WYSIWYG changes, including one followed
  immediately by a mode switch before Milkdown's debounced listener fires.
- Add fixture-driven regression proof for the real Markdown shapes that exposed
  the defect.
- Leave typed accepted-change, synchronization, commit, recovery-read,
  persistence-issue, cleanup, and durability results that Slice 7E diagnostics
  can observe without rediscovering which callbacks represent product truth.

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
- Changing backend-unavailable copy, adding general API retry UI, lazy-loading
  the editor, changing chunks, or suppressing Vite's size warning.
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

| Boundary               | Decision                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Read exact Markdown from disk or a consistently ordered valid recovery draft, preserve unread or future-version records without treating them as absence, project authority into one session-owned Crepe instance, switch modes without inventing an edit, admit accepted content before transitions, make it durable or save it manually, and explicitly dispose only of compatible session-owned records. |
| Predictable extensions | Autosave, external file watching, diff/conflict UI, source/WYSIWYG diagnostics, future editor loading, and multi-client editing all need to distinguish authoritative content from rendered or serialized projections and flush pending editor work before ownership changes.                                                                                                                               |
| Participating layers   | Milkdown/Crepe lifecycle and serialization, React editor gate registration with Slice 7C, Zustand editor session and draft disposition, Save/Discard/retry controls, scheduled and Dexie persistence work, existing note API and content-hash save contract, Vitest, and real-browser QA.                                                                                                                   |
| Near-term seams        | A focused Markdown-authority controller; a Slice 7C-compatible editor gate with QA decoration; exact transactional read/mutation outcomes; an ordered boundary with identity-blocked snapshots and terminal barriers; separate record disposition and persistence issues; one comparison helper; session/lifecycle ownership that rejects stale callbacks.                                                  |
| Exclusions             | Token-level Markdown reconciliation, automatic legacy-draft classification, new persistence formats, editor replacement, route selection behavior, block-menu behavior, mobile newline repair, observability payloads, and bundle loading can wait because none is required to stop projection-only mutations.                                                                                              |

### Scope Re-selection Result

The asynchronous handoff freeze, ordered draft read/mutation boundary, terminal
Discard barrier, store-owned draft disposition, and snapshot-specific durability
result remain inside Slice 7D. They are required to make “commit before
replacement” and “browser record handled honestly” true. Omitting them permits a
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
whether the current note's Dexie record is absent, generated, recovered,
conflicted, known to require cleanup, unread, or preserved as an unknown future
version. A separate exact-session persistence issue owns operation failure and
retry truth. The generic keyed-tail primitive moves from `packages/core` to the
browser-safe shared package already consumed by core and web; core and the new
web draft coordinator compose that one primitive rather than importing
filesystem-oriented core into the browser or creating a near-copy. Dexie remains
the durable browser owner. If implementation requires a schema migration, new
route capability, or another durable state owner, the Scope Re-selection
Triggers apply instead of silently expanding Slice 7D.

## Authoritative Markdown Contract

This section is the single authoritative home for the slice's state-transition
decision. Implementation comments and tests should reference or summarize it,
not create competing definitions.

### State Terms

| Term                            | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor session                  | One store-owned editing lifetime identified by `sessionKey`. It owns at most one Crepe instance. Ordinary Markdown, mode, disposition, persistence-issue, and save-status rerenders remain inside that lifetime.                                                                                                                                                                                                                                                                                                                     |
| Saved baseline                  | Exact Markdown returned by the current disk read or successful save.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Authoritative current Markdown  | Exact content Azurite currently attributes to disk, a recovered draft, acknowledged source input, or an acknowledged WYSIWYG document change. This is Zustand's `currentMarkdown`, including when browser persistence is unavailable.                                                                                                                                                                                                                                                                                                |
| Content dirty                   | Whether authoritative current Markdown differs from the saved baseline after CRLF-to-LF normalization only. This fact never proves that a browser record is absent, compatible, or resolved.                                                                                                                                                                                                                                                                                                                                         |
| Draft disposition               | Store-owned record truth: `none` proves absence; `generated_pending` owns admitted generated work not yet proven durable; `generated_durable` proves its exact current record; `recovered` awaits explicit Save or Discard; `conflict` blocks Save; `cleanup_required` means a known compatible record failed required deletion/reconciliation; `recovery_read_unavailable` means record presence/content could not be read; `preserved_unknown` means an unknown future-version record is known to exist and must remain untouched. |
| Draft persistence issue         | Store-owned exact-owner operation failure with note, epoch, revision/snapshot when present, precise cluster/Dexie/coordinator reason, and the one permitted retry action. It is separate from disposition so healthy pending work, failed work, and browser-record truth cannot be conflated.                                                                                                                                                                                                                                        |
| Synchronization checkpoint      | A controller-local pair: exact authoritative Markdown supplied at editor creation or source-to-WYSIWYG synchronization, and Milkdown's serialized projection of that same document. It allows Undo back to that document to restore the exact source bytes.                                                                                                                                                                                                                                                                          |
| Acknowledged WYSIWYG projection | The most recent projection whose authority publication and immutable in-memory recovery obligation both committed. Rejected publication has no store revision effect, remains retryable, and never advances this projection.                                                                                                                                                                                                                                                                                                         |
| Accepted content change         | Exact source textarea input, or a changed projection read from the ready, active WYSIWYG document while no Azurite-owned synchronization is in progress. It is an observable ownership classification, not a claim about psychological intent.                                                                                                                                                                                                                                                                                       |
| Publication acknowledgement     | A typed exact-session result proving the accepted Markdown and mode own one store revision and its immutable snapshot is admitted to scheduled or identity-blocked in-memory persistence. It does not falsely claim IndexedDB durability. `no_change` and `rejected` have `stateEffect: none`; state readback alone cannot acknowledge admission.                                                                                                                                                                                    |
| Synchronization                 | Editor construction, readiness, controller-owned source-to-WYSIWYG replacement, WYSIWYG-to-source display, or same-mode selection. Its typed result is observable by later diagnostics but never becomes dirty by itself.                                                                                                                                                                                                                                                                                                            |
| Draft mutation snapshot         | Immutable note ID, optional ready cluster ID, `sessionKey`, editor revision, base hash, exact Markdown, editor mode, content-dirty fact, disposition, and cause captured when an accepted change or disposition transition is admitted. Missing cluster ID blocks execution but never causes later content recapture.                                                                                                                                                                                                                |
| Scheduled snapshot              | The newest not-yet-started immutable snapshot owned by a session-scoped unbound slot or per-note debounce/coalescing slot. It is already part of ordered persistence and cannot be bypassed by a read, Save cleanup, Discard, or handoff drain.                                                                                                                                                                                                                                                                                      |
| Draft persistence coordinator   | Ephemeral infrastructure that first owns identity-blocked session snapshots, then orders consistent reads, writes, mode updates, cleanup, explicit Discard, successful-save reconciliation, drains, and terminal barriers per ready cluster/note key. Different notes remain independent; task rejection releases the queue; idle keys and unbound slots are pruned.                                                                                                                                                                 |
| Preserved handoff               | A clean session with `recovery_read_unavailable` or `preserved_unknown` may hand off without resolving or mutating the browser record because no live edit is being lost. The result is explicitly `preserved`, never `clean`, `durable`, or absent. Dirty live authority in either disposition still blocks destructive handoff until manual Save makes it clean.                                                                                                                                                                   |
| Handoff freeze                  | React-owned temporary state entered after the outgoing editor's live Markdown is acknowledged and before a destructive transition waits for durability. The article owns `aria-busy`; an inner interaction region is inert; visible/live status remains outside the inert subtree; the sidebar remains available for later Slice 7C intents.                                                                                                                                                                                         |
| Durability result               | A typed result tied to one session/revision snapshot: `clean` proves content clean and disposition `none`; `durable` proves the exact live snapshot is durably stored; `preserved` proves content clean while an unread/future record remains untouched; `unavailable` carries an exact failure and never authorizes dirty handoff.                                                                                                                                                                                                  |
| Draft admission epoch           | A store/runtime generation inside one editor or missing-recovery owner. Every timer, listener, lifecycle callback, snapshot, and issue carries it. Advancing the epoch permanently rejects stale callbacks without requiring Crepe reconstruction.                                                                                                                                                                                                                                                                                   |
| Terminal discard barrier        | An exact-owner/epoch coordinator operation for compatible `recovered` or `conflict` records that freezes input, closes the epoch, invalidates not-yet-started work, waits behind earlier started work, and deletes the record. Success reloads/dismisses. Failure allocates a fresh epoch before restoring the same controller/view. Unread and future-version records never expose this destructive action.                                                                                                                         |
| Legacy ambiguous draft          | A valid current-version draft created before this contract whose record cannot prove whether serializer normalization or accepted editing produced it. Azurite treats it as `recovered` and preserves it until explicit Save or Discard because the unchanged schema cannot classify its origin safely.                                                                                                                                                                                                                              |

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
  | "cleanup_required"
  | "recovery_read_unavailable"
  | "preserved_unknown";

type DraftFailureDetail =
  | {
      source: "cluster_identity";
      reason: ClusterIdentityUnavailableReason;
    }
  | {
      source: "persistence";
      reason: DraftPersistenceUnavailableReason;
    }
  | {
      source: "coordinator";
      reason: "snapshot_admission_failed" | "queue_task_failed";
    }
  | {
      source: "record";
      reason: "recovery_read_required" | "preserved_unknown";
    };
type DraftStorageFailure = Extract<
  DraftFailureDetail,
  { source: "persistence" | "coordinator" }
>;

type DraftPersistenceOperation =
  | "recovery_read"
  | "content_write"
  | "mode_write"
  | "cleanup"
  | "discard"
  | "queue";
type DraftRetryAction =
  | "retry_browser_recovery"
  | "retry_draft_persistence"
  | "retry_draft_cleanup"
  | "retry_discard";
type DraftPersistenceIssue = {
  ownerKey: string;
  sessionKey: string | undefined;
  clusterId: string | undefined;
  noteId: string;
  draftEpoch: number;
  revision: number | undefined;
  snapshotKey: string | undefined;
  operation: DraftPersistenceOperation;
  failure: DraftFailureDetail;
  retryAction: DraftRetryAction | undefined;
};

type DraftReadResult =
  | {
      status: "absent";
      clusterId: string;
      noteId: string;
    }
  | {
      status: "invalid_deleted";
      clusterId: string;
      noteId: string;
      reason: "validation_failed";
    }
  | {
      status: "found_current";
      draft: DraftRecord;
    }
  | {
      status: "preserved_unknown";
      clusterId: string;
      noteId: string;
      schemaVersion: number;
    }
  | {
      status: "unavailable";
      clusterId: string;
      noteId: string;
      reason: DraftPersistenceUnavailableReason;
    };

type DraftRecordMutationResult =
  | { status: "deleted" }
  | { status: "absent" }
  | { status: "invalid_deleted"; reason: "validation_failed" }
  | { status: "not_matching" }
  | { status: "preserved_unknown"; schemaVersion: number }
  | {
      status: "unavailable";
      reason: DraftPersistenceUnavailableReason;
    };

type DraftMutationSnapshot = {
  snapshotKey: string;
  clusterId: string | undefined;
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
    | "mode_change"
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
      reason: "stale_session" | "closed_epoch" | "snapshot_admission_failed";
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
      persistenceIssue: DraftPersistenceIssue | undefined;
      completion: "normal" | "subscriber_threw_after_apply";
    }
  | {
      status: "no_change";
      stateEffect: "none";
      sessionKey: string;
      revision: number;
      origin: ChangeOrigin;
      trigger: PublicationTrigger;
      reason: "authority_unchanged" | "retry_reverted";
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
        | "closed_epoch"
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

type RecoveryReadResult =
  | {
      status: "resolved";
      clusterId: string;
      noteId: string;
      ownerKey: string;
      recordStatus: "absent" | "invalid_deleted";
      disposition: "none";
      issue: DraftPersistenceIssue | undefined;
    }
  | {
      status: "resolved";
      clusterId: string;
      noteId: string;
      ownerKey: string;
      recordStatus: "found_current";
      disposition: "recovered" | "conflict";
    }
  | {
      status: "preserved";
      clusterId: string;
      noteId: string;
      ownerKey: string;
      schemaVersion: number;
      disposition: "preserved_unknown";
    }
  | {
      status: "failed";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      disposition: "recovery_read_unavailable";
      issue: DraftPersistenceIssue;
    }
  | {
      status: "superseded";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      reason: "dirty_live_authority" | "owner_lost";
    };

type DurabilityFailure =
  DraftFailureDetail | { source: "session"; reason: "owner_lost" };
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
      status: "preserved";
      cause: DurabilityCause;
      clusterId: string | undefined;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: undefined;
      disposition: "recovery_read_unavailable" | "preserved_unknown";
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
      failure: DurabilityFailure;
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
      storageOutcome: "deleted" | "absent" | "invalid_deleted";
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
      reason: "newer_revision" | "newer_record" | "owner_lost";
    }
  | {
      status: "preserved";
      cause: CleanupCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string;
      schemaVersion: number;
      disposition: "preserved_unknown";
    }
  | {
      status: "failed";
      cause: CleanupCause;
      clusterId: string;
      noteId: string;
      sessionKey: string;
      revision: number;
      snapshotKey: string | undefined;
      failure: DraftStorageFailure;
      issue: DraftPersistenceIssue;
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
      status: "preserved";
      clusterId: string;
      noteId: string;
      ownerKey: string;
      closedEpoch: number;
      restoredEpoch: number;
      schemaVersion: number;
      disposition: "preserved_unknown";
      surfaceEffect: "restored";
    }
  | {
      status: "failed";
      clusterId: string | undefined;
      noteId: string;
      ownerKey: string;
      closedEpoch: number;
      restoredEpoch: number;
      failure: DraftFailureDetail;
      issue: DraftPersistenceIssue;
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
      durability: Extract<
        DurabilityResult,
        { status: "clean" | "durable" | "preserved" }
      >;
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
     input, optional ready cluster ID, and draft epoch in an inactive coordinator
     slot. Missing cluster identity prepares an identity-blocked slot plus typed
     issue; it does not reject authority. Only stale session, closed epoch, or
     in-memory snapshot-admission failure returns `rejected/stateEffect:none`
     without calling `set`.
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
   - If a later source value or WYSIWYG projection returns exactly to the last
     acknowledged authority while a rejected publication is pending, cancel the
     retry candidate and return `no_change/retry_reverted`. Do not allocate a
     revision, admit a snapshot, or retain a stale publication error.

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
     Because the rendered owner remains unchanged, the committed route view
     remains coherent. Clicking the already-selected note immediately after Save
     settles `coherent_noop` without the gate, navigation, history mutation, or
     another note GET.
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
   - A clean `recovery_read_unavailable` or `preserved_unknown` session may return
     `preserved` and continue because no live edit is being lost and the browser
     record remains untouched. The same dispositions return `unavailable` while
     live content is dirty; Daniel must manually Save before destructive handoff.
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
   - The mode change itself never creates dirty content. For `none`,
     `cleanup_required`, `recovery_read_unavailable`, and `preserved_unknown`,
     update only the live session mode and do not create or rewrite a record. For
     `generated_pending`, `generated_durable`, `recovered`, or `conflict`, admit
     a `mode_change` snapshot through the same coordinator so the already-owned
     compatible record recovers into the selected mode. A failed mode write
     retains the disposition, exact snapshot, and `Retry draft persistence`
     issue without blocking the mode switch or manual Save.

6. **Source input**
   - Every textarea input value is exact accepted `source_input` content.
   - Update the visible local source value and publish it immediately. Do not
     normalize line endings or Markdown syntax at this boundary. Advance
     acknowledged authority only after the exact revision owns store state and
     its immutable draft snapshot is admitted to scheduled or identity-blocked
     in-memory persistence. Browser durability may remain unavailable; authority
     and manual Save do not.
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

9. **Dirty, draft, issue, and save decisions**
   - Content dirty means authoritative current Markdown differs from the saved
     baseline after CRLF-to-LF normalization only.
   - On acknowledged dirty publication, `none`, `generated_pending`,
     `generated_durable`, or `cleanup_required` becomes `generated_pending`;
     `recovered` and `conflict` remain unresolved under their existing kind;
     `recovery_read_unavailable` and `preserved_unknown` remain unchanged so the
     protected browser-record truth cannot be forgotten. Durable write completion
     changes only the matching `generated_pending` to `generated_durable`.
   - Draft disposition and `DraftPersistenceIssue` remain independent. A healthy
     scheduled/in-flight `generated_pending` snapshot has no failure issue. A
     rejected write, blocked identity target, unread record, failed cleanup, or
     failed Discard owns one exact issue with its operation, owner, epoch,
     revision/snapshot, underlying reason, and permitted retry action.
   - Missing cluster identity never rejects an edit. Admit the immutable snapshot
     under the current session, set `generated_pending` when record truth permits,
     otherwise retain the protected disposition, and report dirty durability as
     `unavailable`. Later identity repair may bind the original snapshot without
     recapturing content only when absence/compatible current-version ownership is
     already proven. `recovery_read_unavailable` and `preserved_unknown` never
     authorize that write; dirty content in those states remains manually
     saveable. A newer accepted revision or successful Save supersedes the slot.
   - Returning a `recovered` draft to content equal to disk does not silently
     resolve or delete its browser record. A failed deletion of a known compatible
     record becomes `cleanup_required`; unread or future-version records never do.
   - When a `generated_pending` session returns clean, cancel/coalesce a
     not-yet-started dirty snapshot. If no write started and no record was
     previously durable, transition directly to `none` without speculative
     deletion. If a write started or a record is `generated_durable`, wait for it
     and perform an ordered transactional read/deletion before resolving the clean
     snapshot.
   - A clean reconciliation failure becomes `cleanup_required` only after a
     compatible current-version record and intended cleanup are known. It is not
     invented after a cancelled scheduled snapshot, failed initial read, or
     preserved unknown record. A destructive handoff reports `clean` only in
     `none`; clean unread/unknown state reports `preserved`.
   - Save remains disabled for content-clean `none`, `cleanup_required`,
     `recovery_read_unavailable`, and `preserved_unknown` sessions, and a direct
     programmatic Save makes no API request. Dirty content remains manually
     saveable in all four dispositions. A `recovered` session keeps Save available
     even when content compares clean so explicit Save can dispose of its known
     compatible record through the content-hash contract. `conflict` Save remains
     blocked.
   - A successful filesystem Save always updates the exact-session saved baseline,
     content hash, and content-dirty fact. For a known compatible record, exact
     conditional cleanup returns `deleted`, `absent`, `not_matching`,
     `preserved_unknown`, or `unavailable`; only a failed intended compatible
     cleanup becomes `cleanup_required`. For unread or future-version state, Save
     does not attempt deletion, cancels every pending content/mode snapshot for
     the saved revision so later identity/read repair cannot write a stale draft,
     and retains the visible preserved disposition.
   - `Retry draft cleanup` orders an exact-session conditional deletion without
     another filesystem write. It is visible only for `cleanup_required`, changes
     to `none` only after `deleted`, `absent`, or `invalid_deleted`, becomes
     superseded after `not_matching`, and becomes `preserved_unknown` without
     deleting after an unknown-version result. A later accepted edit supersedes
     the clean retry snapshot and returns a compatible current record to
     `generated_pending`.
   - A rejected content or mode write retains the exact current snapshot and
     disposition plus `Retry draft persistence`. Retry the same snapshot through
     the ordered coordinator without requiring another edit; a newer accepted
     revision or mode snapshot supersedes it. Do not spin in an automatic
     unbounded retry loop.
   - The draft flush boundary returns a snapshot-specific durability result.
     Destructive note/route transitions may proceed after `clean`, `durable`, or
     clean-record `preserved`, but not after `unavailable`. Save and mode switching
     retain the current session and do not depend on successful browser
     persistence to avoid losing the only live copy.

10. **Recovery-read failure and future-version preservation**
    - Derive the draft key from the ready cluster identity in the exact note-read
      response that owns the route application. Do not read through an older
      mutable store identity before applying that response. If that response has
      unavailable identity, do not call Dexie; install
      `recovery_read_unavailable` with the exact cluster reason and allow a later
      same-owner retry to use repaired identity.
    - `DraftPersistence.readDraft` returns exactly `absent`, `invalid_deleted`,
      `found_current`, `preserved_unknown`, or `unavailable`. `absent` and the
      existing-policy `invalid_deleted/validation_failed` result prove no record
      remains; the latter retains visible diagnostic truth without pretending the
      malformed record was ordinary absence. `preserved_unknown` carries the
      observed future schema version without exposing or interpreting its
      payload.
    - An unavailable initial or same-note recovery read installs the disk-backed
      editor with `recovery_read_unavailable`, a precise issue, and visible
      `Retry browser recovery`; it never installs `cleanup_required`, deletes a
      record, or authorizes a current-version write over the unknown key.
    - Recovery retry may apply a result only while the exact owner remains current
      and live content is clean. `absent` or `invalid_deleted` becomes `none`
      while retaining any validation issue; `found_current` applies the exact
      draft through normal recovered/conflict classification;
      `preserved_unknown` becomes the visible preserved state; another failure
      refreshes the same issue. If live content is dirty, return
      `superseded/dirty_live_authority`, keep the edit visible, and require manual
      Save before a later retry can replace authority.
    - Accepted edits during `recovery_read_unavailable` or `preserved_unknown`
      remain Zustand authority and manually saveable, but current-version draft
      writes stay blocked so neither an unread record nor a future-version record
      is overwritten. While unread live content is dirty, remove the actionable
      recovery retry from the issue and render manual-Save guidance; a defensive
      retry call returns `superseded/dirty_live_authority`. Dirty destructive
      handoff is unavailable. After successful manual Save makes the live content
      clean, restore the read retry when applicable and allow handoff to return
      `preserved` while leaving the browser record untouched.
    - An older build never exposes Discard for `preserved_unknown`, never deletes
      it during Save cleanup, and never rewrites it through content or mode
      persistence. Show concise guidance that a compatible newer Azurite build is
      required to inspect or dispose of that recovery record.
    - Conditional and direct mutations return `deleted`, `absent`,
      `invalid_deleted`, `not_matching`, `preserved_unknown`, or `unavailable`
      from one Dexie transaction. Store state may not infer deletion from generic
      success or a separate pre-read.

11. **Legacy ambiguous draft compatibility**
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

12. **Ordered draft persistence ownership**
    - `prepareSnapshot` is synchronous: it validates session/epoch, captures the
      ready cluster ID when available, stores one inactive immutable slot, and
      either returns `prepared` or has no side effect. Unavailable identity creates
      a valid unbound slot, not rejection. `commitPrepared` and `cancelPrepared`
      are synchronous, idempotent, non-persistence operations. A prepared slot is
      not executable until committed, but reads/drains recognize and wait for the
      publication command to commit/cancel it.
    - A committed unbound slot remains owned by its exact session and reports an
      identity issue. When the same session later observes a ready cluster ID,
      bind the original immutable snapshot to that cluster/note queue after
      owner/epoch/revision revalidation only when disposition proves that a
      current-version write is safe. Unread or future-version record truth keeps
      the slot blocked until Save, cancellation, or supersession. Never
      reconstruct its Markdown, mode, or base hash from mutable store state.
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
    - Order exact-outcome `readDraft`, content and mode writes, generated-clean
      deletion, cleanup retry, explicit Discard, durability drain, and successful
      Save conditional cleanup per cluster/note key. Different notes remain
      independent.
    - Move the generic `KeyedTaskCoordinator` from `packages/core` to a
      browser-safe `packages/shared` module and update core's existing writer to
      consume it. Compose that primitive inside a focused web draft coordinator
      for unbound slots, coalescing, consistent reads, cancellation, and terminal
      barriers. Do not add `@azurite/core` to the web app, import across package
      source paths, or create a parallel generic queue.
    - Convert every task rejection into the caller's typed failure result while
      releasing the tail in `finally`. One failed task cannot poison later work,
      and the key plus scheduled slot are pruned when no work or session owner
      remains.
    - An older mutation may finish and report its own result, but exact-session
      revalidation prevents it from applying disposition, degraded status, or a
      durability decision to a newer session.
    - Successful-save cleanup remains conditional on the exact saved snapshot and
      consumes the adapter's exact mutation outcome. A newer/mismatching admitted
      draft survives and uses the new saved baseline; an unknown future record is
      preserved; a failed intended compatible cleanup applies `cleanup_required`
      only if that saved session/revision still owns the note.
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
  serialization, rejection-safe release, and idle-key pruning, but `@azurite/web`
  does not depend on `@azurite/core` and core's only public entry also exports
  filesystem behavior. Move this browser-safe primitive to `@azurite/shared`,
  update core's writer to consume it, and compose it in the web-specific draft
  coordinator rather than importing core or duplicating the generic guarantees.
- The current draft adapter returns generic `ok` for deleted, absent,
  mismatching, and preserved-unknown conditional mutation outcomes, and returns a
  preserved future-version record as ordinary absence. Slice 7D must enrich that
  boundary transactionally before store disposition can be honest.
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
  `route-transition-owner.ts` 350, `route-intent-execution.ts` 336,
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
  Missing cluster identity prepares an unbound slot and exact issue rather than
  rejection. A true preparation failure cannot mutate state; a subscriber throw
  after application commits the already prepared slot once; exact store readback
  is not the decision boundary.
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
- When visible content returns to the acknowledged authority, cancel an existing
  retry candidate as `no_change/retry_reverted`; do not create a revision or keep
  a stale editor error merely because an earlier publication failed.
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
- Refactor the route QA extension point from replacement to decoration. Compose
  the production baseline/editor gate first, then allow the acceptance-only
  controller to wrap that real gate for hold/cancel/throw controls. Prove the QA
  path still executes production commit, durability, freeze, and settlement.
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
- Consume each settlement lease before or in a non-throwing `finally` around
  optional diagnostics. Slice 7C intentionally contains settlement exceptions,
  so no thrown QA or diagnostic callback may strand a session frozen or retain a
  refcount.
- Change the pending-draft flush boundary to accept an immutable snapshot and
  return snapshot-specific `clean`, `durable`, `preserved`, or `unavailable`.
  `preserved` is valid only for clean unread/future-version state whose record is
  untouched. An unavailable dirty write or required compatible cleanup cancels
  selection/history synchronization and unfreezes the same editor session.
- Return only `continue` or `cancel` plus exact-session failure information to
  Slice 7C. Do not push, replace, compare, retain, block, or restore history in
  this slice.
- Refactor successful same-session save reconciliation so it updates the saved
  baseline, hash, note metadata, draft disposition, and status in place. It must
  retain `sessionKey`, editor mode, current Markdown, revision ownership, Crepe,
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
  from equality and `DraftPersistenceIssue`. Preserve `recovered`, `conflict`,
  `cleanup_required`, `recovery_read_unavailable`, and `preserved_unknown` even
  when content compares clean.
- Replace the draft adapter's generic read and mutation success with the exact
  transactional outcomes in the authoritative contract. A future-version record
  must never collapse to absence, and conditional cleanup must distinguish
  deleted, absent, invalid-deleted, mismatching, preserved unknown, and
  unavailable.
- Pass the ready cluster ID from the exact `ReadNoteResponse` into the consistent
  recovery read before the terminal route mutation. Do not have that read consult
  an older store identity. Apply the response identity, read disposition, editor,
  and committed route view together after exact-current revalidation.
- Implement `Retry browser recovery` for clean
  `recovery_read_unavailable` sessions. Block it as
  `superseded/dirty_live_authority` while unsaved live edits exist; preserve those
  edits and manual Save rather than replacing them with a late recovered draft.
  Remove the actionable retry from the dirty issue and restore it only after the
  session is clean and still owns the unread record state.
- Treat `preserved_unknown` as visible incompatible recovery truth. Do not expose
  Discard or issue current-version content/mode writes or cleanup against it.
- Ensure mode-only updates follow Required Transition 5: no record for `none`;
  coordinated mode persistence for generated/recovered/conflict records; live-only
  mode for cleanup, unread, or future-version state; exact retry issue on a failed
  compatible mode write.
- Keep `canSaveEditor` as the defensive API boundary: content-clean `none`,
  `cleanup_required`, `recovery_read_unavailable`, and `preserved_unknown` never
  call the filesystem Save API even if UI invokes it directly; dirty content in
  those dispositions remains manually saveable. A `recovered` record remains
  explicitly saveable; `conflict` remains blocked; cleanup and recovery-read
  issues expose their distinct actions.
- Move the generic keyed task coordinator from `packages/core` to an exported,
  browser-safe `packages/shared` module and update the core writer to consume it.
  Compose it into a focused web draft-persistence coordinator for unbound slots,
  consistent reads, scheduled snapshots, content/mode writes, clean-session
  deletion, cleanup retry, explicit Discard, durability drain, and successful-Save
  cleanup. Add no `@azurite/core` web dependency or cross-package source import.
- Prepare the immutable snapshot in an inactive coordinator slot before the
  exact Zustand updater, then commit/cancel it from the updater's local
  `didApply` result. A missing cluster ID owns a committed unbound slot and exact
  issue; later identity repair binds that same snapshot only after
  owner/revision revalidation and proof that current-version mutation is safe.
  Protected unread/future state never authorizes the write, and successful Save
  cancels the saved revision. A debounce callback may start/coalesce committed
  work but cannot capture mutable editor state or represent admission.
- Track store-owned per-session draft disposition from consistent load,
  admission, and completed mutations. Distinguish `generated_pending` from
  `generated_durable`. A pristine or cancelled-before-start clean session with
  no owned record returns `clean` without speculative deletion; started/durable
  work must be drained and its record absence proven before returning `clean`.
- Track one store-owned persistence issue separately with exact owner, epoch,
  operation, revision/snapshot, underlying reason, and retry action. Clear or
  supersede it only through matching success, a newer revision, Save/Discard
  disposition, or owner replacement; never let an old issue degrade a new note.
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
- On successful Save from `recovery_read_unavailable` or `preserved_unknown`,
  update the saved disk truth, cancel the saved revision's blocked content/mode
  snapshots, and do not call browser deletion. Keep the record disposition
  visible and allow clean handoff as `preserved`; later identity/read repair
  cannot resurrect the saved edit as a draft.
- Remove the current successful-Save fresh-session reconstruction. Update the
  existing exact session in place and prove its unchanged owner keeps the
  committed route view coherent; a same-target click after Save must allocate no
  route lease and issue no note GET.
- On draft-write rejection, retain the immutable current snapshot plus its
  applicable disposition and exact issue, and expose `Retry draft persistence`.
  Route the retry through the same coordinator, require no
  intervening edit, preserve the underlying failure reason, and let a newer
  admitted revision or mode change supersede the failed snapshot.
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
  actions absent for pristine, unread, and future-version sessions and expose
  recovery-read and cleanup retry separately. If an unknown future record appears
  transactionally during Discard, preserve it, advance the epoch, restore the
  surface, and do not reload.

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
  - missing cluster identity prepares and acknowledges an unbound immutable
    snapshot, advances exact Zustand authority, exposes a persistence issue, and
    leaves manual Save usable without claiming durability;
  - a publication whose exact updater applied before a subscriber throws commits
    its pre-admitted snapshot exactly once and is neither revised nor scheduled
    twice;
  - a nested subscriber publication gives each applied revision its own prepared
    snapshot without using current Markdown readback to infer the older result;
  - source and WYSIWYG content returning to acknowledged authority cancels a
    rejected retry candidate as `no_change/retry_reverted` without a revision,
    snapshot, or stale error;
  - delayed old-session work cannot replace a new session.
- Extend `MilkdownEditor` component tests with a controllable Crepe mock whose
  create promise and `markdownUpdated` callback can be resolved independently.
- Prove same-session rerenders after Markdown, mode, disposition, persistence
  issue, recovery, and save-status changes retain one Crepe instance and preserve
  its checkpoint and Undo history; a new `sessionKey` creates exactly one
  replacement instance.
- Prove successful same-session Save settlement retains `sessionKey`, source or
  WYSIWYG mode, the same Crepe instance, selection, checkpoint, and Undo history.
- After that Save, click the already-selected note and prove the Slice 7C
  coherent predicate remains true: no gate lease, navigation, history change,
  note GET, route evidence operation, or editor replacement occurs.
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
  the real editor gate registered and the acceptance controller decorating it.
  Prove the QA hold/cancel/throw controls do not bypass production commit,
  durability, freeze, or settlement; overlapping intents may reuse one session
  operation but own distinct leases; B's `superseded/none` settlement cannot
  unfreeze while A's current lease remains. Slice 7C still starts/skips the
  correct action and reports distinct outcomes.
- Simulate unavailable required draft persistence for sidebar selection and
  Back/Forward, including missing cluster identity. Prove the gate returns
  `cancel`; the Slice 7C owner performs exact-current history handling; the same
  editor and Undo history are unfrozen; prior focus is restored when possible;
  the edit is acknowledged into Zustand; dirty content retains working manual
  Save; a successful Save permits clean handoff without pretending a draft was
  durable; and clean `cleanup_required` content exposes Retry cleanup instead of
  an unusable Save action.
- Feed every settlement surface effect (`retained`, `none`, `replaced`, and
  `replaced_by_error`) back with its lease and prove only that lease/session is
  released or destroyed. Prove `coherent_noop` allocates no lease and never
  freezes. Throw during decorated settlement and prove lease removal/refcount
  release still occurs exactly once before the exception is contained.
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
- Add unbound-snapshot tests that admit content without cluster identity, bind
  the original immutable content/mode/base hash after same-session identity
  repair only when compatible record truth permits, keep unread/future state
  blocked, cancel the saved revision after manual Save, reject old-session repair,
  and prune an abandoned unbound slot.
- Move the generic keyed-coordinator tests with the primitive into
  `packages/shared`; keep core writer serialization tests and add web composition
  tests for scheduled slots, cancellation, terminal barriers, and idle pruning.
- Reject read, write, cleanup, and Discard tasks in turn. Prove each caller gets
  the exact typed issue with underlying cluster/Dexie/coordinator reason, later
  same-key work still runs, scheduled slots cannot resurrect stale work, and
  idle coordinator entries return to zero.
- For write rejection specifically, prove the exact failed snapshot remains
  retryable with its applicable disposition and exact issue; for generated work
  it remains `generated_pending`. Invoke `Retry draft persistence` without
  another edit and prove the same revision becomes durable. Repeat with a newer
  edit and a newer mode snapshot before retry and prove only the newest admitted
  snapshot may win.
- Prove a pristine clean session performs no speculative draft deletion, while a
  session that durably wrote and then reverted completes its ordered deletion
  before destructive handoff reports `clean`.
- Extend Dexie adapter tests so reads distinguish absent, invalid-deleted, valid
  current, preserved unknown, and unavailable; conditional/direct mutations
  distinguish deleted, absent, invalid-deleted, not matching, preserved unknown,
  and unavailable in one transaction. Seed a future-version record and prove
  read, content edit, mode
  change, Save cleanup, retry, and attempted Discard never overwrite or delete
  its raw value.
- Extend note-browser store tests to prove:
  - pristine load plus editor readiness creates no draft;
  - mode-only changes leave no draft after flush for `none`, update the existing
    compatible record for generated/recovered/conflict dispositions, and remain
    live-only for cleanup/unread/future-version dispositions;
  - a content-clean `none` programmatic Save makes zero API calls;
  - unavailable cluster identity still accepts exact edits, marks them dirty,
    exposes the precise issue, blocks destructive handoff, and completes manual
    Save through one API call; later identity repair cannot recapture newer store
    content into an older snapshot;
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
  - an initial recovery-read failure enters `recovery_read_unavailable`, performs
    no deletion or current-version write, exposes Retry browser recovery while
    clean, and resolves absent/current/future/unavailable outcomes exactly;
  - a recovery retry attempted after a live edit returns
    `superseded/dirty_live_authority`, preserves the exact edit and manual Save,
    and cannot replace it with late recovered content;
  - a clean unread or future-version session may hand off as `preserved`, while a
    dirty one cancels handoff until manual Save succeeds;
  - successful Save in unread/future-version state updates disk truth without
    calling browser cleanup or falsely changing disposition to `none`, and
    cancels the saved revision so later repair cannot write a stale draft;
  - ordinary/conflict/missing-note Discard cancels scheduled work, deletes before
    reload, and cannot be resurrected by a late callback;
  - failed Discard deletion performs no reload and restores the same exact
    editor, content, selection, Undo history, disposition, fresh draft epoch,
    and retry action; a subsequent edit becomes durable while every closed-epoch
    callback remains rejected;
  - retry after failed Discard closes the fresh epoch and succeeds without
    resurrecting old work; failed missing-note Discard keeps the missing-draft
    view and advances its owner epoch without reloading;
  - a future-version result discovered transactionally during Discard preserves
    the raw record, restores the surface under a fresh epoch, and exposes no
    destructive older-build action;
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
- Add explicit web and root `qa:markdown-fidelity:dev`, `build`, and `preview`
  scripts plus a root `qa:markdown-fidelity:assert-product-excluded` check.
  Automated verification must build the harness, then rebuild the ordinary
  product and assert from its manifest/output that the harness entry, global
  controller marker, and fault controls are absent.
- Use fake timers only to drive the known debounce/draft scheduling in tests;
  production logic must not use timing guesses for authority.

### 7. Update Durable Architecture And QA Evidence

Implementation requirements:

- Update `docs/technical-architecture.md` so the Markdown rendering section
  names exact Markdown authority, acknowledged WYSIWYG projection, ordered
  browser-draft read/mutation ownership, identity-blocked admission, exact
  adapter outcomes, record disposition versus persistence issue, preserved
  unread/future-version state, terminal Discard, cleanup retry, and the real-edit
  serialization boundary. Record the shared generic keyed-tail primitive and
  web-specific coordinator composition in their actual package boundaries.
- Update this slice with concise completion evidence rather than duplicating
  full browser logs.
- Add a focused QA record under `docs/qa/` containing fixture names, before/after
  hashes, browser results, IndexedDB proof, and any observed WYSIWYG
  normalization after an accepted edit.
- Record prevention of new projection-only drafts separately from preservation
  and explicit disposition of seeded legacy ambiguous drafts, failed recovery
  reads, and unknown future-version records.
- Record the implemented typed accepted-change, synchronization, commit, and
  publication/admission, recovery-read, persistence-issue, durability, cleanup,
  Discard, and route-gate result shapes as the input for Slice 7E's required
  promotion refresh. Slice 7E must distinguish raw projection observation from
  accepted authority change, preserve underlying cluster/Dexie reasons, and not
  require an editor session ID before draft read and editor-session creation
  complete.
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
- Preserving an unread record while live content changes requires simultaneous
  editable versions, merge UI, or another durable record instead of the
  clean-only retry and manual-Save boundary defined here. Do not silently add a
  second unsaved-content owner.
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
- Missing cluster identity, failed recovery reads, unknown future records, and
  IndexedDB failures must not reject accepted authority or disable manual Save;
  they block only unsupported browser mutation and dirty destructive handoff.
- An unavailable recovery read must not become absence or `cleanup_required`,
  and its retry must not replace dirty live authority.
- An unknown future-version record must not be overwritten or deleted by read,
  content/mode persistence, Save cleanup, retry, or Discard in this older build.
- Generic persistence success must not be interpreted as proof of deletion;
  disposition changes consume exact transactional outcomes.
- An older draft mutation must not overwrite newer recovery truth, delete a
  newer draft, degrade a newer session, or authorize destruction of a different
  snapshot.
- A same-session rerender must not reconstruct Crepe, reset Undo history, move a
  synchronization checkpoint, or duplicate an editor DOM tree.
- Successful Save settlement must not end a same-note editor session or cancel a
  WYSIWYG edit still waiting for Milkdown's debounced listener.
- Successful Save must not stale the committed rendered-owner identity, turn an
  already-selected note click into a gate/load, or issue a second note GET.
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
- A failed draft write must not consume its exact retryable snapshot, require a
  dummy edit to retry, or let an older retry overwrite a newer revision.
- A failed persistence issue must not lose its exact operation, owner,
  revision/snapshot, retry action, or underlying cluster/Dexie/coordinator
  reason, and must not remain visible after a matching success or supersession.
- A mode-only change must not create a pristine record, lose the selected mode
  from an existing compatible record, overwrite protected recovery truth, or
  become content dirty.
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
- The Slice 7C QA controller must not replace or bypass the production editor
  gate, and a contained settlement exception must not strand a freeze lease.
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
/opt/homebrew/bin/pnpm qa:markdown-fidelity:build
/opt/homebrew/bin/pnpm validate
/opt/homebrew/bin/pnpm build
/opt/homebrew/bin/pnpm qa:markdown-fidelity:assert-product-excluded
git diff --check
```

The final test evidence must name the new fixture/controller/component/store
cases, confirm the Slice 7B save-integrity regression tests still pass, and show
that the ordinary rebuilt product contains no lifecycle-harness entry, global
controller marker, or fault control.

### Real-Browser Desktop QA

Use a disposable cluster and the available Codex Playwright skill or browser
plugin; do not add Playwright as a repository dependency merely for this QA.
Follow `docs/runbooks/playwright-acceptance.md` for the shared runtime, device,
state-owner, evidence, and cleanup procedure. Run the four-cell desktop/Pixel 6
and development/optimized-production product matrix with Sentry disabled. Add
one optimized desktop Sentry-enabled diagnostic cell to confirm the exercise
introduces no uncaught fault; 7D neither changes nor relies on Sentry, so it does
not duplicate every product cell along that conditional dimension. Run core
authority, Save, route, and fidelity scenarios in all four product cells;
storage/queue fault injection may run in optimized desktop, with the
interaction-sensitive freeze/restore variants repeated in optimized Pixel 6.
The QA record must list each scenario's selected cells before execution:

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
7. Under a throttled cold start, switch to source while the visible preparing
   state is still present when that window is observable, make one source edit,
   attempt WYSIWYG activation before readiness, and confirm the edit becomes
   dirty while source remains visible and stale WYSIWYG content cannot appear.
   Observe the exact draft mutation complete before claiming recoverability.
   After readiness, enter WYSIWYG and confirm it shows the latest source rather
   than the stale construction value.
8. In the test-only browser lifecycle harness, hold the real component's create
   promise pending and repeat the pre-ready activation attempt deterministically;
   then reject creation and confirm exact source remains editable, WYSIWYG stays
   unavailable, failure is visible, and no content callback/draft is invented.
   Run this harness through Vite development and its optimized harness build,
   rebuild the ordinary app, and prove its output excludes the harness entry and
   fault marker.
9. Make one deliberate WYSIWYG edit and switch immediately to Markdown; confirm
   the edit is present, dirty, and saveable, then observe the exact ordered
   draft mutation complete before claiming it is recoverable and durable.
   Record any broader Milkdown syntax normalization honestly as the accepted
   real-edit boundary.
10. Repeat an immediate WYSIWYG edit before Save, sidebar selection, Back, and
    Forward; confirm the public pre-transition commit and acknowledged
    publication complete before the action continues. Separately, make an edit,
    observe its exact draft as durable, reload, and confirm recovery. For
    `visibilitychange` and `pagehide`, confirm synchronous commit precedes the
    best-effort flush attempt and claim recovery only when IndexedDB completion
    is observed.
11. Hold a Save request pending, edit in WYSIWYG, settle Save before the
    200-millisecond listener, and confirm the same Crepe DOM, mode, selection,
    checkpoint, and Undo history remain. After the listener settles, confirm the
    newer edit is dirty and recoverable against the updated saved baseline.
    Separately, complete an ordinary Save and click the already-selected note;
    prove no gate, navigation, history mutation, note GET, or editor replacement
    occurs.
12. Hold a replacement note read pending after sidebar and Back/Forward
    navigation. Confirm the outgoing article becomes visibly busy, `aria-busy`,
    inert to editor and toolbar input, exposes its live status outside the inert
    subtree, and still allows a newer note-list intent. Settle the read inside the
    listener debounce window and prove the committed edit recovers exactly on
    reopen without automatic focus theft.
13. Force both a dirty-draft write and a required clean-session draft deletion
    used by sidebar and Back/Forward handoff to fail. Confirm no note load starts,
    the Slice 7C owner handles only the exact current intent, the same editor and
    Undo history become interactive again, prior focus is restored when
    possible, and the exact dirty-Save or clean-cleanup-retry action is visible.
    Separately make cluster identity unavailable, edit, prove Zustand becomes
    dirty while draft durability is unavailable, complete manual Save, and prove
    clean handoff can continue without a claimed draft write.
14. Run the Slice 7C repeated-same-target race through the acceptance decorator
    around the real editor gate and force each terminal outcome plus thrown
    settlement. Confirm production commit/freeze/durability still runs and no
    coherent no-op, stale intent, cancellation, failed load, or contained throw
    strands the rendered controller frozen or closed.
15. Trigger same-session parent rerenders through mode, draft disposition,
    persistence issue, and save-status changes; confirm one Crepe DOM tree
    remains, Undo still reaches the checkpoint, and no duplicate listener
    publishes. Component tests own the exact instance-count assertion.
16. Create an external-write conflict, discard the recovered draft, and confirm
    exact disk Markdown stays clean after editor readiness and mode switching.
    Repeat with deletion forced to fail: confirm no reload occurs and the exact
    editor, selection, Undo history, disposition, and retry path return.
17. Confirm Discard of ordinary and missing-note recovery cancels a pending
    scheduled write and cannot be resurrected by its debounce or lifecycle
    callback after deletion.
18. Recover one deliberate dirty draft whose syntax normalizes in Milkdown and
    confirm the exact draft remains authoritative and dirty until save or
    discard.
19. Seed a valid pre-7D projection-only draft with the current base hash, confirm
    Azurite preserves it as ambiguous and exposes Save and Discard, discard it
    explicitly, and confirm exact disk Markdown remains clean after readiness and
    mode switching.
20. Seed an ordinary recovered draft that compares clean, edit another recovered
    draft back to its saved baseline, and confirm each record plus Save and
    Discard remain until explicit disposition. Switch mode in generated,
    recovered, and conflict sessions, reload, and prove the compatible record
    retains the selected mode without treating that mode change as content dirty.
21. Save a dirty or recovered note while forcing exact browser cleanup to fail.
    Confirm disk bytes/hash and saved baseline advance, disposition becomes
    `cleanup_required`, Retry cleanup makes no second `PUT`, and successful retry
    removes the record. Repeat with a newer edit before retry and prove the newer
    draft survives.
22. Navigate rapidly between notes during editor creation and confirm stale
    callbacks never alter the current note.
23. Delay and reorder scheduled snapshots, same-note reopen/read, cleanup, Save,
    Discard, and navigation. Confirm the read observes the ordered result, the
    final IndexedDB record matches the newest snapshot, rejected work does not
    poison the key, and different notes remain independent.
    Force one draft write to fail, invoke the visible retry without another edit,
    and prove the same exact snapshot becomes durable; then prove a newer edit
    supersedes the failed snapshot before retry.
24. Force initial recovery read to fail. Confirm the disk-backed editor remains
    usable with `recovery_read_unavailable`, no delete/write occurs, and Retry
    browser recovery resolves absent/current/future/failure exactly while clean.
    Edit before retry and prove retry cannot replace the live edit; manual Save
    remains available and successful Save leaves the unread record untouched.
25. Seed an unknown future-version record. Confirm Azurite reports preserved
    incompatible recovery rather than absence, exposes no Discard, never rewrites
    it through mode/content/Save cleanup, blocks dirty handoff until manual Save,
    and leaves the raw IndexedDB value byte-for-byte equivalent afterward.
26. Wait through readiness and delayed configured-plugin activity without input;
    confirm no post-ready non-authoritative document change becomes accepted
    content.
27. Confirm the normal console has no new errors or warnings in every product
    cell. In the selected Sentry-enabled diagnostic cell, inspect authenticated
    telemetry only to prove the exercise introduced no uncaught fault; in every
    Sentry-disabled product cell, prove there is no Sentry transport.

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
- make cluster identity unavailable, edit through touch input, confirm authority
  and manual Save remain usable while dirty navigation is blocked, then Save and
  confirm handoff succeeds without a false durability claim;
- repeat clean recovery-read failure retry and preserved future-version status,
  confirming protected records expose no destructive touch action;
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
  in-memory snapshot admission, including after a subscriber throws or when the
  snapshot remains identity-blocked; it does not falsely claim Dexie durability.
- Required Transitions 4 and 8 preserve one Crepe instance, selection,
  checkpoint, and Undo history through same-session rerenders and successful
  Save. The unchanged rendered owner keeps the committed route view coherent,
  so a same-target click after Save is a zero-I/O `coherent_noop`. Destructive
  handoff remains visibly busy, inert, exact-session, and durable before
  replacement.
- The editor gate owns no route targets, intent identity, or history handling. It
  consumes Slice 7C's gate/outcome seam, restores the exact outgoing session for
  every non-applied outcome, and never strands a controller closed or frozen.
  The Slice 7C QA controller decorates this production gate instead of replacing
  it, and contained settlement failure cannot retain a lease.
- Required Transitions 9–12 use one CRLF/LF-only content comparison plus separate
  record disposition, exact persistence issue, unbound admission, and ordered
  per-note read/mutation ownership. Deferred tests prove that scheduled work,
  reads, writes, cleanup, Save, and Discard cannot supersede newer recovery truth
  and failed tasks do not poison or leak a key or unbound slot.
- Content-clean `none`, `cleanup_required`, `recovery_read_unavailable`, and
  `preserved_unknown` sessions cannot call filesystem Save programmatically;
  dirty content in those dispositions remains manually saveable.
  `cleanup_required` and clean read failure have distinct exact retry actions;
  successful disk Save remains truthful if cleanup/read/future-state persists.
  Every valid ordinary recovered draft remains explicitly saveable and
  discardable until disposition, including after comparison to or editing back
  to disk; conflicts retain their existing blocked-Save behavior.
- Exact adapter outcomes prove absence, compatible current records, mismatching
  records, unavailable reads/mutations, and preserved unknown schemas. Recovery
  retry never replaces dirty live authority, and current-version content, mode,
  cleanup, or Discard work never overwrites or deletes a future-version record.
- Mode-only changes create no pristine record, persist the selected mode for an
  already-owned compatible record, remain live-only for protected dispositions,
  and never become content dirty.
- Confirmed Discard is terminal for one owner epoch. It reloads or dismisses
  missing-note recovery only after deletion succeeds, cannot be resurrected by
  closed-epoch work, and restores the same editor with a fresh persistence epoch
  after failure.
- Exact source and WYSIWYG edits become durable, save through the content-hash
  contract, and recover after reload once the matching draft or save completes.
  Browser lifecycle flush attempts are not reported as durable without observed
  IndexedDB completion.
- A failed draft write retains the exact immutable retry obligation and a visible
  issue with its underlying reason. The same snapshot can become durable without
  another edit, a newer revision or mode snapshot supersedes it safely, missing
  identity can later bind it without recapturing content, and no unbounded
  automatic retry loop is introduced.
- Typed accepted-change, publication/admission, synchronization, commit,
  recovery-read, persistence-issue, durability, cleanup, Discard, and editor-gate
  results expose session, operation, and underlying cause truth for Slice 7E
  without adding Sentry behavior or making diagnostics a state owner.
- Architecture and QA evidence record exact authority, acknowledged projection,
  ordered draft ownership, precise adapter outcomes, unread/future preservation,
  shared generic coordinator placement, legacy disposition, same-session Save,
  and the honest post-WYSIWYG serialization limitation. Unrelated findings remain
  separately tracked.
- The four-cell desktop/Pixel 6 and development/optimized-production product
  matrix plus the selected optimized desktop Sentry diagnostic cell pass without
  claiming the Android input bug or requiring physical-phone evidence.
- `/opt/homebrew/bin/pnpm qa:markdown-fidelity:build`,
  `/opt/homebrew/bin/pnpm validate`, `/opt/homebrew/bin/pnpm build`, the ordinary
  product harness-exclusion assertion, `git diff --check`, clean `main`, and
  synchronization with `origin/main` pass.

## Open Questions

None for planning. The product decision, source-of-truth boundary, bounded
WYSIWYG dirty-state latency, completed-draft reload guarantee, real-edit
limitation, identity-blocked admission, recovery-read retry, future-schema
preservation, mode persistence, implementation sequence, scope exclusions, and
completion proof are explicit. Literal pre-debounce dirty indication and
unload-warning UX remain evidence-gated future hardening rather than unresolved
7D decisions. New contradictory runtime evidence must use the scope re-selection
triggers above.
