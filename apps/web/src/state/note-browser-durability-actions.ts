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
  const immediate = getImmediateDurability(editor, dirty, cause, context);
  if (immediate !== undefined) {
    return immediate;
  }
  if (editor.lastSnapshotKey === undefined) {
    return unavailableDurability(editor, cause, {
      reason: "snapshot_admission_failed",
      source: "coordinator",
    });
  }
  const result = await context.draftCoordinator.flushSnapshot(
    editor.lastSnapshotKey,
  );
  return resolveFlushedDurability(editor, result, cause, context);
}

function getImmediateDurability(
  editor: EditorSession,
  dirty: boolean,
  cause: DurabilityCause,
  context: StoreContext,
): DurabilityResult | undefined {
  if (!dirty && editor.draftDisposition === "none") {
    return cleanDurability(editor, cause);
  }
  if (!dirty && isPreservedDisposition(editor.draftDisposition)) {
    return preservedDurability(editor, cause);
  }
  if (
    (editor.draftDisposition === "recovered" ||
      editor.draftDisposition === "conflict") &&
    editor.durableSnapshotKey !== undefined
  ) {
    return durableResult(editor, cause, context);
  }
  if (
    editor.draftDisposition === "cleanup_required" ||
    editor.persistenceIssue !== undefined
  ) {
    return unavailableDurability(
      editor,
      cause,
      editor.persistenceIssue?.failure ?? {
        reason: "queue_task_failed",
        source: "coordinator",
      },
    );
  }
  return undefined;
}

function resolveFlushedDurability(
  original: EditorSession,
  result: DraftSnapshotResult,
  cause: DurabilityCause,
  context: StoreContext,
): DurabilityResult {
  const current = getExactEditor(original.sessionKey, context);
  if (current === undefined || current.revision !== original.revision) {
    return unavailableDurability(original, cause, {
      reason: "owner_lost",
      source: "session",
    });
  }
  if (
    result.status === "written" ||
    current.durableSnapshotKey === current.lastSnapshotKey
  ) {
    return durableResult(current, cause, context);
  }
  if (result.status === "clean") {
    return cleanDurability(current, cause);
  }
  return unavailableDurability(
    current,
    cause,
    current.persistenceIssue?.failure ?? {
      reason: "queue_task_failed",
      source: "coordinator",
    },
  );
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
  const snapshotKey = editor.durableSnapshotKey ?? editor.lastSnapshotKey;
  if (clusterId === undefined || snapshotKey === undefined) {
    return unavailableDurability(editor, cause, {
      reason: "queue_task_failed",
      source: "coordinator",
    });
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
