import type { DraftPersistence, DraftWriteResult } from "./draft-database.js";
import {
  decideDraftMutation,
  type DraftDeleteDecision,
} from "./draft-persistence-decisions.js";
import { createDraftRecord } from "./draft-records.js";
import type { DraftMutationSnapshot } from "./draft-workflow-types.js";
import type { DraftSnapshotResult } from "./draft-persistence-coordinator.js";

/** Executes one already ordered immutable snapshot against browser storage. */
export async function executeDraftSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
  admittedAt = new Date().toISOString(),
): Promise<DraftSnapshotResult> {
  if (isProtectedDisposition(snapshot.disposition)) {
    return { status: "protected" };
  }
  return await executeUnprotectedSnapshot(snapshot, persistence, admittedAt);
}

async function executeUnprotectedSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
  admittedAt: string,
): Promise<DraftSnapshotResult> {
  if (isCleanWithoutRecord(snapshot)) {
    return { status: "cleared" };
  }
  return await executeStorageSnapshot(snapshot, persistence, admittedAt);
}

async function executeStorageSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
  admittedAt: string,
): Promise<DraftSnapshotResult> {
  if (shouldDeleteSnapshot(snapshot)) {
    return await deleteSnapshot(snapshot, persistence);
  }
  return await writeSnapshot(snapshot, persistence, admittedAt);
}

async function writeSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
  admittedAt: string,
): Promise<DraftSnapshotResult> {
  const result = await persistence.writeDraft(
    createDraftRecord({
      baseContentHash: snapshot.baseContentHash,
      clusterId: requireClusterId(snapshot),
      editorMode: snapshot.editorMode,
      markdown: snapshot.markdown,
      noteId: snapshot.noteId,
      updatedAt: admittedAt,
    }),
  );
  return toWriteSnapshotResult(result);
}

async function deleteSnapshot(
  snapshot: DraftMutationSnapshot,
  persistence: DraftPersistence,
): Promise<DraftSnapshotResult> {
  const result = await persistence.deleteDraft(
    requireClusterId(snapshot),
    snapshot.noteId,
  );
  return toMutationSnapshotResult(decideDraftMutation(result));
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

function isCleanWithoutRecord(snapshot: DraftMutationSnapshot): boolean {
  return !snapshot.contentDirty && snapshot.disposition === "none";
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
  if (result.status === "written") {
    return { status: "written" };
  }
  if (result.status === "preserved_unknown") {
    return {
      schemaVersion: result.schemaVersion,
      status: "protected",
    };
  }
  return {
    failure: { reason: result.reason, source: "persistence" },
    status: "failed",
  };
}

function toMutationSnapshotResult(
  decision: DraftDeleteDecision,
): DraftSnapshotResult {
  if (decision.status === "protected") {
    return {
      schemaVersion: decision.schemaVersion,
      status: "protected",
    };
  }
  if (decision.status === "failed") {
    return { failure: decision.failure, status: "failed" };
  }
  return { status: "cleared" };
}

function requireClusterId(snapshot: DraftMutationSnapshot): string {
  if (snapshot.clusterId === undefined) {
    throw new Error("A queued draft snapshot requires a cluster ID.");
  }
  return snapshot.clusterId;
}
