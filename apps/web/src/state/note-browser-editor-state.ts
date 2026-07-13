import type { DraftMutationSnapshot } from "../persistence/draft-workflow-types.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";

/** Returns the current ready editor, if the rendered surface owns one. */
export function getCurrentEditor(
  context: Pick<StoreContext, "get">,
): EditorSession | undefined {
  return getStateEditor(context.get());
}

/** Returns the current editor only when one exact session owns the surface. */
export function getExactEditor(
  sessionKey: string,
  context: Pick<StoreContext, "get">,
): EditorSession | undefined {
  const editor = getCurrentEditor(context);
  return editor?.sessionKey === sessionKey ? editor : undefined;
}

/** Returns the ready editor from one immutable store snapshot. */
export function getStateEditor(
  state: NoteBrowserStore,
): EditorSession | undefined {
  return state.noteState.status === "ready"
    ? state.noteState.editor
    : undefined;
}

/** Returns whether one store snapshot still owns an exact editor revision. */
export function stateOwnsEditor(
  state: NoteBrowserStore,
  editor: EditorSession,
): boolean {
  const current = getStateEditor(state);
  return current !== undefined && editorsShareRevision(current, editor);
}

/** Returns whether one editor still owns an exact settled snapshot. */
export function editorOwnsSnapshot(
  editor: EditorSession | undefined,
  snapshot: DraftMutationSnapshot,
): editor is EditorSession {
  return editor !== undefined && editorMatchesSnapshot(editor, snapshot);
}

function editorsShareRevision(
  current: EditorSession,
  expected: EditorSession,
): boolean {
  return (
    current.sessionKey === expected.sessionKey &&
    current.revision === expected.revision &&
    current.draftEpoch === expected.draftEpoch
  );
}

function editorMatchesSnapshot(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): boolean {
  return (
    editorMatchesSnapshotOwner(editor, snapshot) &&
    editorMatchesSnapshotRevision(editor, snapshot)
  );
}

function editorMatchesSnapshotOwner(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): boolean {
  return (
    editor.sessionKey === snapshot.sessionKey &&
    editor.draftEpoch === snapshot.draftEpoch
  );
}

function editorMatchesSnapshotRevision(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): boolean {
  return (
    editor.revision === snapshot.revision &&
    editor.lastSnapshotKey === snapshot.snapshotKey
  );
}

/** Wraps one editor replacement in the ready note-state patch. */
export function readyEditorPatch(editor: EditorSession) {
  return { noteState: { editor, status: "ready" as const } };
}
