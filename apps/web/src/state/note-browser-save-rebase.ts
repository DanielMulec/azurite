import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftMutationSnapshot } from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type {
  DraftWorkflowAccess,
  SnapshotKeyAllocator,
} from "./note-browser-draft-runtime.js";
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

type PostSaveWorkflow = DraftWorkflowAccess & {
  readonly allocateSnapshotKey: SnapshotKeyAllocator;
};

/** Re-admits a newer edit against the baseline established by a completed Save. */
export async function admitPostSaveDraftSnapshot(
  workflow: PostSaveWorkflow,
): Promise<void> {
  const admission = preparePostSaveAdmission(workflow);
  if (admission === undefined) {
    return;
  }
  await applyPostSaveAdmission(admission, workflow);
}

type PostSaveAdmission = {
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
};

function preparePostSaveAdmission(
  workflow: PostSaveWorkflow,
): PostSaveAdmission | undefined {
  const editor = getDirtyPostSaveEditor(workflow);
  if (editor === undefined) {
    return undefined;
  }
  const snapshot = createPostSaveSnapshot(editor, workflow);
  const prepared = workflow.coordinator.prepareSnapshot({
    isCurrent: () => isCurrentPostSaveSnapshot(snapshot, workflow),
    onSettled: (settlement) => {
      applySnapshotSettlement(
        settlement.snapshot,
        settlement.result,
        workflow.state,
      );
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
  workflow: PostSaveWorkflow,
): Promise<void> {
  const tracker = applyPostSaveSnapshot(
    admission.editor,
    admission.snapshot,
    workflow,
  );
  if (!settlePostSaveSnapshot(admission.snapshot, tracker, workflow)) {
    return;
  }
  await flushBoundSnapshot(admission.snapshot, workflow);
}

function getDirtyPostSaveEditor(
  workflow: DraftWorkflowAccess,
): EditorSession | undefined {
  const editor = getCurrentEditor(workflow.state);
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
  workflow: DraftWorkflowAccess,
): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    workflow.state.setState((state) => {
      if (!stateOwnsEditor(state, editor)) {
        return state;
      }
      tracker.markApplied();
      return readyEditorPatch({
        ...editor,
        draftDisposition: snapshot.disposition,
        lastSnapshotKey: snapshot.snapshotKey,
        persistenceIssue: getSnapshotAdmissionIssue(
          snapshot,
          editor,
          workflow.state,
        ),
        revision: snapshot.revision,
      });
    });
  } catch {
    // A subscriber may throw after the exact updater already applied.
  }
  return tracker;
}

function settlePostSaveSnapshot(
  snapshot: DraftMutationSnapshot,
  tracker: StateApplicationTracker,
  workflow: DraftWorkflowAccess,
): boolean {
  if (!tracker.didApply()) {
    workflow.coordinator.cancelPrepared(snapshot.snapshotKey);
    return false;
  }
  workflow.coordinator.commitPrepared(snapshot.snapshotKey);
  return true;
}

async function flushBoundSnapshot(
  snapshot: DraftMutationSnapshot,
  workflow: DraftWorkflowAccess,
): Promise<void> {
  if (snapshot.clusterId === undefined) {
    return;
  }
  await workflow.coordinator.flushSnapshot(snapshot.snapshotKey);
}

function createPostSaveSnapshot(
  editor: EditorSession,
  workflow: PostSaveWorkflow,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  return {
    baseContentHash: editor.baseContentHash,
    cause: "successful_save_cleanup",
    clusterId: getReadyClusterId(workflow.state.getState().clusterIdentity),
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
    snapshotKey: workflow.allocateSnapshotKey(editor.sessionKey, revision),
  };
}

function isCurrentPostSaveSnapshot(
  snapshot: DraftMutationSnapshot,
  workflow: DraftWorkflowAccess,
): boolean {
  const editor = getCurrentEditor(workflow.state);
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
