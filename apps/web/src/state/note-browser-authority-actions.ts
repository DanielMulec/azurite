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
import type { StoreContext } from "./note-browser-contracts.js";
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

/** Publishes exact accepted Markdown with synchronous snapshot admission. */
export function publishMarkdownChange(
  command: PublicationCommand,
  context: StoreContext,
): PublicationResult {
  const editor = getExactEditor(command.sessionKey, context);
  if (editor === undefined) {
    return { reason: "stale_session", status: "rejected" };
  }
  return publishEditorMarkdown(command, editor, context);
}

function publishEditorMarkdown(
  command: PublicationCommand,
  editor: EditorSession,
  context: StoreContext,
): PublicationResult {
  if (editor.currentMarkdown === command.markdown) {
    return { status: "accepted" };
  }
  const snapshot = createAuthoritySnapshot(command.markdown, editor, context);
  const prepared = prepareSnapshot(snapshot, context);
  if (prepared.status === "rejected") {
    return { reason: prepared.reason, status: "rejected" };
  }
  return applyPreparedPublication({ command, context, editor, snapshot });
}

/** Updates live mode and persists it only for an already-owned record. */
export function updateEditorModeWithSnapshot(
  editorMode: EditorMode,
  context: StoreContext,
): void {
  const editor = getModeChangeEditor(editorMode, context);
  if (editor === undefined) {
    return;
  }
  if (!shouldPersistDraftMode(editor.draftDisposition)) {
    patchModeOnly(editor, editorMode, context);
    return;
  }
  persistEditorMode(editor, editorMode, context);
}

function getModeChangeEditor(
  editorMode: EditorMode,
  context: StoreContext,
): EditorSession | undefined {
  const editor = getCurrentEditor(context);
  return editor === undefined || editor.editorMode === editorMode
    ? undefined
    : editor;
}

function persistEditorMode(
  editor: EditorSession,
  editorMode: EditorMode,
  context: StoreContext,
): void {
  const snapshot = createModeSnapshot(editorMode, editor, context);
  const prepared = prepareSnapshot(snapshot, context);
  if (prepared.status === "rejected") {
    return;
  }
  const tracker = applyPreparedModeState({
    context,
    editor,
    editorMode,
    snapshot,
  });
  settlePreparedSnapshot(snapshot.snapshotKey, tracker, context);
}

function applyPreparedModeState(input: {
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly editorMode: EditorMode;
  readonly snapshot: DraftMutationSnapshot;
}): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    input.context.set((state) => {
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
          input.context,
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
  context: StoreContext,
): Promise<void> {
  const target = getRetryTarget(context);
  if (target === undefined) {
    return;
  }
  bindReadyCluster(target.editor, context);
  if (target.editor.lastSnapshotKey !== target.snapshotKey) {
    return;
  }
  await retryTargetSnapshot(target, context);
}

type RetryTarget = {
  readonly editor: EditorSession;
  readonly identityBlocked: boolean;
  readonly snapshotKey: string;
};

function getRetryTarget(context: StoreContext): RetryTarget | undefined {
  const editor = getCurrentEditor(context);
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

function bindReadyCluster(editor: EditorSession, context: StoreContext): void {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId !== undefined) {
    context.draftCoordinator.bindSessionCluster(editor.sessionKey, clusterId);
  }
}

async function retryTargetSnapshot(
  target: RetryTarget,
  context: StoreContext,
): Promise<void> {
  if (target.identityBlocked) {
    await context.draftCoordinator.flushSnapshot(target.snapshotKey);
    return;
  }
  await context.draftCoordinator.retrySnapshot(target.snapshotKey);
}

function applyPreparedPublication(input: {
  readonly command: PublicationCommand;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
}): PublicationResult {
  const tracker = applyPublicationState(input);
  if (!tracker.didApply()) {
    input.context.draftCoordinator.cancelPrepared(input.snapshot.snapshotKey);
    return { reason: "state_update_failed", status: "rejected" };
  }
  input.context.draftCoordinator.commitPrepared(input.snapshot.snapshotKey);
  input.context.draftCleanupRetries.delete(input.editor.sessionKey);
  return { status: "accepted" };
}

function applyPublicationState(input: {
  readonly command: PublicationCommand;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly snapshot: DraftMutationSnapshot;
}): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  try {
    input.context.set((state) => {
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
          input.context,
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
  context: StoreContext,
): SnapshotPreparationResult {
  return context.draftCoordinator.prepareSnapshot({
    isCurrent: () => isCurrentSnapshot(snapshot, context),
    onSettled: (settlement) => {
      applySnapshotSettlement(settlement.snapshot, settlement.result, context);
    },
    snapshot,
  });
}

function settlePreparedSnapshot(
  snapshotKey: string,
  tracker: StateApplicationTracker,
  context: StoreContext,
): void {
  if (tracker.didApply()) {
    context.draftCoordinator.commitPrepared(snapshotKey);
    return;
  }
  context.draftCoordinator.cancelPrepared(snapshotKey);
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
    disposition: getNextDraftDisposition(editor.draftDisposition, contentDirty),
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
  context: StoreContext,
): boolean {
  const editor = getExactEditor(snapshot.sessionKey, context);
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
