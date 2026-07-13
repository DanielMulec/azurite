import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftMutationSnapshot } from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  applySnapshotSettlement,
  getSnapshotAdmissionIssue,
} from "./note-browser-draft-settlement.js";
import {
  getCurrentEditor,
  readyEditorPatch,
  stateOwnsEditor,
} from "./note-browser-editor-state.js";
import type { EditorSession } from "./note-browser-types.js";

/** Re-admits a newer edit against the baseline established by a completed Save. */
export async function admitPostSaveDraftSnapshot(
  context: StoreContext,
): Promise<void> {
  const editor = getCurrentEditor(context);
  if (
    editor === undefined ||
    !hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)
  ) {
    return;
  }
  const snapshot = createPostSaveSnapshot(editor, context);
  const prepared = context.draftCoordinator.prepareSnapshot({
    isCurrent: () => isCurrentPostSaveSnapshot(snapshot, context),
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
        draftDisposition: snapshot.disposition,
        lastSnapshotKey: snapshot.snapshotKey,
        persistenceIssue: getSnapshotAdmissionIssue(snapshot, editor, context),
        revision: snapshot.revision,
      });
    });
  } catch {
    // A subscriber may throw after the exact updater already applied.
  }
  if (!didApply) {
    context.draftCoordinator.cancelPrepared(snapshot.snapshotKey);
    return;
  }
  context.draftCoordinator.commitPrepared(snapshot.snapshotKey);
  if (snapshot.clusterId !== undefined) {
    await context.draftCoordinator.flushSnapshot(snapshot.snapshotKey);
  }
}

function createPostSaveSnapshot(
  editor: EditorSession,
  context: StoreContext,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  return {
    baseContentHash: editor.baseContentHash,
    cause: "successful_save_cleanup",
    clusterId: getReadyClusterId(context.get().clusterIdentity),
    contentDirty: true,
    disposition: isProtected(editor.draftDisposition)
      ? editor.draftDisposition
      : "generated_pending",
    draftEpoch: editor.draftEpoch,
    editorMode: editor.editorMode,
    markdown: editor.currentMarkdown,
    noteId: editor.note.id,
    revision,
    sessionKey: editor.sessionKey,
    snapshotKey: context.nextSnapshotKey(editor.sessionKey, revision),
  };
}

function isCurrentPostSaveSnapshot(
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
): boolean {
  const editor = getCurrentEditor(context);
  return (
    editor?.sessionKey === snapshot.sessionKey &&
    editor.draftEpoch === snapshot.draftEpoch &&
    editor.revision <= snapshot.revision
  );
}

function isProtected(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}
