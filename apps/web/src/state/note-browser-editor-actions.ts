import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { DraftRecordMutationResult } from "../persistence/draft-database.js";
import {
  canSaveEditor,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import {
  createBrowserOperationEvidence,
  recordSaveResult,
  runBrowserOperation,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";
import { createNoteRequestMetadata } from "./note-operation-metadata.js";
import { flushEditorDurability } from "./note-browser-durability-actions.js";
import { reloadSelectedNoteAction } from "./note-browser-route-actions.js";
import { applyMissingRoute } from "./note-browser-route-state.js";
import {
  applySaveFailure,
  applySaveResponse,
} from "./note-browser-save-results.js";

/** Saves the selected note through the existing content-hash contract. */
export function saveSelectedNoteAction(context: StoreContext): Promise<void> {
  const activePromise = getActiveSavePromise(context);
  if (activePromise !== undefined) {
    return activePromise;
  }
  const editor = getSaveableEditor(context);
  if (editor === undefined) {
    return Promise.resolve();
  }
  const metadata = createNoteRequestMetadata();
  const evidence = createBrowserOperationEvidence({
    expectedContentHash: editor.baseContentHash,
    metadata,
    noteId: editor.note.id,
  });
  markEditorSaving(editor, context);
  const promise = runBrowserOperation({
    callback: () => saveEditor(editor, evidence, context),
    evidence,
    eventName: runtimeObservabilityEventNames.noteSaveStarted,
    spanName: runtimeSpanNames.noteSave,
    startAttributes: {
      [runtimeObservabilityAttributeNames.expectedContentHash]:
        editor.baseContentHash,
    },
  }).finally(() => {
    context.clearActiveNoteSave(editor.note.id, promise);
  });
  context.setActiveNoteSave(editor.note.id, { editor, metadata, promise });
  return promise;
}

/** Deletes a compatible recovered draft before reloading its disk version. */
export async function discardDraftAndReloadDiskVersionAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;
  if (noteState.status === "missing-draft") {
    await discardMissingNoteDraftState(noteState, context);
    return;
  }
  if (
    noteState.status !== "ready" ||
    !isDiscardable(noteState.editor.draftDisposition)
  ) {
    return;
  }
  const editor = noteState.editor;
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    restoreFailedEditorDiscard(editor, clusterIdentityFailure(context), context);
    return;
  }
  const result = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: editor.draftEpoch,
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
  });
  if (isDeletionComplete(result)) {
    await reloadSelectedNoteAction(context);
    return;
  }
  restoreEditorAfterDiscardResult(editor, result, context);
}

/** Deletes a compatible recovered draft for a note missing from disk. */
export async function discardMissingDraftAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;
  if (noteState.status === "missing-draft") {
    await discardMissingNoteDraftState(noteState, context);
  }
}

async function saveEditor(
  editor: EditorSession,
  evidence: BrowserOperationEvidence,
  context: StoreContext,
): Promise<void> {
  try {
    const response = await context.api.saveNote(
      {
        expectedContentHash: editor.baseContentHash,
        markdown: editor.currentMarkdown,
        noteId: editor.note.id,
      },
      evidence.metadata,
    );
    await applySaveResponse({
      clusterIdentity: response.clusterIdentity,
      context,
      editor,
      note: response.note,
    });
    recordSaveResult(evidence, {
      clusterIdentity: response.clusterIdentity,
      contentHash: response.note.contentHash,
    });
  } catch (error) {
    await flushEditorDurability("explicit_flush", context);
    applySaveFailure({ context, editor, error });
    recordSaveResult(evidence, { error });
  }
}

async function discardMissingNoteDraftState(
  noteState: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "missing-draft" }
  >,
  context: StoreContext,
): Promise<void> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    restoreFailedMissingDiscard(noteState, clusterIdentityFailure(context), context);
    return;
  }
  const result = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: noteState.draftEpoch,
    noteId: noteState.noteId,
    ownerKey: noteState.renderedOwnerKey,
  });
  if (isDeletionComplete(result)) {
    applyMissingAfterDiscard(noteState.noteId, context);
    return;
  }
  restoreMissingAfterDiscardResult(noteState, result, context);
}

