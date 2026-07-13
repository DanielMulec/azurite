import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftSnapshotResult } from "../persistence/draft-persistence-coordinator.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DraftDisposition,
  DraftMutationSnapshot,
} from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type {
  StoreContext,
} from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import {
  getCurrentEditor,
  getExactEditor,
  getStateEditor,
  readyEditorPatch,
  stateOwnsEditor,
} from "./note-browser-editor-state.js";

/** Publishes exact accepted Markdown with synchronous snapshot admission. */
export function publishMarkdownChange(
  command: PublicationCommand,
  context: StoreContext,
): PublicationResult {
  const editor = getExactEditor(command.sessionKey, context);
  if (editor === undefined) {
    return rejectedPublication(command, 0, "none", "stale_session");
  }
  if (editor.currentMarkdown === command.markdown) {
    return noChangePublication(command, editor, "authority_unchanged");
  }
  const snapshot = createAuthoritySnapshot(command.markdown, editor, context);
  const prepared = context.draftCoordinator.prepareSnapshot({
    isCurrent: () => isCurrentSnapshot(snapshot, context),
    onSettled: (settlement) => {
      applySnapshotSettlement(settlement.snapshot, settlement.result, context);
    },
    snapshot,
  });
  if (prepared.status === "rejected") {
    return rejectedPublication(
      command,
      prepared.attemptedRevision,
      editor.draftDisposition,
      prepared.reason,
    );
  }
  return applyPreparedPublication(command, editor, snapshot, context);
}

/** Updates live mode and persists it only for an already-owned record. */
export function updateEditorModeWithSnapshot(
  editorMode: EditorMode,
  context: StoreContext,
): void {
  const editor = getCurrentEditor(context);
  if (editor === undefined || editor.editorMode === editorMode) {
    return;
  }
  if (!shouldPersistMode(editor.draftDisposition)) {
    patchModeOnly(editor, editorMode, context);
    return;
  }
  const snapshot = createModeSnapshot(editorMode, editor, context);
  const prepared = context.draftCoordinator.prepareSnapshot({
    isCurrent: () => isCurrentSnapshot(snapshot, context),
    onSettled: (settlement) => {
      applySnapshotSettlement(settlement.snapshot, settlement.result, context);
    },
    snapshot,
  });
  if (prepared.status === "rejected") {
    return;
  }
  let didApply = false;
  try {
    context.set((state) => {
      if (!stateOwnsEditor(state, editor)) {
        return state;
      }
      didApply = true;
      return readyEditorPatch({
        ...editor,
        editorMode,
        lastSnapshotKey: snapshot.snapshotKey,
        persistenceIssue: getAdmissionIssue(snapshot, editor, context),
        revision: snapshot.revision,
      });
    });
  } catch {
    // Zustand may throw from a subscriber after the updater already applied.
  }
  if (didApply) {
    context.draftCoordinator.commitPrepared(snapshot.snapshotKey);
  } else {
    context.draftCoordinator.cancelPrepared(snapshot.snapshotKey);
  }
}

/** Retries the exact immutable snapshot named by the current issue. */
export async function retryDraftPersistenceAction(
  context: StoreContext,
): Promise<void> {
  const editor = getCurrentEditor(context);
  const snapshotKey = editor?.persistenceIssue?.snapshotKey;
  if (editor === undefined || snapshotKey === undefined) {
    return;
  }
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId !== undefined) {
    context.draftCoordinator.bindSessionCluster(editor.sessionKey, clusterId);
  }
  if (editor.lastSnapshotKey === snapshotKey) {
    await context.draftCoordinator.retrySnapshot(snapshotKey);
  }
}

