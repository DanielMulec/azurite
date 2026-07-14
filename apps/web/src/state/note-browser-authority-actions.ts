import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DraftMutationSnapshot,
  SnapshotPreparationResult,
} from "../persistence/draft-workflow-types.js";
import {
  getNextAcceptedSaveStatus,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type {
  DraftWorkflowAccess,
  SnapshotKeyAllocator,
} from "./note-browser-draft-runtime.js";
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
import { StateApplicationTracker } from "./note-browser-state-application.js";

type AuthorityWorkflow = DraftWorkflowAccess & {
  readonly allocateSnapshotKey: SnapshotKeyAllocator;
};

/** Publishes exact accepted Markdown with synchronous snapshot admission. */
export function publishMarkdownChange(
  command: PublicationCommand,
  workflow: AuthorityWorkflow,
): PublicationResult {
  const editor = getExactEditor(command.sessionKey, workflow.state);
  if (editor === undefined) {
    return { reason: "stale_session", status: "rejected" };
  }
  return publishEditorMarkdown(command, editor, workflow);
}

function publishEditorMarkdown(
  command: PublicationCommand,
  editor: EditorSession,
  workflow: AuthorityWorkflow,
): PublicationResult {
  if (editor.currentMarkdown === command.markdown) {
    return { status: "accepted" };
  }
  const snapshot = createAuthoritySnapshot(command.markdown, editor, workflow);
  const prepared = prepareSnapshot(snapshot, workflow);
  if (prepared.status === "rejected") {
    return { reason: prepared.reason, status: "rejected" };
  }
  return applyPreparedPublication({ command, editor, snapshot, workflow });
}

/** Updates live mode and persists it only for an already-owned record. */
export function updateEditorModeWithSnapshot(
  editorMode: EditorMode,
  workflow: AuthorityWorkflow,
): void {
  const editor = getModeChangeEditor(editorMode, workflow);
  if (editor === undefined) {
    return;
  }
  if (!shouldPersistDraftMode(editor.draftDisposition)) {
    patchModeOnly(editor, editorMode, workflow);
    return;
  }
  persistEditorMode(editor, editorMode, workflow);
}

function getModeChangeEditor(
  editorMode: EditorMode,
  workflow: AuthorityWorkflow,
): EditorSession | undefined {
  const editor = getCurrentEditor(workflow.state);
  return editor === undefined || editor.editorMode === editorMode
    ? undefined
    : editor;
}

function persistEditorMode(
  editor: EditorSession,
  editorMode: EditorMode,
  workflow: AuthorityWorkflow,
): void {
  const snapshot = createModeSnapshot(editorMode, editor, workflow);
  const prepared = prepareSnapshot(snapshot, workflow);
  if (prepared.status === "rejected") {
    return;
  }
  const tracker = applyPreparedModeState({
    editor,
    editorMode,
    snapshot,
    workflow,
  });
  settlePreparedSnapshot(snapshot.snapshotKey, tracker, workflow);
}

function applyPreparedModeState(input: {
  readonly editor: EditorSession;
  readonly editorMode: EditorMode;
  readonly snapshot: DraftMutationSnapshot;
  readonly workflow: AuthorityWorkflow;
}): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    input.workflow.state.setState((state) => {
      if (!stateOwnsEditor(state, input.editor)) {
        return state;
      }
      tracker.markApplied();
      return readyEditorPatch({
        ...input.editor,
        editorMode: input.editorMode,
        lastSnapshotKey: input.snapshot.snapshotKey,
        persistenceIssue: getSnapshotAdmissionIssue(
          input.snapshot,
          input.editor,
          input.workflow.state,
        ),
        revision: input.snapshot.revision,
      });
    });
  } catch {
    // The applied marker remains authoritative when a subscriber throws.
  }
  return tracker;
}

/** Retries the exact immutable snapshot named by the current issue. */
export async function retryDraftPersistenceAction(
  workflow: DraftWorkflowAccess,
): Promise<void> {
  const target = getRetryTarget(workflow);
  if (target === undefined) {
    return;
  }
  bindReadyCluster(target.editor, workflow);
  if (target.editor.lastSnapshotKey !== target.snapshotKey) {
    return;
  }
  await retryTargetSnapshot(target, workflow);
}

type RetryTarget = {
  readonly editor: EditorSession;
  readonly identityBlocked: boolean;
  readonly snapshotKey: string;
};

function getRetryTarget(
  workflow: DraftWorkflowAccess,
): RetryTarget | undefined {
  const editor = getCurrentEditor(workflow.state);
  return editor === undefined ? undefined : getEditorRetryTarget(editor);
}

function getEditorRetryTarget(editor: EditorSession): RetryTarget | undefined {
  const issue = editor.persistenceIssue;
  if (issue === undefined) {
    return undefined;
  }
  if (issue.snapshotKey === undefined) {
    return undefined;
  }
  return {
    editor,
    identityBlocked: issue.failure.source === "cluster_identity",
    snapshotKey: issue.snapshotKey,
  };
}

