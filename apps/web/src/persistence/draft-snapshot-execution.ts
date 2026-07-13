import type {
  DraftPersistence,
  DraftRecordMutationResult,
  DraftWriteResult,
} from "./draft-database.js";
import { createDraftRecord } from "./draft-records.js";
import type { DraftMutationSnapshot } from "./draft-workflow-types.js";
import type { DraftSnapshotResult } from "./draft-persistence-coordinator.js";

/** Executes one already ordered immutable snapshot against browser storage. */
export async function executeDraftSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
): Promise<DraftSnapshotResult> {
  if (isProtectedDisposition(snapshot.disposition)) {
    return { status: "record_protected" };
  }
  if (!snapshot.contentDirty && snapshot.disposition === "none") {
    return { outcome: "no_record", status: "clean" };
  }
  if (shouldDeleteSnapshot(snapshot)) {
    const result = await persistence.deleteDraft(
      requireClusterId(snapshot),
      snapshot.noteId,
    );
    return toCleanSnapshotResult(result);
  }
  const result = await persistence.writeDraft(
    createDraftRecord({
      baseContentHash: snapshot.baseContentHash,
      clusterId: requireClusterId(snapshot),
      editorMode: snapshot.editorMode,
      markdown: snapshot.markdown,
      noteId: snapshot.noteId,
    }),
  );
  return toWriteSnapshotResult(result);
}

/** Returns the stable ordered-work key for one ready cluster note. */
export function getDraftQueueKey(clusterId: string, noteId: string): string {
  return `${clusterId}\u0000${noteId}`;
}

/** Returns the stable ordered-work key for one cluster-bound snapshot. */
export function getSnapshotQueueKey(snapshot: DraftMutationSnapshot): string {
  return getDraftQueueKey(requireClusterId(snapshot), snapshot.noteId);
}

function shouldDeleteSnapshot(snapshot: DraftMutationSnapshot): boolean {
  return !snapshot.contentDirty;
}

function isProtectedDisposition(
  disposition: DraftMutationSnapshot["disposition"],
): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}

function toWriteSnapshotResult(result: DraftWriteResult): DraftSnapshotResult {
  return result;
}

function toCleanSnapshotResult(
  result: DraftRecordMutationResult,
): DraftSnapshotResult {
  if (result.status === "preserved_unknown" || result.status === "unavailable") {
    return result;
  }
  return { outcome: result, status: "clean" };
}

function requireClusterId(snapshot: DraftMutationSnapshot): string {
  if (snapshot.clusterId === undefined) {
    throw new Error("A queued draft snapshot requires a cluster ID.");
  }
  return snapshot.clusterId;
}
