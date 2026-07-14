import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import { canSaveEditor } from "./note-browser-action-utils.js";
import type { NoteBrowserApi } from "./note-browser-contracts.js";
import type {
  DraftWorkflowAccess,
  SnapshotKeyAllocator,
} from "./note-browser-draft-runtime.js";
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

type SaveWorkflow = {
  readonly allocateSnapshotKey: SnapshotKeyAllocator;
  readonly api: NoteBrowserApi;
  readonly draft: DraftWorkflowAccess;
};

/** Creates a Save command with one private single-flight promise per note. */
export function createSaveSelectedNoteAction(
  workflow: SaveWorkflow,
): () => Promise<void> {
  const activeSaves = new Map<string, Promise<void>>();
  return () => saveSelectedNote(activeSaves, workflow);
}

function saveSelectedNote(
  activeSaves: Map<string, Promise<void>>,
  workflow: SaveWorkflow,
): Promise<void> {
  const activePromise = getActiveSavePromise(activeSaves, workflow);
  if (activePromise !== undefined) {
    return activePromise;
  }
  const editor = getSaveableEditor(workflow);
  if (editor === undefined) {
    return Promise.resolve();
  }
  const metadata = createNoteRequestMetadata();
  const evidence = createBrowserOperationEvidence({
    expectedContentHash: editor.baseContentHash,
    metadata,
    noteId: editor.note.id,
  });
  markEditorSaving(editor, workflow);
  const promise = runBrowserOperation({
    callback: () => saveEditor(editor, evidence, workflow),
    evidence,
    eventName: runtimeObservabilityEventNames.noteSaveStarted,
    spanName: runtimeSpanNames.noteSave,
    startAttributes: {
      [runtimeObservabilityAttributeNames.expectedContentHash]:
        editor.baseContentHash,
    },
  }).finally(() => {
    if (activeSaves.get(editor.note.id) === promise) {
      activeSaves.delete(editor.note.id);
    }
  });
  activeSaves.set(editor.note.id, promise);
  return promise;
}

async function saveEditor(
  editor: EditorSession,
  evidence: BrowserOperationEvidence,
  workflow: SaveWorkflow,
): Promise<void> {
  try {
    const response = await workflow.api.saveNote(
      {
        expectedContentHash: editor.baseContentHash,
        markdown: editor.currentMarkdown,
        noteId: editor.note.id,
      },
      evidence.metadata,
    );
    await applySaveResponse({
      clusterIdentity: response.clusterIdentity,
      editor,
      note: response.note,
      workflow: {
        ...workflow.draft,
        allocateSnapshotKey: workflow.allocateSnapshotKey,
      },
    });
    recordSaveResult(evidence, {
      clusterIdentity: response.clusterIdentity,
      contentHash: response.note.contentHash,
    });
  } catch (error) {
    await flushLatestFailedSaveDraft(editor.sessionKey, workflow);
    applySaveFailure({ editor, error, workflow: workflow.draft });
    recordSaveResult(evidence, { error });
  }
}

async function flushLatestFailedSaveDraft(
  sessionKey: string,
  workflow: SaveWorkflow,
): Promise<void> {
  let revision = getSessionRevision(sessionKey, workflow);
  while (revision !== undefined) {
    await flushEditorDurability(
      "explicit_flush",
      workflow.draft.state,
      workflow.draft.coordinator,
    );
    revision = getNewerSessionRevision(sessionKey, revision, workflow);
  }
}

function getNewerSessionRevision(
  sessionKey: string,
  previousRevision: number,
  workflow: SaveWorkflow,
): number | undefined {
  const currentRevision = getSessionRevision(sessionKey, workflow);
  return currentRevision === previousRevision ? undefined : currentRevision;
}

function getSessionRevision(
  sessionKey: string,
  workflow: SaveWorkflow,
): number | undefined {
  const noteState = workflow.draft.state.getState().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  return noteState.editor.sessionKey === sessionKey
    ? noteState.editor.revision
    : undefined;
}

function getActiveSavePromise(
  activeSaves: Map<string, Promise<void>>,
  workflow: SaveWorkflow,
): Promise<void> | undefined {
  const noteState = workflow.draft.state.getState().noteState;
  return noteState.status === "ready"
    ? activeSaves.get(noteState.editor.note.id)
    : undefined;
}

function getSaveableEditor(workflow: SaveWorkflow): EditorSession | undefined {
  const noteState = workflow.draft.state.getState().noteState;
  return noteState.status === "ready" && canSaveEditor(noteState.editor)
    ? noteState.editor
    : undefined;
}

function markEditorSaving(editor: EditorSession, workflow: SaveWorkflow): void {
  workflow.draft.state.setState({
    noteState: {
      editor: { ...editor, saveStatus: "saving" },
      status: "ready",
    },
  });
}
