import {
  noteRouteSources,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import type { DraftWriteResult } from "../persistence/draft-database.js";
import { createDraftRecord } from "../persistence/draft-records.js";
import {
  canSaveEditor,
  degradeDraftRecovery,
  getReadyClusterId,
  hasEditorPatchChange,
  hasDirtyMarkdown,
} from "./note-browser-action-utils.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import {
  createBrowserOperationEvidence,
  recordSaveResult,
  runBrowserOperation,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";
import { createNoteRequestMetadata } from "./note-operation-metadata.js";
import { selectNoteAction } from "./note-browser-route-actions.js";
import {
  applySaveFailure,
  applySaveResponse,
} from "./note-browser-save-results.js";

type DraftTarget = {
  readonly clusterId: string;
  readonly editor: EditorSession;
};

/** Applies editor markdown or mode changes to the current ready session. */
export function updateCurrentEditor(
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
  context: Pick<StoreContext, "set">,
): void {
  context.set((state) => patchCurrentEditorState(state, patch));
}

function patchCurrentEditorState(
  state: NoteBrowserStore,
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
) {
  if (state.noteState.status !== "ready") {
    return state;
  }

  return createReadyEditorStatePatch(state.noteState.editor, patch) ?? state;
}

function createReadyEditorStatePatch(
  editor: EditorSession,
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
) {
  if (!hasEditorPatchChange(editor, patch)) {
    return undefined;
  }

  return {
    noteState: {
      editor: {
        ...editor,
        ...patch,
        revision: editor.revision + 1,
        saveStatus: getNextPatchSaveStatus(editor),
      },
      status: "ready" as const,
    },
  };
}

function getNextPatchSaveStatus(
  editor: EditorSession,
): EditorSession["saveStatus"] {
  if (editor.saveStatus === "conflict" || editor.saveStatus === "saving") {
    return editor.saveStatus;
  }

  return "idle";
}

/** Persists or clears the current ready editor draft in IndexedDB. */
export async function persistCurrentDraft(
  context: StoreContext,
): Promise<DraftWriteResult | undefined> {
  const target = getCurrentDraftTarget(context);

  if (target === undefined) {
    return undefined;
  }

  const result = await persistDraftTarget(target, context);
  applyDraftWriteResult(result, context);

  return result;
}

/** Saves the selected note through the Slice 5 content-hash contract. */
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

function getActiveSavePromise(context: StoreContext): Promise<void> | undefined {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  return context.getActiveNoteSave(noteState.editor.note.id)?.promise;
}

/** Deletes a recovered draft and reloads the current disk version. */
export async function discardDraftAndReloadDiskVersionAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;

  if (noteState.status === "missing-draft") {
    await discardMissingNoteDraftState(noteState.noteId, context);
    return;
  }

  if (noteState.status !== "ready") {
    return;
  }

  const noteId = noteState.editor.note.id;
  await clearDraftForNote(noteId, context);
  await selectNoteAction(noteId, context, {
    forceReload: true,
    routeSource: noteRouteSources.draftDiscardReload,
  });
}

/** Deletes a recovered draft for a note that no longer exists on disk. */
export async function discardMissingDraftAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;

  if (noteState.status !== "missing-draft") {
    return;
  }

  await discardMissingNoteDraftState(noteState.noteId, context);
}

function getCurrentDraftTarget(context: StoreContext): DraftTarget | undefined {
  const noteState = context.get().noteState;
  const clusterId = getReadyClusterId(context.get().clusterIdentity);

  if (noteState.status !== "ready" || clusterId === undefined) {
    return undefined;
  }

  return { clusterId, editor: noteState.editor };
}

async function persistDraftTarget(
  target: DraftTarget,
  context: StoreContext,
): Promise<DraftWriteResult> {
  if (hasDirtyMarkdown(target.editor)) {
    return await context.draftPersistence.writeDraft(
      createDraftRecord({
        baseContentHash: target.editor.baseContentHash,
        clusterId: target.clusterId,
        editorMode: target.editor.editorMode,
        markdown: target.editor.currentMarkdown,
        noteId: target.editor.note.id,
      }),
    );
  }

  return await context.draftPersistence.deleteDraft(
    target.clusterId,
    target.editor.note.id,
  );
}

function applyDraftWriteResult(
  result: DraftWriteResult,
  context: StoreContext,
): void {
  if (result.status === "unavailable") {
    degradeDraftRecovery(result.reason, context);
  }
}

function getSaveableEditor(context: StoreContext): EditorSession | undefined {
  const noteState = context.get().noteState;

  if (noteState.status !== "ready") {
    return undefined;
  }

  if (!canSaveEditor(noteState.editor)) {
    return undefined;
  }

  return noteState.editor;
}

function markEditorSaving(editor: EditorSession, context: StoreContext): void {
  context.set({
    noteState: {
      editor: { ...editor, saveStatus: "saving" },
      status: "ready",
    },
  });
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
    await applySaveResponse(
      {
        clusterIdentity: response.clusterIdentity,
        context,
        editor,
        note: response.note,
      },
      () => persistCurrentDraft(context),
    );
    recordSaveResult(evidence, {
      clusterIdentity: response.clusterIdentity,
      contentHash: response.note.contentHash,
    });
  } catch (error) {
    await applySaveFailure({
      context,
      editor,
      error,
      persistLatestDraft: () => persistCurrentDraft(context),
    });
    recordSaveResult(evidence, { error });
  }
}

async function discardMissingNoteDraftState(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  await clearDraftForNote(noteId, context);
  context.set({ noteState: { noteId, status: "missing" } });
}

async function clearDraftForNote(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);

  if (clusterId === undefined) {
    return;
  }

  const result = await context.draftPersistence.deleteDraft(clusterId, noteId);

  if (result.status === "unavailable") {
    degradeDraftRecovery(result.reason, context);
  }
}
