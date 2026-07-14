import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftSnapshotResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DurabilityCause,
  HandoffDecision,
  HandoffFailure,
} from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  getCurrentEditor,
  getExactEditor,
} from "./note-browser-editor-state.js";
import type { EditorSession } from "./note-browser-types.js";

/** Returns whether the exact current authority may be destructively handed off. */
export async function flushEditorDurability(
  _cause: DurabilityCause,
  context: StoreContext,
): Promise<HandoffDecision> {
  const editor = getCurrentEditor(context);
  if (editor === undefined) {
    return blocked({ reason: "owner_lost", source: "session" });
  }
  const immediate = getImmediateDecision(editor, context);
  if (immediate !== undefined) {
    return immediate;
  }
  return await flushAdmittedSnapshot(editor, context);
}

function getImmediateDecision(
  editor: EditorSession,
  context: StoreContext,
): HandoffDecision | undefined {
  const dirty = hasMarkdownDifference(
    editor.currentMarkdown,
    editor.savedMarkdown,
  );
  const dispositionDecision = getDispositionDecision(editor, dirty);
  return dispositionDecision ?? getEvidenceDecision(editor, context);
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
  context: StoreContext,
): HandoffDecision | undefined {
  if (ownsMatchingDurableRecord(editor, context)) {
    return continued;
  }
  return editor.persistenceIssue === undefined
    ? undefined
    : blocked(editor.persistenceIssue.failure);
}

async function flushAdmittedSnapshot(
  editor: EditorSession,
  context: StoreContext,
): Promise<HandoffDecision> {
  if (editor.lastSnapshotKey === undefined) {
    return blocked({
      reason: "snapshot_admission_failed",
      source: "coordinator",
    });
  }
  const result = await context.draftCoordinator.flushSnapshot(
    editor.lastSnapshotKey,
  );
  const current = getExactEditor(editor.sessionKey, context);
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
  context: StoreContext,
): boolean {
  return (
    getReadyClusterId(context.get().clusterIdentity) !== undefined &&
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
