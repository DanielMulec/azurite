import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftSnapshotResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DurabilityCause,
  DurabilityResult,
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
  cause: DurabilityCause,
  context: StoreContext,
): Promise<DurabilityResult> {
  const editor = getCurrentEditor(context);
  if (editor === undefined) {
    return ownerLostDurability(cause);
  }
  const dirty = hasMarkdownDifference(
    editor.currentMarkdown,
    editor.savedMarkdown,
  );
  const immediate = getImmediateDurability({ cause, context, dirty, editor });
  if (immediate !== undefined) {
    return immediate;
  }
  return await flushAdmittedSnapshot(editor, cause, context);
}

async function flushAdmittedSnapshot(
  editor: EditorSession,
  cause: DurabilityCause,
  context: StoreContext,
): Promise<DurabilityResult> {
  const snapshotKey = editor.lastSnapshotKey;
  if (snapshotKey === undefined) {
    return unavailableDurability(editor, cause, {
      reason: "snapshot_admission_failed",
      source: "coordinator",
    });
  }
  const result = await context.draftCoordinator.flushSnapshot(snapshotKey);
  return resolveFlushedDurability({ cause, context, original: editor, result });
}

function getImmediateDurability(input: {
  readonly cause: DurabilityCause;
  readonly context: StoreContext;
  readonly dirty: boolean;
  readonly editor: EditorSession;
}): DurabilityResult | undefined {
  const clean = getCleanImmediateDurability(input);
  if (clean !== undefined) {
    return clean;
  }
  const durable = getOwnedRecordDurability(input);
  if (durable !== undefined) {
    return durable;
  }
  return getUnavailableImmediateDurability(input.editor, input.cause);
}

function getCleanImmediateDurability(input: {
  readonly cause: DurabilityCause;
  readonly dirty: boolean;
  readonly editor: EditorSession;
}): DurabilityResult | undefined {
  return input.dirty
    ? undefined
    : getCleanDispositionDurability(input.editor, input.cause);
}

function getCleanDispositionDurability(
  editor: EditorSession,
  cause: DurabilityCause,
): DurabilityResult | undefined {
  if (editor.draftDisposition === "none") {
    return cleanDurability(editor, cause);
  }
  return isPreservedDisposition(editor.draftDisposition)
    ? preservedDurability(editor, cause)
    : undefined;
}

function getOwnedRecordDurability(input: {
  readonly cause: DurabilityCause;
  readonly context: StoreContext;
  readonly editor: EditorSession;
}): DurabilityResult | undefined {
  if (!isRecoveredOrConflict(input.editor.draftDisposition)) {
    return undefined;
  }
  if (input.editor.durableSnapshotKey === undefined) {
    return undefined;
  }
  return durableResult(input.editor, input.cause, input.context);
}

function getUnavailableImmediateDurability(
  editor: EditorSession,
  cause: DurabilityCause,
): DurabilityResult | undefined {
  if (editor.draftDisposition === "cleanup_required") {
    return unavailableDurability(editor, cause, getEditorFailure(editor));
  }
  return editor.persistenceIssue === undefined
    ? undefined
    : unavailableDurability(editor, cause, editor.persistenceIssue.failure);
}

function resolveFlushedDurability(input: {
  readonly cause: DurabilityCause;
  readonly context: StoreContext;
  readonly original: EditorSession;
  readonly result: DraftSnapshotResult;
}): DurabilityResult {
  const current = getExactEditor(input.original.sessionKey, input.context);
  if (current === undefined) {
    return ownerLostAfterFlush(input);
  }
  if (current.revision !== input.original.revision) {
    return ownerLostAfterFlush(input);
  }
  return resolveCurrentFlushedDurability(current, input);
}

function ownerLostAfterFlush(input: {
  readonly cause: DurabilityCause;
  readonly original: EditorSession;
}): DurabilityResult {
  return unavailableDurability(input.original, input.cause, {
    reason: "owner_lost",
    source: "session",
  });
}

function resolveCurrentFlushedDurability(
  current: EditorSession,
  input: {
    readonly cause: DurabilityCause;
    readonly context: StoreContext;
    readonly result: DraftSnapshotResult;
  },
): DurabilityResult {
  if (isDurableFlush(current, input.result)) {
    return durableResult(current, input.cause, input.context);
  }
  if (input.result.status === "clean") {
    return cleanDurability(current, input.cause);
  }
  return unavailableDurability(current, input.cause, getEditorFailure(current));
}

function cleanDurability(
  editor: EditorSession,
  cause: DurabilityCause,
): DurabilityResult {
  return {
    cause,
    clusterId: undefined,
    disposition: "none",
    noteId: editor.note.id,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    snapshotKey: editor.lastSnapshotKey,
    status: "clean",
  };
}

function preservedDurability(
  editor: EditorSession,
  cause: DurabilityCause,
): DurabilityResult {
  return {
    cause,
    clusterId: undefined,
    disposition: editor.draftDisposition as
      "preserved_unknown" | "recovery_read_unavailable",
    noteId: editor.note.id,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    snapshotKey: undefined,
    status: "preserved",
  };
}

function durableResult(
  editor: EditorSession,
  cause: DurabilityCause,
  context: StoreContext,
): DurabilityResult {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return missingDurableIdentity(editor, cause);
  }
  const snapshotKey = getDurableSnapshotKey(editor);
  if (snapshotKey === undefined) {
    return missingDurableIdentity(editor, cause);
  }
  return {
    cause,
    clusterId,
    disposition: editor.draftDisposition as
      "conflict" | "generated_durable" | "recovered",
    noteId: editor.note.id,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    snapshotKey,
    status: "durable",
  };
}

function missingDurableIdentity(
  editor: EditorSession,
  cause: DurabilityCause,
): DurabilityResult {
  return unavailableDurability(editor, cause, {
    reason: "queue_task_failed",
    source: "coordinator",
  });
}

function unavailableDurability(
  editor: EditorSession,
  cause: DurabilityCause,
  failure: Extract<DurabilityResult, { status: "unavailable" }>["failure"],
): DurabilityResult {
  return {
    cause,
    clusterId: editor.persistenceIssue?.clusterId,
    disposition: editor.draftDisposition,
    failure,
    noteId: editor.note.id,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    snapshotKey: editor.lastSnapshotKey,
    status: "unavailable",
  };
}

function ownerLostDurability(cause: DurabilityCause): DurabilityResult {
  return {
    cause,
    clusterId: undefined,
    disposition: "none",
    failure: { reason: "owner_lost", source: "session" },
    noteId: "",
    revision: 0,
    sessionKey: "",
    snapshotKey: undefined,
    status: "unavailable",
  };
}

function isPreservedDisposition(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}

function isRecoveredOrConflict(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return disposition === "recovered" || disposition === "conflict";
}

function isDurableFlush(
  editor: EditorSession,
  result: DraftSnapshotResult,
): boolean {
  return (
    result.status === "written" ||
    editor.durableSnapshotKey === editor.lastSnapshotKey
  );
}

function getDurableSnapshotKey(editor: EditorSession): string | undefined {
  return editor.durableSnapshotKey ?? editor.lastSnapshotKey;
}

function getEditorFailure(
  editor: EditorSession,
): Extract<DurabilityResult, { status: "unavailable" }>["failure"] {
  return editor.persistenceIssue === undefined
    ? { reason: "queue_task_failed", source: "coordinator" }
    : editor.persistenceIssue.failure;
}