function applyPreparedPublication(
  command: PublicationCommand,
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
): PublicationResult {
  let didApply = false;
  let subscriberThrew = false;
  try {
    context.set((state) => {
      if (!stateOwnsEditor(state, editor)) {
        return state;
      }
      didApply = true;
      return readyEditorPatch({
        ...editor,
        currentMarkdown: command.markdown,
        draftDisposition: snapshot.disposition,
        lastSnapshotKey: snapshot.snapshotKey,
        persistenceIssue: getAdmissionIssue(snapshot, editor, context),
        revision: snapshot.revision,
        saveStatus: getNextSaveStatus(editor),
      });
    });
  } catch {
    subscriberThrew = didApply;
  }
  if (!didApply) {
    context.draftCoordinator.cancelPrepared(snapshot.snapshotKey);
    return rejectedPublication(
      command,
      snapshot.revision,
      editor.draftDisposition,
      "state_update_failed",
    );
  }
  context.draftCoordinator.commitPrepared(snapshot.snapshotKey);
  return {
    completion: subscriberThrew ? "subscriber_threw_after_apply" : "normal",
    disposition: snapshot.disposition,
    editorMode: snapshot.editorMode,
    markdown: snapshot.markdown,
    origin: command.origin,
    persistenceIssue: getExactEditor(editor.sessionKey, context)
      ?.persistenceIssue,
    resolution: command.resolution,
    revision: snapshot.revision,
    sessionKey: editor.sessionKey,
    snapshotKey: snapshot.snapshotKey,
    stateEffect: "revision_applied",
    status: "acknowledged",
    trigger: command.trigger,
  };
}

function createAuthoritySnapshot(
  markdown: string,
  editor: EditorSession,
  context: StoreContext,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  const contentDirty = hasMarkdownDifference(markdown, editor.savedMarkdown);
  return {
    baseContentHash: editor.baseContentHash,
    cause: "accepted_change",
    clusterId: getReadyClusterId(context.get().clusterIdentity),
    contentDirty,
    disposition: getNextDisposition(editor.draftDisposition, contentDirty),
    draftEpoch: editor.draftEpoch,
    editorMode: editor.editorMode,
    markdown,
    noteId: editor.note.id,
    revision,
    sessionKey: editor.sessionKey,
    snapshotKey: context.nextSnapshotKey(editor.sessionKey, revision),
  };
}

function createModeSnapshot(
  editorMode: EditorMode,
  editor: EditorSession,
  context: StoreContext,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  return {
    baseContentHash: editor.baseContentHash,
    cause: "mode_change",
    clusterId: getReadyClusterId(context.get().clusterIdentity),
    contentDirty: hasMarkdownDifference(
      editor.currentMarkdown,
      editor.savedMarkdown,
    ),
    disposition: editor.draftDisposition,
    draftEpoch: editor.draftEpoch,
    editorMode,
    markdown: editor.currentMarkdown,
    noteId: editor.note.id,
    revision,
    sessionKey: editor.sessionKey,
    snapshotKey: context.nextSnapshotKey(editor.sessionKey, revision),
  };
}

function applySnapshotSettlement(
  snapshot: DraftMutationSnapshot,
  result: DraftSnapshotResult,
  context: StoreContext,
): void {
  context.set((state) => {
    const editor = getStateEditor(state);
    if (!editorOwnsSnapshot(editor, snapshot)) {
      return state;
    }
    const patch = getSettlementPatch(editor, snapshot, result);
    return patch === undefined
      ? state
      : readyEditorPatch({ ...editor, ...patch });
  });
}

function getSettlementPatch(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  result: DraftSnapshotResult,
): Partial<EditorSession> | undefined {
  if (result.status === "superseded" || result.status === "record_protected") {
    return undefined;
  }
  if (result.status === "written") {
    return {
      draftDisposition:
        editor.draftDisposition === "generated_pending"
          ? "generated_durable"
          : editor.draftDisposition,
      durableSnapshotKey: snapshot.snapshotKey,
      persistenceIssue: undefined,
    };
  }
  if (result.status === "preserved_unknown") {
    return {
      draftDisposition: "preserved_unknown",
      persistenceIssue: undefined,
      preservedSchemaVersion: result.schemaVersion,
    };
  }
  if (result.status === "unavailable") {
    return {
      persistenceIssue: createDraftPersistenceIssue({
        clusterId: snapshot.clusterId,
        draftEpoch: snapshot.draftEpoch,
        failure: { reason: result.reason, source: "persistence" },
        noteId: snapshot.noteId,
        operation:
          snapshot.cause === "mode_change" ? "mode_write" : "content_write",
        ownerKey: snapshot.sessionKey,
        retryAction: "retry_draft_persistence",
        revision: snapshot.revision,
        sessionKey: snapshot.sessionKey,
        snapshotKey: snapshot.snapshotKey,
      }),
    };
  }
  if (result.outcome === "no_record" || result.outcome.status !== "not_matching") {
    return {
      draftDisposition: "none",
      durableSnapshotKey: undefined,
      persistenceIssue: undefined,
    };
  }
  return undefined;
}

