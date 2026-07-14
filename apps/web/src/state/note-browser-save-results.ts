import type { ClusterIdentity, NoteContentWithHash } from "@azurite/shared";

import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
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
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
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
  reconciliation: CoordinatedDraftMutationResult | undefined,
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
    const draftPatch = getSaveDraftPatch({
      clusterIdentity: input.clusterIdentity,
      editor,
      result: reconciliation,
      sameSnapshot,
    });
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

type SaveDraftPatchInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly editor: EditorSession;
  readonly result: CoordinatedDraftMutationResult | undefined;
  readonly sameSnapshot: boolean;
};

function getSaveDraftPatch(input: SaveDraftPatchInput): Partial<EditorSession> {
  if (isProtectedDisposition(input.editor.draftDisposition)) {
    return getProtectedSaveDraftPatch(input);
  }
  return getCompatibleSaveDraftPatch(input);
}

function getProtectedSaveDraftPatch(
  input: SaveDraftPatchInput,
): Partial<EditorSession> {
  return {
    lastSnapshotKey: input.sameSnapshot
      ? undefined
      : input.editor.lastSnapshotKey,
    persistenceIssue: getProtectedSaveIssue(input.editor),
  };
}

function getCompatibleSaveDraftPatch(
  input: SaveDraftPatchInput,
): Partial<EditorSession> {
  if (!input.sameSnapshot) {
    return getNewerEditPatch(input.editor, input.result);
  }
  if (input.result === undefined) {
    return getUntargetedCleanupPatch(input.editor, input.clusterIdentity);
  }
  return getExactCleanupPatch(
    input.editor,
    input.result,
    getReadyClusterId(input.clusterIdentity),
  );
}

function getExactCleanupPatch(
  editor: EditorSession,
  result: CoordinatedDraftMutationResult,
  clusterId: string | undefined,
): Partial<EditorSession> {
  if (isSaveCleanupComplete(result)) {
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
  return getUnresolvedSaveCleanupPatch(editor, result, clusterId);
}

function getUnresolvedSaveCleanupPatch(
  editor: EditorSession,
  result: Exclude<
    CoordinatedDraftMutationResult,
    {
      readonly status:
        "absent" | "deleted" | "invalid_deleted" | "preserved_unknown";
    }
  >,
  clusterId: string | undefined,
): Partial<EditorSession> {
  if (result.status === "not_matching") {
    return { persistenceIssue: undefined };
  }
  if (result.status === "queue_failed") {
    return createCleanupFailurePatch(
      editor,
      { reason: result.reason, source: "coordinator" },
      clusterId,
    );
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
  result: CoordinatedDraftMutationResult | undefined,
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
): Promise<CoordinatedDraftMutationResult | undefined> {
  if (doesNotNeedSaveCleanup.has(input.editor.draftDisposition)) {
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
    return undefined;
  }
  return await reconcileCompatibleSavedDraft(input);
}

async function reconcileCompatibleSavedDraft(
  input: SaveResponseInput,
): Promise<CoordinatedDraftMutationResult | undefined> {
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
  if (isTerminalSaveCleanup(result)) {
    input.context.draftCleanupRetries.delete(input.editor.sessionKey);
  }
  return result;
}

function isSaveCleanupComplete(
  result: CoordinatedDraftMutationResult,
): result is Extract<
  CoordinatedDraftMutationResult,
  { readonly status: "absent" | "deleted" | "invalid_deleted" }
> {
  return (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  );
}

function isTerminalSaveCleanup(
  result: CoordinatedDraftMutationResult,
): boolean {
  return terminalSaveCleanupStatuses.has(result.status);
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

const doesNotNeedSaveCleanup = new Set<EditorSession["draftDisposition"]>([
  "none",
  "preserved_unknown",
  "recovery_read_unavailable",
]);

const terminalSaveCleanupStatuses = new Set<
  CoordinatedDraftMutationResult["status"]
>([
  "absent",
  "deleted",
  "invalid_deleted",
  "not_matching",
  "preserved_unknown",
]);
