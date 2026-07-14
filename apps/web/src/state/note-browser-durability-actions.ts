import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type {
  DraftPersistenceCoordinator,
  DraftSnapshotResult,
} from "../persistence/draft-persistence-coordinator.js";
import type {
  DurabilityCause,
  HandoffDecision,
  HandoffFailure,
} from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { NoteBrowserStateAccess } from "./note-browser-contracts.js";
import {
  getCurrentEditor,
  getExactEditor,
} from "./note-browser-editor-state.js";
import type { EditorSession } from "./note-browser-types.js";

/** Returns whether the exact current authority may be destructively handed off. */
export async function flushEditorDurability(
  _cause: DurabilityCause,
  state: NoteBrowserStateAccess,
  coordinator: DraftPersistenceCoordinator,
): Promise<HandoffDecision> {
  const editor = getCurrentEditor(state);
  if (editor === undefined) {
    return blocked({ reason: "owner_lost", source: "session" });
  }
  const immediate = getImmediateDecision(editor, state);
  if (immediate !== undefined) {
    return immediate;
  }
  return await flushAdmittedSnapshot(editor, state, coordinator);
}

function getImmediateDecision(
  editor: EditorSession,
  state: NoteBrowserStateAccess,
): HandoffDecision | undefined {
  const dirty = hasMarkdownDifference(
    editor.currentMarkdown,
    editor.savedMarkdown,
  );
  const dispositionDecision = getDispositionDecision(editor, dirty);
  return dispositionDecision ?? getEvidenceDecision(editor, state);
}

function getDispositionDecision(
  editor: EditorSession,
  dirty: boolean,
): HandoffDecision | undefined {
  if (editor.draftDisposition === "cleanup_required") {
    return blocked(getEditorFailure(editor));
  }
  return !dirty && cleanHandoffDispositions.has(editor.draftDisposition)
    ? continued
    : undefined;
}

function getEvidenceDecision(
  editor: EditorSession,
  state: NoteBrowserStateAccess,
): HandoffDecision | undefined {
  if (ownsMatchingDurableRecord(editor, state)) {
    return continued;
  }
  return editor.persistenceIssue === undefined
    ? undefined
    : blocked(editor.persistenceIssue.failure);
}

async function flushAdmittedSnapshot(
  editor: EditorSession,
  state: NoteBrowserStateAccess,
  coordinator: DraftPersistenceCoordinator,
): Promise<HandoffDecision> {
  if (editor.lastSnapshotKey === undefined) {
    return blocked({
      reason: "snapshot_admission_failed",
      source: "coordinator",
    });
  }
  const result = await coordinator.flushSnapshot(editor.lastSnapshotKey);
  const current = getExactEditor(editor.sessionKey, state);
  if (current === undefined || current.revision !== editor.revision) {
    return blocked({ reason: "owner_lost", source: "session" });
  }
  if (isDurableFlush(current, result)) {
    return continued;
  }
  return blocked(getEditorFailure(current));
}

function ownsMatchingDurableRecord(
  editor: EditorSession,
  state: NoteBrowserStateAccess,
): boolean {
  return (
    getReadyClusterId(state.getState().clusterIdentity) !== undefined &&
    editor.durableSnapshotKey !== undefined &&
    editor.durableSnapshotKey === editor.lastSnapshotKey
  );
}

function isDurableFlush(
  editor: EditorSession,
  result: DraftSnapshotResult,
): boolean {
  return (
    result.status === "written" ||
    result.status === "cleared" ||
    editor.durableSnapshotKey === editor.lastSnapshotKey
  );
}

function getEditorFailure(editor: EditorSession): HandoffFailure {
  return editor.persistenceIssue?.failure ?? queueFailure;
}

function blocked(failure: HandoffFailure): HandoffDecision {
  return { failure, status: "block" };
}

const continued: HandoffDecision = Object.freeze({ status: "continue" });
const cleanHandoffDispositions = new Set<EditorSession["draftDisposition"]>([
  "generated_durable",
  "none",
  "preserved_unknown",
  "recovery_read_unavailable",
]);
const queueFailure = Object.freeze({
  reason: "queue_task_failed",
  source: "coordinator",
} as const);
