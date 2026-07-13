import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import { canSaveEditor } from "./note-browser-action-utils.js";
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
    await flushLatestFailedSaveDraft(editor.sessionKey, context);
    applySaveFailure({ context, editor, error });
    recordSaveResult(evidence, { error });
  }
}

async function flushLatestFailedSaveDraft(
  sessionKey: string,
  context: StoreContext,
): Promise<void> {
  while (true) {
    const noteState = context.get().noteState;
    if (
      noteState.status !== "ready" ||
      noteState.editor.sessionKey !== sessionKey
    ) {
      return;
    }
    const revision = noteState.editor.revision;
    await flushEditorDurability("explicit_flush", context);
    const current = context.get().noteState;
    if (
      current.status !== "ready" ||
      current.editor.sessionKey !== sessionKey ||
      current.editor.revision === revision
    ) {
      return;
    }
  }
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