function applyMissingAfterDiscard(noteId: string, context: StoreContext): void {
  const location = context.get().committedRouteView?.location;
  if (location === undefined) {
    context.set({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute({ location, noteId }, context);
}

function restoreEditorAfterDiscardResult(
  editor: EditorSession,
  result: DraftRecordMutationResult,
  context: StoreContext,
): void {
  if (result.status === "preserved_unknown") {
    context.set((state) =>
      state.noteState.status === "ready" &&
      state.noteState.editor.sessionKey === editor.sessionKey
        ? {
            noteState: {
              editor: {
                ...state.noteState.editor,
                draftDisposition: "preserved_unknown",
                draftEpoch: editor.draftEpoch + 1,
                persistenceIssue: undefined,
                preservedSchemaVersion: result.schemaVersion,
              },
              status: "ready",
            },
          }
        : state,
    );
    return;
  }
  const failure = getMutationFailure(result);
  if (failure !== undefined) {
    restoreFailedEditorDiscard(editor, failure, context);
  }
}

function restoreFailedEditorDiscard(
  editor: EditorSession,
  failure: Parameters<typeof createDraftPersistenceIssue>[0]["failure"],
  context: StoreContext,
): void {
  const restoredEpoch = editor.draftEpoch + 1;
  context.set((state) =>
    state.noteState.status === "ready" &&
    state.noteState.editor.sessionKey === editor.sessionKey
      ? {
          noteState: {
            editor: {
              ...state.noteState.editor,
              draftEpoch: restoredEpoch,
              persistenceIssue: createDiscardIssue(
                editor.sessionKey,
                editor.note.id,
                restoredEpoch,
                failure,
              ),
            },
            status: "ready",
          },
        }
      : state,
  );
}

function restoreMissingAfterDiscardResult(
  noteState: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "missing-draft" }
  >,
  result: DraftRecordMutationResult,
  context: StoreContext,
): void {
  const failure = getMutationFailure(result);
  if (failure !== undefined) {
    restoreFailedMissingDiscard(noteState, failure, context);
  }
}

function restoreFailedMissingDiscard(
  noteState: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "missing-draft" }
  >,
  failure: Parameters<typeof createDraftPersistenceIssue>[0]["failure"],
  context: StoreContext,
): void {
  const restoredEpoch = noteState.draftEpoch + 1;
  context.set((state) =>
    state.noteState.status === "missing-draft" &&
    state.noteState.renderedOwnerKey === noteState.renderedOwnerKey
      ? {
          noteState: {
            ...state.noteState,
            draftEpoch: restoredEpoch,
            persistenceIssue: createDiscardIssue(
              noteState.renderedOwnerKey,
              noteState.noteId,
              restoredEpoch,
              failure,
            ),
          },
        }
      : state,
  );
}

function createDiscardIssue(
  ownerKey: string,
  noteId: string,
  draftEpoch: number,
  failure: Parameters<typeof createDraftPersistenceIssue>[0]["failure"],
) {
  return createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch,
    failure,
    noteId,
    operation: "discard",
    ownerKey,
    retryAction: "retry_discard",
  });
}

function getMutationFailure(
  result: DraftRecordMutationResult,
): Parameters<typeof createDraftPersistenceIssue>[0]["failure"] | undefined {
  if (result.status === "unavailable") {
    return { reason: result.reason, source: "persistence" };
  }
  return result.status === "not_matching"
    ? { reason: "queue_task_failed", source: "coordinator" }
    : undefined;
}

function clusterIdentityFailure(
  context: StoreContext,
): Parameters<typeof createDraftPersistenceIssue>[0]["failure"] {
  const identity = context.get().clusterIdentity;
  return {
    reason:
      identity?.status === "unavailable"
        ? identity.reason
        : "metadata_unavailable",
    source: "cluster_identity",
  };
}

function isDeletionComplete(result: DraftRecordMutationResult): boolean {
  return (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  );
}

function isDiscardable(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return disposition === "recovered" || disposition === "conflict";
}

function getActiveSavePromise(
  context: StoreContext,
): Promise<void> | undefined {
  const noteState = context.get().noteState;
  return noteState.status === "ready"
    ? context.getActiveNoteSave(noteState.editor.note.id)?.promise
    : undefined;
}

function getSaveableEditor(context: StoreContext): EditorSession | undefined {
  const noteState = context.get().noteState;
  return noteState.status === "ready" && canSaveEditor(noteState.editor)
    ? noteState.editor
    : undefined;
}

function markEditorSaving(editor: EditorSession, context: StoreContext): void {
  context.set({
    noteState: {
      editor: { ...editor, saveStatus: "saving" },
      status: "ready",
    },
  });
}
