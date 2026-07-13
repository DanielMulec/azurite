import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { DraftMutationSnapshot } from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type {
  StoreContext,
} from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import {
  getCurrentEditor,
  getExactEditor,
  readyEditorPatch,
  stateOwnsEditor,
} from "./note-browser-editor-state.js";
import {
  applySnapshotSettlement,
  getNextDraftDisposition,
  getSnapshotAdmissionIssue,
  shouldPersistDraftMode,
} from "./note-browser-draft-settlement.js";
import {
  createNoChangePublication,
  createRejectedPublication,
} from "./note-browser-publication-results.js";

/** Publishes exact accepted Markdown with synchronous snapshot admission. */
export function publishMarkdownChange(
  command: PublicationCommand,
  context: StoreContext,
): PublicationResult {
  const editor = getExactEditor(command.sessionKey, context);
  if (editor === undefined) {
    return createRejectedPublication(command, 0, "none", "stale_session");
  }
  if (editor.currentMarkdown === command.markdown) {
    return createNoChangePublication(command, editor, "authority_unchanged");
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
    return createRejectedPublication(
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
  if (!shouldPersistDraftMode(editor.draftDisposition)) {
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
        persistenceIssue: getSnapshotAdmissionIssue(snapshot, editor, context),
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
    if (editor.persistenceIssue?.failure.source === "cluster_identity") {
      await context.draftCoordinator.flushSnapshot(snapshotKey);
    } else {
      await context.draftCoordinator.retrySnapshot(snapshotKey);
    }
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
        persistenceIssue: getSnapshotAdmissionIssue(snapshot, editor, context),
        revision: snapshot.revision,
        saveStatus: getNextSaveStatus(editor),
      });
    });
  } catch {
    subscriberThrew = didApply;
  }
  if (!didApply) {
    context.draftCoordinator.cancelPrepared(snapshot.snapshotKey);
    return createRejectedPublication(
      command,
      snapshot.revision,
      editor.draftDisposition,
      "state_update_failed",
    );
  }
  context.draftCoordinator.commitPrepared(snapshot.snapshotKey);
  context.draftCleanupRetries.delete(editor.sessionKey);
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
    disposition: getNextDraftDisposition(
      editor.draftDisposition,
      contentDirty,
    ),
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
