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
import { StateApplicationTracker } from "./note-browser-state-application.js";
import type { EditorSession } from "./note-browser-types.js";

/** Re-admits a newer edit against the baseline established by a completed Save. */
export async function admitPostSaveDraftSnapshot(
  context: StoreContext,
): Promise<void> {
  const admission = preparePostSaveAdmission(context);
  if (admission === undefined) {
    return;
  }
  await applyPostSaveAdmission(admission, context);
}

type PostSaveAdmission = {
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
};

function preparePostSaveAdmission(
  context: StoreContext,
): PostSaveAdmission | undefined {
  const editor = getDirtyPostSaveEditor(context);
  if (editor === undefined) {
    return undefined;
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
    return undefined;
  }
  return { editor, snapshot };
}

async function applyPostSaveAdmission(
  admission: PostSaveAdmission,
  context: StoreContext,
): Promise<void> {
  const tracker = applyPostSaveSnapshot(
    admission.editor,
    admission.snapshot,
    context,
  );
  if (!settlePostSaveSnapshot(admission.snapshot, tracker, context)) {
    return;
  }
  await flushBoundSnapshot(admission.snapshot, context);
}

function getDirtyPostSaveEditor(
  context: StoreContext,
): EditorSession | undefined {
  const editor = getCurrentEditor(context);
  if (editor === undefined) {
    return undefined;
  }
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)
    ? editor
    : undefined;
}

function applyPostSaveSnapshot(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    context.set((state) => {
      if (!stateOwnsEditor(state, editor)) {
        return state;
      }
      tracker.markApplied();
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
    tracker.recordSubscriberThrow();
  }
  return tracker;
}

function settlePostSaveSnapshot(
  snapshot: DraftMutationSnapshot,
  tracker: StateApplicationTracker,
  context: StoreContext,
): boolean {
  if (!tracker.didApply()) {
    context.draftCoordinator.cancelPrepared(snapshot.snapshotKey);
    return false;
  }
  context.draftCoordinator.commitPrepared(snapshot.snapshotKey);
  return true;
}

async function flushBoundSnapshot(
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
): Promise<void> {
  if (snapshot.clusterId === undefined) {
    return;
  }
  await context.draftCoordinator.flushSnapshot(snapshot.snapshotKey);
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
  if (editor === undefined) {
    return false;
  }
  return ownsPostSaveSnapshot(editor, snapshot);
}

function ownsPostSaveSnapshot(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): boolean {
  return (
    editor.sessionKey === snapshot.sessionKey &&
    editor.draftEpoch === snapshot.draftEpoch &&
    editor.revision <= snapshot.revision
  );
}

function isProtected(disposition: EditorSession["draftDisposition"]): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}
