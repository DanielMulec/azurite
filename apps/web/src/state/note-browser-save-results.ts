import type { ClusterIdentity, NoteContentWithHash } from "@azurite/shared";

import type { DraftWriteResult } from "../persistence/draft-database.js";
import {
  applyClusterIdentity,
  createEditorSession,
  degradeDraftRecovery,
  getCurrentEditorForNote,
  getReadyClusterId,
  isNoteWriteConflictError,
  isSameSaveSnapshot,
  patchSavedNoteSummary,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";

type SaveResponseInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly note: NoteContentWithHash;
};

/** Applies a successful save without overwriting newer editor or draft truth. */
export async function applySaveResponse(
  input: SaveResponseInput,
  persistLatestDraft: () => Promise<unknown>,
): Promise<void> {
  const reconciliation = await reconcileSavedDraft(input);
  const currentEditor = getCurrentEditorForNote(
    input.editor.note.id,
    input.context,
  );
  if (currentEditor === undefined) {
    return;
  }
  if (reconciliation !== undefined) {
    applyDraftWriteResult(reconciliation, input.context);
  }
  applyClusterIdentity(input.clusterIdentity, input.context);
  if (isSameSaveSnapshot(currentEditor, input.editor)) {
    applySavedNote(input.note, input.context);
    return;
  }
  applyStaleSavedBaseline(input.note, input.context);
  await persistLatestDraft();
}

/** Applies a failed save to the latest same-note editor without restoring text. */
export async function applySaveFailure(
  error: unknown,
  editor: EditorSession,
  context: StoreContext,
  persistLatestDraft: () => Promise<unknown>,
): Promise<void> {
  const currentEditor = getCurrentEditorForNote(editor.note.id, context);
  if (currentEditor === undefined) {
    return;
  }
  await persistLatestDraft();
  if (isNoteWriteConflictError(error)) {
    applySaveConflict(currentEditor, context);
  } else {
    applySaveFailureState(currentEditor, context);
  }
}

async function reconcileSavedDraft(
  input: SaveResponseInput,
): Promise<DraftWriteResult | undefined> {
  const clusterId = getReadyClusterId(input.clusterIdentity);
  if (clusterId === undefined) {
    return undefined;
  }
  return await input.context.draftPersistence.deleteDraftIfSavedSnapshotMatches(
    {
      baseContentHash: input.editor.baseContentHash,
      clusterId,
      markdown: input.editor.currentMarkdown,
      noteId: input.editor.note.id,
    },
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

function applyStaleSavedBaseline(
  note: NoteContentWithHash,
  context: StoreContext,
): void {
  context.set((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.note.id !== note.id
    ) {
      return state;
    }
    return {
      noteState: {
        editor: {
          ...state.noteState.editor,
          baseContentHash: note.contentHash,
          note,
          recovery: "none",
          savedMarkdown: note.markdown,
          saveStatus: "idle",
        },
        status: "ready",
      },
      notesState: patchSavedNoteSummary(state.notesState, note),
    };
  });
}
