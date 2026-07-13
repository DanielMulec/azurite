import type { ClusterIdentity, NoteContentWithHash } from "@azurite/shared";

import type { DraftRecordMutationResult } from "../persistence/draft-database.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import {
  applyClusterIdentity,
  getCurrentEditorForSession,
  getReadyClusterId,
  isNoteWriteConflictError,
  isSameSaveSnapshot,
  patchSavedNoteSummary,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import { admitPostSaveDraftSnapshot } from "./note-browser-save-rebase.js";

type SaveResponseInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly note: NoteContentWithHash;
};

/** Applies a successful Save in place without overwriting newer editor truth. */
export async function applySaveResponse(
  input: SaveResponseInput,
): Promise<void> {
  const reconciliation = await reconcileSavedDraft(input);
  const currentEditor = getCurrentEditorForSession(input.editor, input.context);
  if (currentEditor === undefined) {
    return;
  }
  applyClusterIdentity(input.clusterIdentity, input.context);
  input.context.draftCoordinator.cancelSessionRevision(
    input.editor.sessionKey,
    input.editor.revision,
  );
  const hadNewerEdit = !isSameSaveSnapshot(currentEditor, input.editor);
  applySuccessfulSave(input, reconciliation);
  if (hadNewerEdit) {
    await admitPostSaveDraftSnapshot(input.context);
  }
}

/** Applies a failed Save to the latest exact session without restoring text. */
export function applySaveFailure(input: {
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly error: unknown;
}): void {
  const currentEditor = getCurrentEditorForSession(input.editor, input.context);
  if (currentEditor === undefined) {
    return;
  }
  input.context.set({
    noteState: {
      editor: isNoteWriteConflictError(input.error)
        ? {
            ...currentEditor,
            draftDisposition: "conflict",
            saveStatus: "conflict",
          }
        : { ...currentEditor, saveStatus: "failed" },
      status: "ready",
    },
  });
}

function applySuccessfulSave(
  input: SaveResponseInput,
  reconciliation: DraftRecordMutationResult | undefined,
): void {
  input.context.set((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.sessionKey !== input.editor.sessionKey
    ) {
      return state;
    }
    const editor = state.noteState.editor;
    const sameSnapshot = isSameSaveSnapshot(editor, input.editor);
    const draftPatch = getSaveDraftPatch(
      editor,
      input.clusterIdentity,
      reconciliation,
      sameSnapshot,
    );
    return {
      noteState: {
        editor: {
          ...editor,
          ...draftPatch,
          baseContentHash: input.note.contentHash,
          note: input.note,
          savedMarkdown: input.note.markdown,
          saveStatus: "idle",
        },
        status: "ready",
      },
      notesState: patchSavedNoteSummary(state.notesState, input.note),
    };
  });
}

function getSaveDraftPatch(
  editor: EditorSession,
  clusterIdentity: ClusterIdentity,
  result: DraftRecordMutationResult | undefined,
  sameSnapshot: boolean,
): Partial<EditorSession> {
  if (isProtectedDisposition(editor.draftDisposition)) {
    return {
      lastSnapshotKey: sameSnapshot ? undefined : editor.lastSnapshotKey,
      persistenceIssue: getProtectedSaveIssue(editor),
    };
  }
  if (!sameSnapshot) {
    return getNewerEditPatch(editor, result);
  }
  if (result === undefined) {
    return getUntargetedCleanupPatch(editor, clusterIdentity);
  }
  return getExactCleanupPatch(
    editor,
    result,
    getReadyClusterId(clusterIdentity),
  );
}

function getExactCleanupPatch(
  editor: EditorSession,
  result: DraftRecordMutationResult,
  clusterId: string | undefined,
): Partial<EditorSession> {
  if (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  ) {
    return resolvedDraftPatch;
  }
  if (result.status === "preserved_unknown") {
    return {
      draftDisposition: "preserved_unknown",
      durableSnapshotKey: undefined,
      lastSnapshotKey: undefined,
      persistenceIssue: undefined,
      preservedSchemaVersion: result.schemaVersion,
    };
  }
  if (result.status === "not_matching") {
    return { persistenceIssue: undefined };
  }
  return createCleanupFailurePatch(
    editor,
    { reason: result.reason, source: "persistence" },
    clusterId,
  );
}

function getUntargetedCleanupPatch(
  editor: EditorSession,
  clusterIdentity: ClusterIdentity,
): Partial<EditorSession> {
  if (editor.draftDisposition === "none") {
    return resolvedDraftPatch;
  }
  if (clusterIdentity.status === "unavailable") {
    return createCleanupFailurePatch(
      editor,
      { reason: clusterIdentity.reason, source: "cluster_identity" },
      undefined,
    );
  }
  return { persistenceIssue: undefined };
}

function getNewerEditPatch(
  editor: EditorSession,
  result: DraftRecordMutationResult | undefined,
): Partial<EditorSession> {
  if (result?.status === "preserved_unknown") {
    return {
      draftDisposition: "preserved_unknown",
      preservedSchemaVersion: result.schemaVersion,
    };
  }
  return { persistenceIssue: editor.persistenceIssue };
}

function createCleanupFailurePatch(
  editor: EditorSession,
  failure: Parameters<typeof createDraftPersistenceIssue>[0]["failure"],
  clusterId: string | undefined,
): Partial<EditorSession> {
  return {
    draftDisposition: "cleanup_required",
    persistenceIssue: createDraftPersistenceIssue({
      clusterId,
      draftEpoch: editor.draftEpoch,
      failure,
      noteId: editor.note.id,
      operation: "cleanup",
      ownerKey: editor.sessionKey,
      retryAction: "retry_draft_cleanup",
      revision: editor.revision,
      sessionKey: editor.sessionKey,
      snapshotKey: editor.lastSnapshotKey,
    }),
  };
}

async function reconcileSavedDraft(
  input: SaveResponseInput,
): Promise<DraftRecordMutationResult | undefined> {
  if (isProtectedDisposition(input.editor.draftDisposition)) {
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
    return undefined;
  }
  if (input.editor.draftDisposition === "none") {
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
    return undefined;
  }
  const snapshot = {
    baseContentHash: input.editor.baseContentHash,
    markdown: input.editor.currentMarkdown,
    noteId: input.editor.note.id,
  };
  input.context.draftCleanupRetries.remember(input.editor.sessionKey, snapshot);
  const clusterId = getReadyClusterId(input.clusterIdentity);
  if (clusterId === undefined) {
    return undefined;
  }
  const result = await input.context.draftCoordinator.cleanupSavedSnapshot({
    clusterId,
    ...snapshot,
  });
  if (result.status !== "unavailable") {
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
  }
  return result;
}

function getProtectedSaveIssue(
  editor: EditorSession,
): EditorSession["persistenceIssue"] {
  if (editor.draftDisposition !== "recovery_read_unavailable") {
    return undefined;
  }
  const issue = editor.persistenceIssue;
  return issue === undefined
    ? undefined
    : { ...issue, retryAction: "retry_browser_recovery" };
}

function isProtectedDisposition(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}

const resolvedDraftPatch: Partial<EditorSession> = Object.freeze({
  draftDisposition: "none",
  durableSnapshotKey: undefined,
  lastSnapshotKey: undefined,
  persistenceIssue: undefined,
  preservedSchemaVersion: undefined,
});
