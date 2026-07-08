import type { ClusterIdentity, NoteContentWithHash } from "@azurite/shared";

import type { DraftWriteResult } from "../persistence/draft-database.js";
import { createDraftRecord } from "../persistence/draft-records.js";
import {
  applyClusterIdentity,
  canSaveEditor,
  createEditorSession,
  degradeDraftRecovery,
  getReadyClusterId,
  hasDirtyMarkdown,
  isNoteWriteConflictError,
  patchSavedNoteSummary,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import { selectNoteAction } from "./note-browser-route-actions.js";

type DraftTarget = {
  readonly clusterId: string;
  readonly editor: EditorSession;
};

type SaveResponseInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly note: NoteContentWithHash;
};

/** Applies editor markdown or mode changes to the current ready session. */
export function updateCurrentEditor(
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
  context: Pick<StoreContext, "set">,
): void {
  context.set((state) => {
    if (state.noteState.status !== "ready") {
      return state;
    }

    const saveStatus =
      state.noteState.editor.saveStatus === "conflict" ? "conflict" : "idle";

    return {
      noteState: {
        editor: { ...state.noteState.editor, ...patch, saveStatus },
        status: "ready",
      },
    };
  });
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
export async function saveSelectedNoteAction(
  context: StoreContext,
): Promise<void> {
  const editor = getSaveableEditor(context);

  if (editor === undefined) {
    return;
  }

  markEditorSaving(editor, context);
  await saveEditor(editor, context);
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
  await selectNoteAction(noteId, context, { forceReload: true });
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
  context: StoreContext,
): Promise<void> {
  try {
    const response = await context.api.saveNote({
      expectedContentHash: editor.baseContentHash,
      markdown: editor.currentMarkdown,
      noteId: editor.note.id,
    });
    await applySaveResponse({
      clusterIdentity: response.clusterIdentity,
      context,
      editor,
      note: response.note,
    });
  } catch (error) {
    await applySaveFailure(error, editor, context);
  }
}

async function applySaveResponse(input: SaveResponseInput): Promise<void> {
  if (!isStillSelected(input.editor, input.context)) {
    return;
  }

  applyClusterIdentity(input.clusterIdentity, input.context);
  await clearDraftForNote(input.editor.note.id, input.context);
  applySavedNote(input.note, input.context);
}

async function applySaveFailure(
  error: unknown,
  editor: EditorSession,
  context: StoreContext,
): Promise<void> {
  if (!isStillSelected(editor, context)) {
    return;
  }

  await applyCurrentSaveFailure(error, editor, context);
}

async function applyCurrentSaveFailure(
  error: unknown,
  editor: EditorSession,
  context: StoreContext,
): Promise<void> {
  if (isNoteWriteConflictError(error)) {
    await persistCurrentDraft(context);
    applySaveConflict(editor, context);
    return;
  }

  applySaveFailureState(editor, context);
}

function applySaveConflict(editor: EditorSession, context: StoreContext): void {
  context.set({
    noteState: {
      editor: { ...editor, recovery: "conflict", saveStatus: "conflict" },
      status: "ready",
    },
  });
}

function applySaveFailureState(
  editor: EditorSession,
  context: StoreContext,
): void {
  context.set({
    noteState: {
      editor: { ...editor, saveStatus: "failed" },
      status: "ready",
    },
  });
}

function isStillSelected(
  editor: EditorSession,
  context: StoreContext,
): boolean {
  return context.get().selectedNoteId === editor.note.id;
}

async function discardMissingNoteDraftState(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  await clearDraftForNote(noteId, context);
  context.set({ noteState: { noteId, status: "missing" } });
}

function applySavedNote(
  note: NoteContentWithHash,
  context: StoreContext,
): void {
  context.set((state) => ({
    noteState: {
      editor: createEditorSession(note, undefined, context),
      status: "ready",
    },
    notesState: patchSavedNoteSummary(state.notesState, note),
  }));
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