function bindReadyCluster(
  editor: EditorSession,
  workflow: DraftWorkflowAccess,
): void {
  const clusterId = getReadyClusterId(
    workflow.state.getState().clusterIdentity,
  );
  if (clusterId !== undefined) {
    workflow.coordinator.bindSessionCluster(editor.sessionKey, clusterId);
  }
}

async function retryTargetSnapshot(
  target: RetryTarget,
  workflow: DraftWorkflowAccess,
): Promise<void> {
  if (target.identityBlocked) {
    await workflow.coordinator.flushSnapshot(target.snapshotKey);
    return;
  }
  await workflow.coordinator.retrySnapshot(target.snapshotKey);
}

function applyPreparedPublication(input: {
  readonly command: PublicationCommand;
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
  readonly workflow: AuthorityWorkflow;
}): PublicationResult {
  const tracker = applyPublicationState(input);
  if (!tracker.didApply()) {
    input.workflow.coordinator.cancelPrepared(input.snapshot.snapshotKey);
    return { reason: "state_update_failed", status: "rejected" };
  }
  input.workflow.coordinator.commitPrepared(input.snapshot.snapshotKey);
  input.workflow.cleanupRetries.delete(input.editor.sessionKey);
  return { status: "accepted" };
}

function applyPublicationState(input: {
  readonly command: PublicationCommand;
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
  readonly workflow: AuthorityWorkflow;
}): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    input.workflow.state.setState((state) => {
      if (!stateOwnsEditor(state, input.editor)) {
        return state;
      }
      tracker.markApplied();
      return readyEditorPatch({
        ...input.editor,
        currentMarkdown: input.command.markdown,
        draftDisposition: input.snapshot.disposition,
        lastSnapshotKey: input.snapshot.snapshotKey,
        persistenceIssue: getSnapshotAdmissionIssue(
          input.snapshot,
          input.editor,
          input.workflow.state,
        ),
        revision: input.snapshot.revision,
        saveStatus: getNextAcceptedSaveStatus(input.editor),
      });
    });
  } catch {
    // The applied marker remains authoritative when a subscriber throws.
  }
  return tracker;
}

function prepareSnapshot(
  snapshot: DraftMutationSnapshot,
  workflow: DraftWorkflowAccess,
): SnapshotPreparationResult {
  return workflow.coordinator.prepareSnapshot({
    isCurrent: () => isCurrentSnapshot(snapshot, workflow),
    onSettled: (settlement) => {
      applySnapshotSettlement(
        settlement.snapshot,
        settlement.result,
        workflow.state,
      );
    },
    snapshot,
  });
}

function settlePreparedSnapshot(
  snapshotKey: string,
  tracker: StateApplicationTracker,
  workflow: DraftWorkflowAccess,
): void {
  if (tracker.didApply()) {
    workflow.coordinator.commitPrepared(snapshotKey);
    return;
  }
  workflow.coordinator.cancelPrepared(snapshotKey);
}

function createAuthoritySnapshot(
  markdown: string,
  editor: EditorSession,
  workflow: AuthorityWorkflow,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  const contentDirty = hasMarkdownDifference(markdown, editor.savedMarkdown);
  return {
    baseContentHash: editor.baseContentHash,
    cause: "accepted_change",
    clusterId: getReadyClusterId(workflow.state.getState().clusterIdentity),
    contentDirty,
    disposition: getNextDraftDisposition(editor.draftDisposition, contentDirty),
    draftEpoch: editor.draftEpoch,
    editorMode: editor.editorMode,
    markdown,
    noteId: editor.note.id,
    revision,
    sessionKey: editor.sessionKey,
    snapshotKey: workflow.allocateSnapshotKey(editor.sessionKey, revision),
  };
}

function createModeSnapshot(
  editorMode: EditorMode,
  editor: EditorSession,
  workflow: AuthorityWorkflow,
): DraftMutationSnapshot {
  const revision = editor.revision + 1;
  return {
    baseContentHash: editor.baseContentHash,
    cause: "mode_change",
    clusterId: getReadyClusterId(workflow.state.getState().clusterIdentity),
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
    snapshotKey: workflow.allocateSnapshotKey(editor.sessionKey, revision),
  };
}

function patchModeOnly(
  editor: EditorSession,
  editorMode: EditorMode,
  workflow: DraftWorkflowAccess,
): void {
  workflow.state.setState((state) =>
    stateOwnsEditor(state, editor)
      ? readyEditorPatch({
          ...editor,
          editorMode,
          revision: editor.revision + 1,
        })
      : state,
  );
}

function isCurrentSnapshot(
  snapshot: DraftMutationSnapshot,
  workflow: DraftWorkflowAccess,
): boolean {
  const editor = getExactEditor(snapshot.sessionKey, workflow.state);
  return editor !== undefined && editorCanOwnSnapshot(editor, snapshot);
}

function editorCanOwnSnapshot(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): boolean {
  return (
    editor.draftEpoch === snapshot.draftEpoch &&
    editor.revision <= snapshot.revision
  );
}