function getAdmissionIssue(
  snapshot: DraftMutationSnapshot,
  editor: EditorSession,
  context: StoreContext,
) {
  if (snapshot.disposition === "recovery_read_unavailable") {
    const issue = editor.persistenceIssue;
    return issue === undefined ? undefined : { ...issue, retryAction: undefined };
  }
  if (snapshot.disposition === "preserved_unknown") {
    return undefined;
  }
  const identity = context.get().clusterIdentity;
  if (snapshot.clusterId !== undefined || identity?.status !== "unavailable") {
    return undefined;
  }
  return createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: snapshot.draftEpoch,
    failure: { reason: identity.reason, source: "cluster_identity" },
    noteId: snapshot.noteId,
    operation: snapshot.cause === "mode_change" ? "mode_write" : "content_write",
    ownerKey: snapshot.sessionKey,
    retryAction: "retry_draft_persistence",
    revision: snapshot.revision,
    sessionKey: snapshot.sessionKey,
    snapshotKey: snapshot.snapshotKey,
  });
}

function getNextDisposition(
  disposition: DraftDisposition,
  contentDirty: boolean,
): DraftDisposition {
  if (
    disposition === "recovered" ||
    disposition === "conflict" ||
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  ) {
    return disposition;
  }
  return contentDirty ? "generated_pending" : disposition;
}

function shouldPersistMode(disposition: DraftDisposition): boolean {
  return [
    "generated_pending",
    "generated_durable",
    "recovered",
    "conflict",
  ].includes(disposition);
}

function patchModeOnly(
  editor: EditorSession,
  editorMode: EditorMode,
  context: StoreContext,
): void {
  context.set((state) =>
    stateOwnsEditor(state, editor)
      ? readyEditorPatch({ ...editor, editorMode, revision: editor.revision + 1 })
      : state,
  );
}

function noChangePublication(
  command: PublicationCommand,
  editor: EditorSession,
  reason: "authority_unchanged" | "retry_reverted",
): PublicationResult {
  return {
    disposition: editor.draftDisposition,
    origin: command.origin,
    reason,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    stateEffect: "none",
    status: "no_change",
    trigger: command.trigger,
  };
}

function rejectedPublication(
  command: PublicationCommand,
  attemptedRevision: number,
  disposition: DraftDisposition,
  reason: Extract<PublicationResult, { status: "rejected" }>["reason"],
): PublicationResult {
  return {
    attemptedMarkdown: command.markdown,
    attemptedRevision,
    disposition,
    origin: command.origin,
    reason,
    sessionKey: command.sessionKey,
    stateEffect: "none",
    status: "rejected",
    trigger: command.trigger,
  };
}

function getNextSaveStatus(editor: EditorSession): EditorSession["saveStatus"] {
  return editor.saveStatus === "conflict" || editor.saveStatus === "saving"
    ? editor.saveStatus
    : "idle";
}

function isCurrentSnapshot(
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
): boolean {
  const editor = getExactEditor(snapshot.sessionKey, context);
  return (
    editor !== undefined &&
    editor.draftEpoch === snapshot.draftEpoch &&
    editor.revision <= snapshot.revision
  );
}

function editorOwnsSnapshot(
  editor: EditorSession | undefined,
  snapshot: DraftMutationSnapshot,
): editor is EditorSession {
  return (
    editor?.sessionKey === snapshot.sessionKey &&
    editor.draftEpoch === snapshot.draftEpoch &&
    editor.revision === snapshot.revision &&
    editor.lastSnapshotKey === snapshot.snapshotKey
  );
}
